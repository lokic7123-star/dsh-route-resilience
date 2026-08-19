/**
 * Multi-route failover, fault isolation and observability for DeepSeek Harness.
 *
 * One "group" names an ordered list of real provider routes (`opencode-go-1`,
 * `opencode-go-2`, ...) serving the same model; the group id doubles as a
 * virtual provider name. While `activeGroup` is set, the `agent/request`
 * waterfall swaps the selected config's provider/model to the group's current
 * target, and the `agent/request-error` waterfall advances the attempt to the
 * next target whenever the downstream retry policy declines. Failed routes are
 * quarantined (exponential backoff, lazy revival) or disabled (auth failures),
 * so one degraded route cannot take the model down: the next healthy route
 * keeps the request flowing, and every health transition is recorded as an
 * observable session event instead of a silent hard failure.
 *
 * Credential posture: this plugin never touches key material. It only refers
 * to provider route names; each route's key is owned by the provider adapter
 * (e.g. llm-pi-ai) through its `apiKeyEnv` credential reference, resolved per
 * request. No file access, no credential service writes.
 *
 * @module dsh-route-resilience
 */

import type { Context, Events } from '@deepseek-ai/cordis'
import type { ServerResponse } from 'node:http'
import z from '@deepseek-ai/schemastery'
import type { Agent, RequestErrorAction } from '@deepseek-ai/dsh-agent'
import type { LlmCallConfig, LlmFailure } from '@deepseek-ai/dsh-llm'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
// Empty type import carries the ctx.webServer Context merge (host-webserver).
import type {} from '@deepseek-ai/dsh-host-webserver'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Durable record of one failed step switching to the next group target. */
    'llm/failover': LlmFailoverEventData
    /** Durable record of one provider route's health transition. */
    'llm/key-status': KeyStatusEventData
  }
}

/** One real adapter route attempted by a model group. */
export interface FailoverTarget {
  provider: string
  model: string
}

/** One provider route's health, as exposed by the status route (no key material). */
export interface KeyHealthSnapshot {
  /** The provider route name (never a credential value). */
  provider: string
  status: 'active' | 'quarantined' | 'disabled'
  /** Epoch ms when a quarantine lifts; 0 while active or disabled. */
  quarantinedUntil: number
  consecutiveErrors: number
  /** Downstream-provided retry-after, or null when the backoff policy applied. */
  retryAfterMs: number | null
  /** Last failure code, or null while the route never failed. */
  lastErrorCode: string | null
}

/**
 * Read-only status view of the router: configuration shape, per-route health,
 * and rotation pointers. Route names and states only — credentials live in
 * llm-pi-ai's per-route references and never cross this boundary.
 */
export interface RouteResilienceSnapshot {
  activeGroup: string | undefined
  groups: Array<{
    id: string
    targets: readonly FailoverTarget[]
    quarantineBaseMs: number
    quarantineCapMs: number
  }>
  health: KeyHealthSnapshot[]
  /** Group id → next pickStart scan origin (0-based target index). */
  rotation: Record<string, number>
}

/** Durable payload recorded when a failed step moves to the next target. */
export interface LlmFailoverEventData {
  turn: number
  step: number
  group: string
  from: FailoverTarget
  to: FailoverTarget
  failure: LlmFailure
}

/** Durable payload recorded on a provider route health transition. */
export interface KeyStatusEventData {
  provider: string
  status: 'quarantined' | 'disabled' | 'revived'
  until?: number
  delayMs?: number
  code?: string | null
  reason?: string
}

/** Default errors that indicate another target may recover the request. */
export const DEFAULT_RETRYABLE_CODES = ['EMPTY_RESPONSE', 'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT']

const DEFAULT_QUARANTINE_BASE_MS = 60_000
const DEFAULT_QUARANTINE_CAP_MS = 300_000

/** One ordered model group, resolved and frozen after validation. */
interface ModelGroup {
  id: string
  targets: readonly FailoverTarget[]
  retryableCodes: readonly string[]
  quarantineBaseMs: number
  quarantineCapMs: number
}

