/**
 * Route resilience management panel, rendered at the bottom of the Models
 * settings page (`settings.models.item`). Two areas:
 *
 * 1. Runtime status — fetched from the host's read-only `/api/dsh-route-resilience/
 *    status` route: the active group and per-group allocation pointers ("next
 *    request will use …"), one row per key (provider route, bound model,
 *    active/quarantined/disabled badge with recovery time, chain-end fallback
 *    tag). Refreshed on host document/credential/topology invalidations (the
 *    injected status ticker), after every save, and on a light poll while
 *    mounted so quarantine transitions show up live. The route carries route
 *    names and health states only — never key material.
 * 2. Configuration editor — reads and writes the `dsh-route-resilience` settings
 *    namespace through describe/mutate. Adding a key adds a target row, removing
 *    a key removes one, and the last row of each chain is automatically the
 *    fallback (chain order is priority; there is no separate toggle).
 */

import { useCallback, useEffect, useState } from 'react'
import type { IApiClient, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RouteResilienceSettingsKey } from './locales.ts'
import styles from './RouteResilienceSettingsSection.module.css'

const NAMESPACE = 'dsh-route-resilience'
const LLM_PI_AI_NAMESPACE = 'llm-pi-ai'
const STATUS_PATH = '/api/dsh-route-resilience/status'
/** Light poll cadence so runtime health transitions surface without reload. */
const STATUS_POLL_MS = 5000

interface Target {
  provider: string
  model: string
}

interface Group {
  id: string
  targets: Target[]
  retryableCodes: string[]
  quarantineBaseMs: number | undefined
  quarantineCapMs: number | undefined
}

interface FormValue {
  groups: Group[]
  activeGroup: string | undefined
}

/** Health record as exposed by the host status route (route names only). */
interface StatusHealth {
  provider: string
  status: 'active' | 'quarantined' | 'disabled'
  quarantinedUntil: number
  consecutiveErrors: number
  retryAfterMs: number | null
  lastErrorCode: string | null
}

interface StatusSnapshot {
  activeGroup: string | undefined
  groups: Array<{
    id: string
    targets: Target[]
    quarantineBaseMs: number
    quarantineCapMs: number
  }>
  health: StatusHealth[]
  rotation: Record<string, number>
}

/** One provider route as declared in the llm-pi-ai namespace. */
interface PiAiProviderProfile {
  apiKeyEnv?: string
  models?: Array<{ id: string; [key: string]: unknown }>
  [key: string]: unknown
}

/** Registration-side business face for the Models-page panel. */
export interface RouteResilienceSettingsInjected {
  /** Settings wire face (describe/mutate the dsh-route-resilience namespace). */
  api: Pick<IApiClient, 'settings' | 'credentials'>
  hooks: {
    /** Bumps on host settings/credential/topology changes; the panel re-fetches status on it. */
    status: HostObservable<number>
  }
}

/** Full component props: runtime share + panel locale + the inject face. */
type Props =
  PropsRuntime<'settings.models.item'>
  & PropsLocale<'settings.dshRouteResilience'>
  & InjectFace<RouteResilienceSettingsInjected>

type T = (key: RouteResilienceSettingsKey) => string

function emptyGroup(): Group {
  return {
    id: '',
    targets: [{ provider: '', model: '' }, { provider: '', model: '' }],
    retryableCodes: [],
    quarantineBaseMs: undefined,
    quarantineCapMs: undefined,
  }
}

/** Normalize the host settings document into the editable draft. */
function valueOf(view: SettingsNamespaceView): FormValue {
  const raw = view.value as Partial<FormValue> | null | undefined
  const groups = raw?.groups ?? []
  return {
    groups: groups.map(group => ({
      id: group.id,
      targets: group.targets,
      retryableCodes: group.retryableCodes ?? [],
      quarantineBaseMs: group.quarantineBaseMs,
      quarantineCapMs: group.quarantineCapMs,
    })),
    activeGroup: raw?.activeGroup,
  }
}

/** Provider route names already declared in the llm-pi-ai namespace. */
function providersOf(view: SettingsNamespaceView | undefined): Set<string> {
  if (view === undefined) return new Set()
  const raw = view.value as { providers?: Record<string, unknown> } | null | undefined
  return new Set(Object.keys(raw?.providers ?? {}))
}

