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
import z from '@deepseek-ai/schemastery';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
/** Default errors that indicate another target may recover the request. */
export const DEFAULT_RETRYABLE_CODES = ['EMPTY_RESPONSE', 'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT'];
const DEFAULT_QUARANTINE_BASE_MS = 60_000;
const DEFAULT_QUARANTINE_CAP_MS = 300_000;
function attemptKey(turn, step) {
    return `${turn}/${step}`;
}
/**
 * State for group routing and route health. One attempt stays attached to a
 * failed step until its target succeeds, the group is exhausted, or its turn
 * ends; route health survives turn boundaries and resets only on reconfiguration.
 */
export class RouteResilienceRouter {
    emit;
    groups = new Map();
    health = new Map();
    quarantinePolicies = new Map();
    rotation = new Map();
    attempts = new WeakMap();
    activeGroup;
    constructor(emit = () => { }) {
        this.emit = emit;
    }
    /** Replace every configured group; a new configuration starts healthy. */
    setGroups(groups) {
        const next = new Map();
        const health = new Map();
        const policies = new Map();
        for (const group of groups) {
            if (group.id.length === 0)
                throw new Error('dsh-route-resilience: group id must be non-empty');
            if (next.has(group.id))
                throw new Error(`dsh-route-resilience: duplicate group "${group.id}"`);
            if (group.targets.length === 0)
                throw new Error(`dsh-route-resilience: group "${group.id}" needs at least one target`);
            const targets = group.targets.map((target) => {
                if (target.provider.length === 0 || target.model.length === 0) {
                    throw new Error(`dsh-route-resilience: group "${group.id}" targets need provider and model`);
                }
                return Object.freeze({ provider: target.provider, model: target.model });
            });
            if (new Set(targets.map(target => `${target.provider}\u0000${target.model}`)).size !== targets.length) {
                throw new Error(`dsh-route-resilience: group "${group.id}" repeats a target`);
            }
            const retryableCodes = group.retryableCodes.length === 0 ? DEFAULT_RETRYABLE_CODES : group.retryableCodes;
            if (retryableCodes.some(code => code.length === 0) || new Set(retryableCodes).size !== retryableCodes.length) {
                throw new Error(`dsh-route-resilience: group "${group.id}" has invalid retryableCodes`);
            }
            if (group.quarantineCapMs < group.quarantineBaseMs) {
                throw new Error(`dsh-route-resilience: group "${group.id}" quarantineCapMs must be >= quarantineBaseMs`);
            }
            next.set(group.id, Object.freeze({
                id: group.id,
                targets: Object.freeze(targets),
                retryableCodes: Object.freeze([...retryableCodes]),
                quarantineBaseMs: group.quarantineBaseMs,
                quarantineCapMs: group.quarantineCapMs,
            }));
            // The same provider route may appear in several groups; the first group
            // that names it owns its quarantine delays and seeds its health.
            for (const target of targets) {
                if (!policies.has(target.provider)) {
                    policies.set(target.provider, {
                        baseMs: group.quarantineBaseMs,
                        capMs: group.quarantineCapMs,
                    });
                }
                if (!health.has(target.provider)) {
                    health.set(target.provider, {
                        status: 'active',
                        quarantinedUntil: 0,
                        consecutiveErrors: 0,
                        retryAfterMs: null,
                        lastErrorAt: 0,
                        lastErrorCode: null,
                    });
                }
            }
        }
        this.groups = next;
        this.health = health;
        this.quarantinePolicies = policies;
        this.rotation = new Map();
    }
    /** Remember the virtual group name the request waterfall routes through. */
    setActiveGroup(id) {
        this.activeGroup = id;
    }
    /**
     * Read-only status view for the web status route. Exposes configuration
     * shape, per-route health, and rotation pointers — provider route names and
     * states only. No key material, environment values, or credential references
     * are ever included: each route's key is owned by llm-pi-ai and resolved per
     * request.
     */
    snapshot() {
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
        };
    }
    /**
     * Resolve the concrete route for one outgoing agent request. Only a config
     * whose provider names the active group is routed; anything else passes
     * through untouched.
     */
    route(agent, turn, step, config) {
        if (config.provider !== this.activeGroup)
            return config;
        const group = this.groups.get(config.provider);
        if (group === undefined)
            return config;
        let entries = this.attempts.get(agent);
        if (entries === undefined) {
            entries = new Map();
            this.attempts.set(agent, entries);
        }
        const attempt = entries.get(attemptKey(turn, step)) ?? { group, targetIndex: this.pickStart(agent, group) };
        if (attempt.group.id !== group.id) {
            throw new Error(`dsh-route-resilience: step ${turn}/${step} already uses group "${attempt.group.id}"`);
        }
        entries.set(attemptKey(turn, step), attempt);
        const target = attempt.group.targets[attempt.targetIndex];
        if (target === undefined)
            throw new Error(`dsh-route-resilience: group "${attempt.group.id}" has no selected target`);
        return { ...config, provider: target.provider, model: target.model };
    }
    /** Drop step routing state at a turn boundary; route health survives. */
    finishTurn(agent, turn) {
        const entries = this.attempts.get(agent);
        if (entries === undefined)
            return;
        for (const entryKey of entries.keys()) {
            if (entryKey.startsWith(`${turn}/`))
                entries.delete(entryKey);
        }
    }
    /**
     * Update route health from one failure and move an eligible failed request
     * to the next target. Rate-limit failures quarantine the failed route;
     * auth/quota failures disable it; other codes leave health alone. Health is
     * updated before the switch check, so a route is marked even when no next
     * target exists.
     */
    failover(agent, turn, step, failure) {
        const attempt = this.attempts.get(agent)?.get(attemptKey(turn, step));
        if (attempt === undefined)
            return undefined;
        const from = attempt.group.targets[attempt.targetIndex];
        if (from === undefined)
            return undefined;
        const code = failure.code;
        const status = failure.status;
        if (code === 'RATE_LIMIT' || status === 429) {
            this.quarantine(agent, from.provider, failure.providerRetryAfterMs, code, failure.message);
        }
        else if (code === 'AUTH' || code === 'INVALID_CREDENTIAL' || code === 'QUOTA'
            || status === 401 || status === 402 || status === 403) {
            this.disable(agent, from.provider, code, failure.message);
        }
        if (!attempt.group.retryableCodes.includes(code))
            return undefined;
        const to = attempt.group.targets[attempt.targetIndex + 1];
        if (to === undefined)
            return undefined;
        attempt.targetIndex += 1;
        return { group: attempt.group.id, from, to };
    }
    /** First healthy target from the group's rotation pointer, or a fallback. */
    pickStart(agent, group) {
        const count = group.targets.length;
        const pointer = this.rotation.get(group.id) ?? 0;
        for (let offset = 0; offset < count; offset += 1) {
            const index = (pointer + offset) % count;
            const target = group.targets[index];
            if (target !== undefined && this.isHealthy(agent, target.provider)) {
                this.rotation.set(group.id, (index + 1) % count);
                return index;
            }
        }
        // Nothing healthy. Force-revive the earliest-expiring quarantined route to
        // keep the service up; with every route disabled, the first target runs and
        // its failure surfaces naturally.
        let fallbackIndex = 0;
        let fallbackProvider;
        let earliestUntil = Infinity;
        for (let index = 0; index < count; index += 1) {
            const target = group.targets[index];
            if (target === undefined)
                continue;
            const entry = this.health.get(target.provider);
            if (entry?.status !== 'quarantined')
                continue;
            if (entry.quarantinedUntil < earliestUntil) {
                earliestUntil = entry.quarantinedUntil;
                fallbackIndex = index;
                fallbackProvider = target.provider;
            }
        }
        if (fallbackProvider !== undefined)
            this.revive(agent, fallbackProvider);
        this.rotation.set(group.id, (fallbackIndex + 1) % count);
        return fallbackIndex;
    }
    /** Whether the route may serve now; an expired quarantine revives lazily. */
    isHealthy(agent, provider) {
        const entry = this.health.get(provider);
        if (entry === undefined)
            return true;
        if (entry.status === 'disabled')
            return false;
        if (entry.status === 'active')
            return true;
        if (Date.now() >= entry.quarantinedUntil) {
            this.revive(agent, provider);
            return true;
        }
        return false;
    }
    /** Quarantine a route with exponential backoff; the next failure doubles the delay. */
    quarantine(agent, provider, retryAfterMs, code, reason) {
        const entry = this.healthOf(provider);
        entry.status = 'quarantined';
        entry.consecutiveErrors += 1;
        const policy = this.quarantinePolicies.get(provider)
            ?? { baseMs: DEFAULT_QUARANTINE_BASE_MS, capMs: DEFAULT_QUARANTINE_CAP_MS };
        const backoff = Math.min(policy.baseMs * 2 ** (entry.consecutiveErrors - 1), policy.capMs);
        const delay = retryAfterMs !== undefined && retryAfterMs > 0 ? retryAfterMs : backoff;
        entry.quarantinedUntil = Date.now() + delay;
        entry.retryAfterMs = retryAfterMs ?? null;
        entry.lastErrorAt = Date.now();
        entry.lastErrorCode = code ?? null;
        this.emit(agent, {
            provider,
            status: 'quarantined',
            until: entry.quarantinedUntil,
            delayMs: delay,
            ...(code !== undefined ? { code } : {}),
            ...(reason !== undefined ? { reason } : {}),
        });
    }
    /** Permanently disable a route after auth or quota failures. */
    disable(agent, provider, code, reason) {
        const entry = this.healthOf(provider);
        entry.status = 'disabled';
        entry.lastErrorAt = Date.now();
        entry.lastErrorCode = code ?? null;
        this.emit(agent, {
            provider,
            status: 'disabled',
            ...(code !== undefined ? { code } : {}),
            ...(reason !== undefined ? { reason } : {}),
        });
    }
    /** Mark a route active again and record the transition. */
    revive(agent, provider) {
        const entry = this.health.get(provider);
        if (entry === undefined || entry.status === 'active')
            return;
        entry.status = 'active';
        entry.consecutiveErrors = 0;
        entry.quarantinedUntil = 0;
        entry.retryAfterMs = null;
        this.emit(agent, {
            provider,
            status: 'revived',
            ...(entry.lastErrorCode !== null ? { code: entry.lastErrorCode } : {}),
        });
    }
    /** The health record for a route, created fresh when unknown. */
    healthOf(provider) {
        const existing = this.health.get(provider);
        if (existing !== undefined)
            return existing;
        const created = {
            status: 'active',
            quarantinedUntil: 0,
            consecutiveErrors: 0,
            retryAfterMs: null,
            lastErrorAt: 0,
            lastErrorCode: null,
        };
        this.health.set(provider, created);
        return created;
    }
}
const targetSchema = z.object({
    provider: z.string().required(),
    model: z.string().required(),
});
/** Runtime schema for {@link Config}; every field is optional. */
export const Config = z.object({
    groups: z.array(z.object({
        id: z.string().required(),
        targets: z.array(targetSchema).required(),
        retryableCodes: z.array(z.string()),
        quarantineBaseMs: z.number().min(1),
        quarantineCapMs: z.number().min(1),
    })),
    activeGroup: z.string(),
});
export const name = 'dsh-route-resilience';
// webServer is optional (headless profiles have no HTTP layer): the status
// route installs itself once the service becomes visible, same self-healing
// pattern as the settings registration below.
export const inject = ['agents'];
const SETTINGS_NAMESPACE = settingsNamespace('dsh-route-resilience');
function groupsOf(config) {
    return (config.groups ?? []).map(group => ({
        id: group.id,
        targets: group.targets,
        retryableCodes: group.retryableCodes ?? DEFAULT_RETRYABLE_CODES,
        quarantineBaseMs: group.quarantineBaseMs ?? DEFAULT_QUARANTINE_BASE_MS,
        quarantineCapMs: group.quarantineCapMs ?? DEFAULT_QUARANTINE_CAP_MS,
    }));
}
function validateConfig(config) {
    const groups = groupsOf(config);
    const ids = new Set(groups.map(group => group.id));
    if (config.activeGroup !== undefined && !ids.has(config.activeGroup)) {
        throw new Error(`dsh-route-resilience: activeGroup "${config.activeGroup}" is not configured`);
    }
    const router = new RouteResilienceRouter();
    router.setGroups(groups);
}
function writeJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' });
    res.end(payload);
}
/**
 * Register the settings namespace and attach group routing to the Agent Loop's
 * request and request recovery extension points. A group advances only after
 * the downstream retry policy delegates, so provider-owned retries keep their
 * existing precedence; an empty config leaves model selection untouched.
 */