/** One in-flight step's routing decision, held until the step succeeds or its turn ends. */
interface Attempt {
  group: ModelGroup
  targetIndex: number
}

/** Per-route health facts; a route outside every group is always healthy. */
interface KeyHealth {
  status: 'active' | 'quarantined' | 'disabled'
  quarantinedUntil: number
  consecutiveErrors: number
  retryAfterMs: number | null
  lastErrorAt: number
  lastErrorCode: string | null
}

/** Router-owned quarantine delays captured for one provider route. */
interface QuarantinePolicy {
  baseMs: number
  capMs: number
}

/** Sink for health transitions; the plugin appends them to the agent session. */
type KeyStatusEmitter = (agent: Agent, data: KeyStatusEventData) => void

function attemptKey(turn: number, step: number): string {
  return `${turn}/${step}`
}

/**
 * State for group routing and route health. One attempt stays attached to a
 * failed step until its target succeeds, the group is exhausted, or its turn
 * ends; route health survives turn boundaries and resets only on reconfiguration.
 */
export class RouteResilienceRouter {
  private groups = new Map<string, ModelGroup>()
  private health = new Map<string, KeyHealth>()
  private quarantinePolicies = new Map<string, QuarantinePolicy>()
  private rotation = new Map<string, number>()
  private attempts = new WeakMap<Agent, Map<string, Attempt>>()
  private activeGroup: string | undefined

  constructor(private readonly emit: KeyStatusEmitter = () => {}) {}

  /** Replace every configured group; a new configuration starts healthy. */
  setGroups(groups: readonly ModelGroup[]): void {
    const next = new Map<string, ModelGroup>()
    const health = new Map<string, KeyHealth>()
    const policies = new Map<string, QuarantinePolicy>()
    for (const group of groups) {
      if (group.id.length === 0) throw new Error('dsh-route-resilience: group id must be non-empty')
      if (next.has(group.id)) throw new Error(`dsh-route-resilience: duplicate group "${group.id}"`)
      if (group.targets.length === 0) throw new Error(`dsh-route-resilience: group "${group.id}" needs at least one target`)
      const targets = group.targets.map((target) => {
        if (target.provider.length === 0 || target.model.length === 0) {
          throw new Error(`dsh-route-resilience: group "${group.id}" targets need provider and model`)
        }
        return Object.freeze({ provider: target.provider, model: target.model })
      })
      if (new Set(targets.map(target => `${target.provider}\u0000${target.model}`)).size !== targets.length) {
        throw new Error(`dsh-route-resilience: group "${group.id}" repeats a target`)
      }
      const retryableCodes = group.retryableCodes.length === 0 ? DEFAULT_RETRYABLE_CODES : group.retryableCodes
      if (retryableCodes.some(code => code.length === 0) || new Set(retryableCodes).size !== retryableCodes.length) {
        throw new Error(`dsh-route-resilience: group "${group.id}" has invalid retryableCodes`)
      }
      if (group.quarantineCapMs < group.quarantineBaseMs) {
        throw new Error(`dsh-route-resilience: group "${group.id}" quarantineCapMs must be >= quarantineBaseMs`)
      }
      next.set(group.id, Object.freeze({
        id: group.id,
        targets: Object.freeze(targets),
        retryableCodes: Object.freeze([...retryableCodes]),
        quarantineBaseMs: group.quarantineBaseMs,
        quarantineCapMs: group.quarantineCapMs,
      }))
      // The same provider route may appear in several groups; the first group
      // that names it owns its quarantine delays and seeds its health.
      for (const target of targets) {
        if (!policies.has(target.provider)) {
          policies.set(target.provider, {
            baseMs: group.quarantineBaseMs,
            capMs: group.quarantineCapMs,
          })
        }
        if (!health.has(target.provider)) {
          health.set(target.provider, {
            status: 'active',
            quarantinedUntil: 0,
            consecutiveErrors: 0,
            retryAfterMs: null,
            lastErrorAt: 0,
            lastErrorCode: null,
          })
        }
      }
    }
    this.groups = next
    this.health = health
    this.quarantinePolicies = policies
    this.rotation = new Map()
  }