/** Derive the credential reference for a provider route (mirrors the Models page). */
function deriveKeyRef(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/**
 * Profile template for a newly added key route: copy the group's first
 * existing provider's non-credential fields so models/api/baseURL stay in
 * step, then attach the new route's own credential reference. Falls back to
 * the target's model alone when no existing provider profile is available.
 */
function templateProfile(value: FormValue, provider: string, llmView: SettingsNamespaceView | undefined): Record<string, unknown> {
  const templateProvider = value.groups
    .flatMap(group => group.targets)
    .find(target => target.provider !== provider && providersOf(llmView).has(target.provider))
  if (templateProvider !== undefined) {
    const raw = llmView?.value as { providers?: Record<string, PiAiProviderProfile> } | null | undefined
    const profile = raw?.providers?.[templateProvider.provider]
    if (profile !== undefined) {
      const { apiKeyEnv: _env, ...rest } = profile
      return { ...rest, apiKeyEnv: deriveKeyRef(provider) }
    }
  }
  return { apiKeyEnv: deriveKeyRef(provider), models: [{ id: value.groups[0]?.targets[0]?.model ?? 'deepseek-chat' }] }
}

/** Next free provider route name for a key added to the given group. */
function nextProviderName(value: FormValue, llmView: SettingsNamespaceView | undefined, groupIndex: number): string {
  const group = value.groups[groupIndex]
  const base = group?.targets[0]?.provider ?? group?.id ?? 'provider'
  const taken = providersOf(llmView)
  for (const target of value.groups.flatMap(g => g.targets)) taken.add(target.provider)
  let candidate = `${base}-2`
  for (let i = 2; taken.has(candidate); i += 1) candidate = `${base}-${i}`
  return candidate
}

/** Parse a millisecond number input; blank or invalid input becomes unset. */
function parseMillis(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Resolve a css-module class by name. The module contract guarantees every
 * key used at runtime exists (lightningcss emits each referenced class), so
 * the indexed-record access narrows to a definite string here.
 */
function badgeClass(name: keyof typeof styles): string {
  return styles[name] ?? ''
}

/** Localized label and badge class for one key's health record. */
function statusBadge(health: StatusHealth, t: T): { label: string; className: string } {
  if (health.status === 'active') {
    return { label: t('statusActive'), className: badgeClass('badgeActive') }
  }
  if (health.status === 'disabled') {
    return { label: t('statusDisabled'), className: badgeClass('badgeDisabled') }
  }
  const remainingMs = health.quarantinedUntil - Date.now()
  const label = remainingMs > 0
    ? t('recoverIn').replace('{seconds}', String(Math.max(1, Math.ceil(remainingMs / 1000))))
    : t('statusQuarantined')
  return { label, className: badgeClass('badgeQuarantined') }
}

/** Human-facing identity of one target: provider, model, or both. */
function targetText(target: Target): string {
  return target.model.length === 0 || target.model === target.provider
    ? target.provider
    : `${target.provider} (${target.model})`
}

/**
 * Render the Models-page key management panel: status area on top, then the
 * configuration editor.
 * @param props - composed slot props (runtime share, locale, inject face).
 */
export function RouteResilienceSettingsSection({ api, useStatus, t }: Props) {
  // Re-renders whenever the host bumps the ticker (document/credentials/
  // topology changes), so the status area converges without polling config.
  const tick = useStatus((snapshot: number) => snapshot)
  const [view, setView] = useState<SettingsNamespaceView>()
  const [value, setValue] = useState<FormValue>()
  const [configStatus, setConfigStatus] = useState<'loading' | 'ready' | 'saving' | 'unavailable' | 'saved' | 'error'>('loading')
  const [error, setError] = useState<string>()
  const [snapshot, setSnapshot] = useState<StatusSnapshot>()
  const [statusState, setStatusState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  // llm-pi-ai namespace view: the source of provider profiles ("key slots").
  const [llmView, setLlmView] = useState<SettingsNamespaceView | undefined>()
  // Draft key values for provider routes added in this editing session.
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({})
  // Provider-route input that should receive focus after the next commit: the
  // naming field of a freshly added key, so the user can rename it in place.
  const [focusProvider, setFocusProvider] = useState<string | undefined>()
  const providerInputs = new Map<string, HTMLInputElement | null>()

  const loadConfig = useCallback(async (): Promise<void> => {
    if (api === undefined) return
    setConfigStatus('loading')
    const response = await api.settings.describe({})
    if (!response.result.ok) throw new Error(response.result.error.message)
    const next = response.result.value.namespaces.find(item => item.ns === NAMESPACE)
    if (next === undefined) {
      setConfigStatus('unavailable')
      return
    }
    const llm = response.result.value.namespaces.find(item => item.ns === LLM_PI_AI_NAMESPACE)
    setLlmView(llm)
    setView(next)
    setValue(valueOf(next))
    setKeyDrafts({})
    setConfigStatus('ready')
  }, [api])

  const loadStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(STATUS_PATH, { cache: 'no-store' })
      if (!response.ok) {
        setStatusState('unavailable')
        return
      }
      const body: unknown = await response.json()
      if (typeof body !== 'object' || body === null) {
        setStatusState('unavailable')
        return
      }
      const data = (body as { data?: unknown }).data
      if (typeof data !== 'object' || data === null) {
        setStatusState('unavailable')
        return
      }
      setSnapshot(data as StatusSnapshot)
      setStatusState('ready')
    } catch {
      setStatusState('unavailable')
    }
  }, [])

  useEffect(() => {
    void loadConfig().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
      setConfigStatus('error')
    })
    void loadStatus()
  }, [loadConfig, loadStatus, tick])

  // Quarantine expirations and runtime transitions happen outside settings
  // writes; a light poll while the page is mounted keeps them visible.
  useEffect(() => {
    const timer = setInterval(() => { void loadStatus() }, STATUS_POLL_MS)
    return () => clearInterval(timer)
  }, [loadStatus])

  const save = async (): Promise<void> => {
    if (api === undefined || view === undefined || value === undefined) return
    setConfigStatus('saving')
    setError(undefined)
    try {
      // Guard: a key route name must be unique across the whole configuration.
      // The Models page and llm-pi-ai both key providers by this name, so a
      // duplicate (e.g. renaming a new key to an existing provider) would
      // silently overwrite the existing route's profile.
      const seen = new Set<string>()
      for (const group of value.groups) {
        for (const target of group.targets) {
          if (target.provider.length === 0) {
            throw new Error(t('keyNameRequired'))
          }
          if (seen.has(target.provider)) {
            throw new Error(t('keyNameDuplicate').replace('{provider}', target.provider))
          }
          seen.add(target.provider)
        }
      }
      // 1. Create provider routes for newly added keys (targets whose provider
      //    is not yet declared in llm-pi-ai). Profile shape is copied from the
      //    group's first existing provider so models/api/baseURL stay in step;
      //    only the credential reference differs.
      const llmProviders = providersOf(llmView)
      const newProviders = [...new Set(
        value.groups.flatMap(group => group.targets.map(target => target.provider)),
      )].filter(provider => provider.length > 0 && !llmProviders.has(provider))
      const createdRoutes: string[] = []
      let llmRevision = llmView?.revision
      const rollbackRoutes = async (): Promise<void> => {
        // The group write failed after routes were created; undo them so the
        // Models page does not show provider routes no group references (a
        // partial save the user never asked for).
        let revision = llmRevision
        for (const provider of createdRoutes) {
          if (revision === undefined) break
          const response = await api.settings.mutate({
            ns: LLM_PI_AI_NAMESPACE,
            ops: [{ op: 'unset', path: ['providers', provider] }],
            expectedRevision: revision,
          })
          if (response.result.ok) revision = response.result.value.revision
        }
      }
      try {
        for (const provider of newProviders) {
          if (llmRevision === undefined) break
          const template = templateProfile(value, provider, llmView)
          const response = await api.settings.mutate({
            ns: LLM_PI_AI_NAMESPACE,
            ops: [{ op: 'set', path: ['providers', provider], value: template }],
            expectedRevision: llmRevision,
          })
          if (!response.result.ok) throw new Error(response.result.error.message)
          llmRevision = response.result.value.revision
          createdRoutes.push(provider)
        }
        // 2. Store key material for the newly added routes. The panel's own
        //    credential field is the only place key values cross this boundary;
        //    every other write here is route names and states.
        for (const provider of newProviders) {
          const ref = deriveKeyRef(provider)
          const draft = keyDrafts[provider]
          if (draft !== undefined && draft.length > 0) {
            const stored = await api.credentials.set({ ref, value: draft })
            if (!stored.result.ok) throw new Error(stored.result.error.message)
          }
        }
        // 3. Persist the rotation groups themselves.
        const groupResponse = await api.settings.mutate({
          ns: NAMESPACE,
          ops: [{ op: 'set', path: [], value: {
            groups: value.groups.map(group => ({
              id: group.id,
              targets: group.targets,
              ...(group.retryableCodes.length > 0 ? { retryableCodes: group.retryableCodes } : {}),
              ...(group.quarantineBaseMs !== undefined ? { quarantineBaseMs: group.quarantineBaseMs } : {}),
              ...(group.quarantineCapMs !== undefined ? { quarantineCapMs: group.quarantineCapMs } : {}),
            })),
            ...(value.activeGroup === undefined ? {} : { activeGroup: value.activeGroup }),
          } }],
          expectedRevision: view.revision,
        })
        if (!groupResponse.result.ok) throw new Error(groupResponse.result.error.message)
        setView(groupResponse.result.value)
        setValue(valueOf(groupResponse.result.value))
      } catch (cause) {
        // A failed group write after routes were created would leave the Models
        // page showing orphan routes; remove them so the configuration stays
        // exactly as it was before this save.
        await rollbackRoutes()
        throw cause
      }
      setKeyDrafts({})
      setConfigStatus('saved')
      // The host applies the new configuration immediately; reflect it.
      void loadConfig()
      void loadStatus()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setConfigStatus('error')
    }
  }

  if (configStatus === 'loading' && value === undefined) return <p className={styles.placeholder}>{t('loading')}</p>
  if (configStatus === 'unavailable') return <p className={styles.placeholder}>{t('unavailable')}</p>
  if (value === undefined) return <p className={styles.placeholder}>{error ?? ''}</p>

  const updateGroup = (index: number, group: Group): void => {
    const previous = value.groups[index]
    // Renaming the group that is the active group must follow the rename:
    // the status area and the host both key on activeGroup, so leaving the
    // old id would orphan the rotation and break validation on save.
    const activeFollows = value.activeGroup !== undefined
      && previous !== undefined
      && value.activeGroup === previous.id
      && group.id !== previous.id
    setValue({
      ...value,
      groups: value.groups.map((item, itemIndex) => itemIndex === index ? group : item),
      ...(activeFollows ? { activeGroup: group.id } : {}),
    })
  }
  const updateTarget = (groupIndex: number, targetIndex: number, patch: Partial<Target>): void => {
    const group = value.groups[groupIndex]
    const previous = group?.targets[targetIndex]
    // Renaming a freshly added key moves its draft key value along: the draft
    // is keyed by provider name, and the credential reference derives from it.
    const renamed = patch.provider !== undefined
      && previous !== undefined
      && patch.provider !== previous.provider
      && keyDrafts[previous.provider] !== undefined
    setValue({
      ...value,
      groups: value.groups.map((group, index) => index !== groupIndex ? group : {
        ...group,
        targets: group.targets.map((item, itemIndex) => itemIndex === targetIndex ? { ...item, ...patch } : item),
      }),
    })
    if (renamed && previous !== undefined && patch.provider !== undefined) {
      const draft = keyDrafts[previous.provider]
      if (draft !== undefined) {
        const next = { ...keyDrafts }
        next[patch.provider] = draft
        delete next[previous.provider]
        setKeyDrafts(next)
      }
    }
  }

  /** Add one more key slot to a group: new provider route + credential ref. */
  const addKey = (groupIndex: number): void => {
    const group = value.groups[groupIndex]
    const provider = nextProviderName(value, llmView, groupIndex)
    const model = group?.targets[0]?.model ?? ''
    setValue({
      ...value,
      groups: value.groups.map((item, index) => index !== groupIndex ? item : {
        ...item,
        // The last target is the automatic fallback; a newly added key must
        // not demote the existing fallback, so it lands before the chain end.
        targets: [...item.targets.slice(0, -1), { provider, model }, ...item.targets.slice(-1)],
      }),
    })
    setKeyDrafts({ ...keyDrafts, [provider]: '' })
    setFocusProvider(provider)
  }

  /** Remove one key slot from a group (route stays declared; unset separately). */
  const removeKey = (groupIndex: number, targetIndex: number): void => {
    const group = value.groups[groupIndex]
    const removed = group?.targets[targetIndex]
    setValue({
      ...value,
      groups: value.groups.map((item, index) => index !== groupIndex ? item : {
        ...item,
        targets: item.targets.filter((_t, i) => i !== targetIndex),
      }),
    })
    if (removed !== undefined && keyDrafts[removed.provider] !== undefined) {
      const next = { ...keyDrafts }
      delete next[removed.provider]
      setKeyDrafts(next)
    }
  }

  const healthOf = (provider: string): StatusHealth | undefined =>
    snapshot?.health.find(entry => entry.provider === provider)

  const nextTarget = ((): Target | undefined => {
    if (snapshot === undefined || snapshot.activeGroup === undefined) return undefined
    const group = snapshot.groups.find(candidate => candidate.id === snapshot.activeGroup)
    if (group === undefined) return undefined
    return group.targets[snapshot.rotation[group.id] ?? 0]
  })()

  return (
    <section className={styles.page} aria-label={t('title')}>
      <h2 className={styles.panelTitle}>{t('title')}</h2>
      <p className={styles.description}>{t('description')}</p>

      <div className={styles.status}>
        <div className={styles.statusHead}>
          <strong>{t('statusTitle')}</strong>
          {snapshot !== undefined && (
            <span className={styles.statusTotal}>
              {t('statusTotal').replace('{count}', String(snapshot.health.length))}
            </span>
          )}
        </div>
        {statusState === 'loading'
          ? <p className={styles.placeholder}>{t('statusLoading')}</p>
          : statusState === 'unavailable'
            ? <p className={styles.placeholder}>{t('statusUnavailable')}</p>
            : snapshot === undefined
              ? <p className={styles.placeholder}>{t('statusUnavailable')}</p>
              : (
                <>
                  <p className={styles.nextRequest} role="status" aria-live="polite">
                    {nextTarget === undefined
                      ? t('idle')
                      : t('nextRequest').replace('{target}', targetText(nextTarget))}
                  </p>
                  {snapshot.groups.length === 0
                    ? <p className={styles.placeholder}>{t('empty')}</p>
                    : snapshot.groups.map(group => {
                      const pointer = snapshot.rotation[group.id] ?? 0
                      const pointerTarget = group.targets[pointer]
                      return (
                        <div key={group.id} className={styles.statusGroup}>
                          <div className={styles.statusGroupHead}>
                            <span className={styles.groupId}>{group.id}</span>
                            {snapshot.activeGroup === group.id
                              ? <span className={styles.activeTag}>{t('activeGroup')}</span>
                              : null}
                            {pointerTarget !== undefined && (
                              <span className={styles.pointer}>
                                {t('pointer')}: {targetText(pointerTarget)}
                              </span>
                            )}
                          </div>
                          {group.targets.map((target, targetIndex) => {
                            const health = healthOf(target.provider)
                            const fallback = targetIndex === group.targets.length - 1
                            return (
                              <div key={`${target.provider}-${targetIndex}`} className={styles.statusRow}>
                                <span className={styles.rowProvider}>{target.provider}</span>
                                <span className={styles.rowModel}>{target.model}</span>
                                {health === undefined
                                  ? null
                                  : (() => {
                                    const badge = statusBadge(health, t)
                                    return (
                                      <span
                                        className={`${styles.badge} ${badge.className}`}
                                        role="img"
                                        aria-label={badge.label}
                                        title={badge.label}
                                      >
                                        {badge.label}
                                      </span>
                                    )
                                  })()}
                                {fallback ? <span className={styles.fallbackTag}>{t('fallback')}</span> : null}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                </>
              )}
      </div>

      <h3 className={styles.editorTitle}>{t('targets')}</h3>
      {value.groups.map((group, groupIndex) => (
        <fieldset className={styles.group} key={groupIndex}>
          <div className={styles.groupHeader}>
            <label>
              {t('groupId')}
              <input value={group.id} onChange={event => updateGroup(groupIndex, { ...group, id: event.target.value })} />
            </label>
            <label className={styles.active}>
              <input
                type="radio"
                name="activeGroup"
                checked={value.activeGroup === group.id && group.id.length > 0}
                onChange={() => setValue({ ...value, activeGroup: group.id })}
              />
              {t('active')}
            </label>
            <button type="button" onClick={() => setValue({
              ...value,
              groups: value.groups.filter((_item, index) => index !== groupIndex),
              ...(value.activeGroup === group.id ? { activeGroup: undefined } : {}),
            })}>{t('remove')}</button>
          </div>
          <strong>{t('targets')}</strong>
          {group.targets.map((target, targetIndex) => {
            const isNewKey = keyDrafts[target.provider] !== undefined
            return (
              <div className={styles.target} key={`${targetIndex}-${target.provider}`}>
                <input
                  aria-label={t('provider')}
                  placeholder={isNewKey ? t('newKeyName') : t('provider')}
                  value={target.provider}
                  ref={node => {
                    providerInputs.set(target.provider, node)
                    // A freshly added key's naming field takes focus so the
                    // user can rename `opencode-2` to something meaningful
                    // (e.g. `zen-主账号`) before filling the key value.
                    if (focusProvider === target.provider) {
                      node?.focus()
                      node?.select()
                      setFocusProvider(undefined)
                    }
                  }}
                  onChange={event => updateTarget(groupIndex, targetIndex, { provider: event.target.value })}
                />
                <input aria-label={t('model')} placeholder={t('model')} value={target.model}
                  onChange={event => updateTarget(groupIndex, targetIndex, { model: event.target.value })} />
                {isNewKey
                  ? <input
                      aria-label={t('newKeyValue')}
                      placeholder={t('newKeyPlaceholder').replace('{ref}', deriveKeyRef(target.provider))}
                      type="password"
                      value={keyDrafts[target.provider] ?? ''}
                      onChange={event => setKeyDrafts({
                        ...keyDrafts,
                        [target.provider]: event.target.value,
                      })}
                    />
                  : null}
                {targetIndex === group.targets.length - 1
                  ? <span className={styles.fallbackTag}>{t('fallback')}</span>
                  : null}
                <button type="button"
                  onClick={() => removeKey(groupIndex, targetIndex)}>{t('remove')}</button>
              </div>
            )
          })}
          <div className={styles.keyActions}>
            <button type="button" onClick={() => addKey(groupIndex)}>{t('addKey')}</button>
          </div>
          <label className={styles.codes}>
            {t('codes')}
            <input value={group.retryableCodes.join(', ')}
              onChange={event => updateGroup(groupIndex, {
                ...group,
                retryableCodes: event.target.value.split(',').map(code => code.trim()).filter(Boolean),
              })} />
          </label>
          <div className={styles.numbers}>
            <label>
              {t('quarantineBaseMs')}
              <input type="number" min={1} value={group.quarantineBaseMs ?? ''}
                onChange={event => updateGroup(groupIndex, { ...group, quarantineBaseMs: parseMillis(event.target.value) })} />
            </label>
            <label>
              {t('quarantineCapMs')}
              <input type="number" min={1} value={group.quarantineCapMs ?? ''}
                onChange={event => updateGroup(groupIndex, { ...group, quarantineCapMs: parseMillis(event.target.value) })} />
            </label>
          </div>
        </fieldset>
      ))}
      <div className={styles.actions}>
        <button type="button" onClick={() => setValue({ ...value, groups: [...value.groups, emptyGroup()] })}>{t('addGroup')}</button>
        <button type="button" disabled={configStatus === 'saving'} onClick={() => { void save() }}>{configStatus === 'saving' ? t('saving') : t('save')}</button>
        {configStatus === 'saved' && <span>{t('saved')}</span>}
      </div>
      {error !== undefined && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  )
}