export function apply(ctx, entry = {}) {
    const router = new RouteResilienceRouter((agent, data) => {
        agent.session.append('llm/key-status', data);
    });
    let current = () => entry;
    let idleLogged = false;
    const refresh = () => {
        const config = current();
        validateConfig(config);
        router.setGroups(groupsOf(config));
        router.setActiveGroup(config.activeGroup);
        // A plugin without an active group is installed but idle; say so once so
        // the operator is not surprised by fully pass-through routing.
        if (config.activeGroup === undefined) {
            if (!idleLogged) {
                idleLogged = true;
                ctx.logger.warn('dsh-route-resilience: activeGroup is not set; request routing passes through unchanged');
            }
        }
        else {
            idleLogged = false;
        }
    };
    // Self-healing settings registration. installSettingsSection's ctx.inject
    // child fiber created while the settings provider is not yet ACTIVE enters a
    // wait that some web boots never wake (~40%: the activation notification is
    // lost). Instead of deferring by a fixed delay, poll until the provider is
    // actually visible (strict ctx.get resolves undefined for a non-ACTIVE
    // provider), then install — the inject resolves immediately, no dangling
    // fiber is ever created. After install, keep verifying the namespace reads
    // back and reinstall if the registration is disposed.
    let installed = false;
    let installAttempts = 0;
    const installSettings = () => {
        if (installed)
            return;
        let settings;
        try {
            settings = ctx.get('settings');
        }
        catch {
            settings = undefined;
        }
        if (settings === undefined)
            return; // provider not ACTIVE yet; retry later
        installAttempts += 1;
        try {
            installSettingsSection(ctx, SETTINGS_NAMESPACE, Config, entry, {
                setSource(source) {
                    installed = true;
                    current = source;
                },
                onChange: refresh,
                validate: validateConfig,
            });
        }
        catch (error) {
            // Already registered (defensive) or transient: retry next round.
            ctx.logger.debug('dsh-route-resilience: settings install attempt %d rejected: %s', installAttempts, String(error));
        }
    };
    installSettings();
    const healTimer = setInterval(() => {
        let visible = false;
        try {
            visible = ctx.get('settings')
                ?.get?.(SETTINGS_NAMESPACE) !== undefined;
        }
        catch {
            visible = false;
        }
        if (installed && !visible) {
            // Registration disposed (provider detach/reload): fall back to entry
            // semantics and reinstall.
            installed = false;
            current = () => entry;
            ctx.logger.warn('dsh-route-resilience: settings namespace lost, reinstalling');
        }
        installSettings();
        installStatusRoute();
        if (!installed && installAttempts >= 10) {
            installAttempts = -1; // warn once, keep polling (service may activate late)
            ctx.logger.warn('dsh-route-resilience: settings service still unavailable after 20s');
        }
    }, 2000);
    ctx.effect(() => () => clearInterval(healTimer));
    refresh();
    // Status route for the browser half's Models-page panel: configuration
    // shape, per-route health, and rotation pointers. Read-only and credential-
    // free by construction (router.snapshot() exposes route names and states
    // only). Same-origin with the served web UI, like the host's other /api
    // plugin routes; remote browsers are fenced off /api/ by the trust fence.
    let wsRegistered = false;
    const installStatusRoute = () => {
        if (wsRegistered)
            return;
        let ws;
        try {
            ws = ctx.get('webServer');
        }
        catch {
            ws = undefined;
        }
        if (ws === undefined)
            return; // webServer not ACTIVE (or absent: headless)
        wsRegistered = true;
        ctx.effect(() => ws
            .register({
            kind: 'exact',
            path: '/api/dsh-route-resilience/status',
            handler: (req, res) => {
                const request = req;
                const response = res;
                if (request.method === 'GET') {
                    writeJson(response, 200, { ok: true, data: { ...router.snapshot(), settingsRegistered: installed } });
                    return;
                }
                writeJson(response, 405, { ok: false, error: 'method not allowed' });
            },
        }), 'dsh-route-resilience: status route');
    };
    installStatusRoute();
    ctx.on('agent/request', async ({ agent, turn, step }, next) => {
        const selected = await next();
        const group = current().activeGroup;
        return group === undefined ? selected : router.route(agent, turn, step, { ...selected, provider: group });
    });
    ctx.on('agent/turn-stopping', ({ agent, turn }) => {
        router.finishTurn(agent, turn);
    });
    ctx.on('agent/request-error', async ({ agent, turn, step, failure }, next) => {
        const downstream = await next();
        if (downstream?.kind === 'retry')
            return downstream;
        const switched = router.failover(agent, turn, step, failure);
        if (switched === undefined)
            return downstream;
        agent.session.append('llm/failover', { turn, step, ...switched, failure });
        return { kind: 'retry' };
    });
}