  /** Remember the virtual group name the request waterfall routes through. */
  setActiveGroup(id: string | undefined): void {
    this.activeGroup = id
  }

  /**
   * Read-only status view for the web status route. Exposes configuration
   * shape, per-route health, and rotation pointers — provider route names and
   * states only. No key material, environment values, or credential references
   * are ever included: each route's key is owned by llm-pi-ai and resolved per
   * request.
   */
  snapshot(): RouteResilienceSnapshot {
    return {
      activeGroup: this.activeGroup,
      groups: [...this.groups.values()].map(group => ({
        id: group.id,
        targets: group.targets,
        quarantineBaseMs: group.quarantineBaseMs,
        quarantineCapMs: group.quarantineCapMs,
      })),
      health: [...this.health.entries()].map(([provider, entry]) => ({
        provider,
        status: entry.status,
        quarantinedUntil: entry.quarantinedUntil,
        consecutiveErrors: entry.consecutiveErrors,
        retryAfterMs: entry.retryAfterMs,
        lastErrorCode: entry.lastErrorCode,
      })),
      rotation: Object.fromEntries(this.rotation),
    }
  }

  /**
   * Resolve the concrete route for one outgoing agent request. Only a config
   * whose provider names the active group is routed; anything else passes
   * through untouched.
   */
  route(agent: Agent, turn: number, step: number, config: LlmCallConfig): LlmCallConfig {
    if (config.provider !== this.activeGroup) return config
    const group = this.groups.get(config.provider)
    if (group === undefined) return config
    let entries = this.attempts.get(agent)
    if (entries === undefined) {
      entries = new Map()
      this.attempts.set(agent, entries)
    }
    const attempt = entries.get(attemptKey(turn, step)) ?? { group, targetIndex: this.pickStart(agent, group) }
    if (attempt.group.id !== group.id) {
      throw new Error(`dsh-route-resilience: step ${turn}/${step} already uses group "${attempt.group.id}"`)
    }
    entries.set(attemptKey(turn, step), attempt)
    const target = attempt.group.targets[attempt.targetIndex]
    if (target === undefined) throw new Error(`dsh-route-resilience: group "${attempt.group.id}" has no selected target`)
    return { ...config, provider: target.provider, model: target.model }
  }

  /** Drop step routing state at a turn boundary; route health survives. */
  finishTurn(agent: Agent, turn: number): void {
    const entries = this.attempts.get(agent)
    if (entries === undefined) return
    for (const entryKey of entries.keys()) {
      if (entryKey.startsWith(`${turn}/`)) entries.delete(entryKey)
    }
  }

  /**
   * Update route health from one failure and move an eligible failed request
   * to the next target. Rate-limit failures quarantine the failed route;
   * auth/quota failures disable it; other codes leave health alone. Health is
   * updated before the switch check, so a route is marked even when no next
   * target exists.
   */
  failover(agent: Agent, turn: number, step: number, failure: LlmFailure): {
    group: string
    from: FailoverTarget
    to: FailoverTarget
  } | undefined {
    const attempt = this.attempts.get(agent)?.get(attemptKey(turn, step))
    if (attempt === undefined) return undefined
    const from = attempt.group.targets[attempt.targetIndex]
    if (from === undefined) return undefined
    const code = failure.code
    const status = failure.status
    if (code === 'RATE_LIMIT' || status === 429) {
      this.quarantine(agent, from.provider, failure.providerRetryAfterMs, code, failure.message)
    } else if (
      code === 'AUTH' || code === 'INVALID_CREDENTIAL' || code === 'QUOTA'
      || status === 401 || status === 402 || status === 403
    ) {
      this.disable(agent, from.provider, code, failure.message)
    }
    if (!attempt.group.retryableCodes.includes(code)) return undefined
    const to = attempt.group.targets[attempt.targetIndex + 1]
    if (to === undefined) return undefined
    attempt.targetIndex += 1
    return { group: attempt.group.id, from, to }
  }

  /** First healthy target from the group's rotation pointer, or a fallback. */
  private pickStart(agent: Agent, group: ModelGroup): number {
    const count = group.targets.length
    const pointer = this.rotation.get(group.id) ?? 0
    for (let offset = 0; offset < count; offset += 1) {
      const index = (pointer + offset) % count
      const target = group.targets[index]
      if (target !== undefined && this.isHealthy(agent, target.provider)) {
        this.rotation.set(group.id, (index + 1) % count)
        return index
      }
    }
    // Nothing healthy. Force-revive the earliest-expiring quarantined route to
    // keep the service up; with every route disabled, the first target runs and
    // its failure surfaces naturally.
    let fallbackIndex = 0
    let fallbackProvider: string | undefined
    let earliestUntil = Infinity
    for (let index = 0; index < count; index += 1) {
      const target = group.targets[index]
      if (target === undefined) continue
      const entry = this.health.get(target.provider)
      if (entry?.status !== 'quarantined') continue
      if (entry.quarantinedUntil < earliestUntil) {
        earliestUntil = entry.quarantinedUntil
        fallbackIndex = index
        fallbackProvider = target.provider
      }
    }
    if (fallbackProvider !== undefined) this.revive(agent, fallbackProvider)
    this.rotation.set(group.id, (fallbackIndex + 1) % count)
    return fallbackIndex
  }

  /** Whether the route may serve now; an expired quarantine revives lazily. */
  private isHealthy(agent: Agent, provider: string): boolean {
    const entry = this.health.get(provider)
    if (entry === undefined) return true
    if (entry.status === 'disabled') return false
    if (entry.status === 'active') return true
    if (Date.now() >= entry.quarantinedUntil) {
      this.revive(agent, provider)
      return true
    }
    return false
  }

  /** Quarantine a route with exponential backoff; the next failure doubles the delay. */
  private quarantine(
    agent: Agent,
    provider: string,
    retryAfterMs?: number,
    code?: string,
    reason?: string,
  ): void {
    const entry = this.healthOf(provider)
    entry.status = 'quarantined'
    entry.consecutiveErrors += 1
    const policy = this.quarantinePolicies.get(provider)
      ?? { baseMs: DEFAULT_QUARANTINE_BASE_MS, capMs: DEFAULT_QUARANTINE_CAP_MS }
    const backoff = Math.min(policy.baseMs * 2 ** (entry.consecutiveErrors - 1), policy.capMs)
    const delay = retryAfterMs !== undefined && retryAfterMs > 0 ? retryAfterMs : backoff
    entry.quarantinedUntil = Date.now() + delay
    entry.retryAfterMs = retryAfterMs ?? null
    entry.lastErrorAt = Date.now()
    entry.lastErrorCode = code ?? null
    this.emit(agent, {
      provider,
      status: 'quarantined',
      until: entry.quarantinedUntil,
      delayMs: delay,
      ...(code !== undefined ? { code } : {}),
      ...(reason !== undefined ? { reason } : {}),
    })
  }

  /** Permanently disable a route after auth or quota failures. */
  private disable(agent: Agent, provider: string, code?: string, reason?: string): void {
    const entry = this.healthOf(provider)
    entry.status = 'disabled'
    entry.lastErrorAt = Date.now()
    entry.lastErrorCode = code ?? null
    this.emit(agent, {
      provider,
      status: 'disabled',
      ...(code !== undefined ? { code } : {}),
      ...(reason !== undefined ? { reason } : {}),
    })
  }

  /** Mark a route active again and record the transition. */
  private revive(agent: Agent, provider: string): void {
    const entry = this.health.get(provider)
    if (entry === undefined || entry.status === 'active') return
    entry.status = 'active'
    entry.consecutiveErrors = 0
    entry.quarantinedUntil = 0
    entry.retryAfterMs = null
    this.emit(agent, {
      provider,
      status: 'revived',
      ...(entry.lastErrorCode !== null ? { code: entry.lastErrorCode } : {}),
    })
  }

  /** The health record for a route, created fresh when unknown. */
  private healthOf(provider: string): KeyHealth {
    const existing = this.health.get(provider)
    if (existing !== undefined) return existing
    const created: KeyHealth = {
      status: 'active',
      quarantinedUntil: 0,
      consecutiveErrors: 0,
      retryAfterMs: null,
      lastErrorAt: 0,
      lastErrorCode: null,
    }
    this.health.set(provider, created)
    return created
  }
}

/** Durable configuration: ordered model groups and the group used by new requests. */
export interface Config {
  groups?: Array<{
    id: string
    targets: FailoverTarget[]
    retryableCodes?: string[]
    quarantineBaseMs?: number
    quarantineCapMs?: number
  }>
  activeGroup?: string
}

const targetSchema = z.object({
  provider: z.string().required(),
  model: z.string().required(),
})

/** Runtime schema for {@link Config}; every field is optional. */
export const Config: z<Config> = z.object({
  groups: z.array(z.object({
    id: z.string().required(),
    targets: z.array(targetSchema).required(),
    retryableCodes: z.array(z.string()),
    quarantineBaseMs: z.number().min(1),
    quarantineCapMs: z.number().min(1),
  })),
  activeGroup: z.string(),
})

export const name = 'dsh-route-resilience'
// webServer is optional (headless profiles have no HTTP layer): the status
// route installs itself once the service becomes visible, same self-healing
// pattern as the settings registration below.
export const inject = ['agents']

const SETTINGS_NAMESPACE = settingsNamespace('dsh-route-resilience')

function groupsOf(config: Config): ModelGroup[] {
  return (config.groups ?? []).map(group => ({
    id: group.id,
    targets: group.targets,
    retryableCodes: group.retryableCodes ?? DEFAULT_RETRYABLE_CODES,
    quarantineBaseMs: group.quarantineBaseMs ?? DEFAULT_QUARANTINE_BASE_MS,
    quarantineCapMs: group.quarantineCapMs ?? DEFAULT_QUARANTINE_CAP_MS,
  }))
}

function validateConfig(config: Config): void {
  const groups = groupsOf(config)
  const ids = new Set(groups.map(group => group.id))
  if (config.activeGroup !== undefined && !ids.has(config.activeGroup)) {
    throw new Error(`dsh-route-resilience: activeGroup "${config.activeGroup}" is not configured`)
  }
  const router = new RouteResilienceRouter()
  router.setGroups(groups)
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

/**
 * Register the settings namespace and attach group routing to the Agent Loop's
 * request and request recovery extension points. A group advances only after
 * the downstream retry policy delegates, so provider-owned retries keep their
 * existing precedence; an empty config leaves model selection untouched.
 */
export function apply(ctx: Context, entry: Config = {}): void {
  const router = new RouteResilienceRouter((agent, data) => {
    agent.session.append('llm/key-status', data)
  })
  let current = (): Config => entry
  let idleLogged = false
  const refresh = (): void => {
    const config = current()
    validateConfig(config)
    router.setGroups(groupsOf(config))
    router.setActiveGroup(config.activeGroup)
    // A plugin without an active group is installed but idle; say so once so
    // the operator is not surprised by fully pass-through routing.
    if (config.activeGroup === undefined) {
      if (!idleLogged) {
        idleLogged = true
        ctx.logger.warn('dsh-route-resilience: activeGroup is not set; request routing passes through unchanged')
      }
    } else {
      idleLogged = false
    }
  }
  // Self-healing settings registration. installSettingsSection's ctx.inject
  // child fiber created while the settings provider is not yet ACTIVE enters a
  // wait that some web boots never wake (~40%: the activation notification is
  // lost). Instead of deferring by a fixed delay, poll until the provider is
  // actually visible (strict ctx.get resolves undefined for a non-ACTIVE
  // provider), then install — the inject resolves immediately, no dangling
  // fiber is ever created. After install, keep verifying the namespace reads
  // back and reinstall if the registration is disposed.
  let installed = false
  let installAttempts = 0
  const installSettings = (): void => {
    if (installed) return
    let settings: unknown
    try { settings = ctx.get('settings') } catch { settings = undefined }
    if (settings === undefined) return // provider not ACTIVE yet; retry later
    installAttempts += 1
    try {
      installSettingsSection(ctx, SETTINGS_NAMESPACE, Config, entry, {
        setSource(source) {
          installed = true
          current = source
        },
        onChange: refresh,
        validate: validateConfig,
      })
    } catch (error) {
      // Already registered (defensive) or transient: retry next round.
      ctx.logger.debug('dsh-route-resilience: settings install attempt %d rejected: %s',
        installAttempts, String(error))
    }
  }
  installSettings()
  const healTimer = setInterval(() => {
    let visible = false
    try {
      visible = (ctx.get('settings') as { get?(ns: string): unknown } | undefined)
        ?.get?.(SETTINGS_NAMESPACE) !== undefined
    } catch { visible = false }
    if (installed && !visible) {
      // Registration disposed (provider detach/reload): fall back to entry
      // semantics and reinstall.
      installed = false
      current = () => entry
      ctx.logger.warn('dsh-route-resilience: settings namespace lost, reinstalling')
    }
    installSettings()
    installStatusRoute()
    if (!installed && installAttempts >= 10) {
      installAttempts = -1 // warn once, keep polling (service may activate late)
      ctx.logger.warn('dsh-route-resilience: settings service still unavailable after 20s')
    }
  }, 2000)
  ctx.effect(() => () => clearInterval(healTimer))
  refresh()

  // Status route for the browser half's Models-page panel: configuration
  // shape, per-route health, and rotation pointers. Read-only and credential-
  // free by construction (router.snapshot() exposes route names and states
  // only). Same-origin with the served web UI, like the host's other /api
  // plugin routes; remote browsers are fenced off /api/ by the trust fence.
  let wsRegistered = false
  const installStatusRoute = (): void => {
    if (wsRegistered) return
    let ws: unknown
    try { ws = ctx.get('webServer') } catch { ws = undefined }
    if (ws === undefined) return // webServer not ACTIVE (or absent: headless)
    wsRegistered = true
    ctx.effect(() => (ws as { register(route: { kind: 'exact'; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }): () => void })
      .register({
        kind: 'exact',
        path: '/api/dsh-route-resilience/status',
        handler: (req, res) => {
          const request = req as { method?: string }
          const response = res as ServerResponse
          if (request.method === 'GET') {
            writeJson(response, 200, { ok: true, data: { ...router.snapshot(), settingsRegistered: installed } })
            return
          }
          writeJson(response, 405, { ok: false, error: 'method not allowed' })
        },
      }), 'dsh-route-resilience: status route')
  }
  installStatusRoute()

  ctx.on('agent/request', async (
    { agent, turn, step }: Parameters<Events['agent/request']>[0],
    next: () => Promise<LlmCallConfig>,
  ): Promise<LlmCallConfig> => {
    const selected = await next()
    const group = current().activeGroup
    return group === undefined ? selected : router.route(agent, turn, step, { ...selected, provider: group })
  })

  ctx.on('agent/turn-stopping', ({ agent, turn }: Parameters<Events['agent/turn-stopping']>[0]) => {
    router.finishTurn(agent, turn)
  })

  ctx.on('agent/request-error', async (
    { agent, turn, step, failure }: Parameters<Events['agent/request-error']>[0],
    next: () => Promise<RequestErrorAction>,
  ): Promise<RequestErrorAction> => {
    const downstream = await next()
    if (downstream?.kind === 'retry') return downstream
    const switched = router.failover(agent, turn, step, failure)
    if (switched === undefined) return downstream
    agent.session.append('llm/failover', { turn, step, ...switched, failure })
    return { kind: 'retry' }
  })
}
