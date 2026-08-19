import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the ctx.remote merge (settings/credentials invalidations)
// into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { RouteResilienceSettingsSection } from './RouteResilienceSettingsSection.tsx'
import type { RouteResilienceSettingsInjected } from './RouteResilienceSettingsSection.tsx'
import { en, zh, type RouteResilienceSettingsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dshRouteResilience': RouteResilienceSettingsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.dshRouteResilience'

/** Services required by this browser plugin. */
export const inject = ['slots', 'locale', 'connection', 'remote']

/**
 * Register the Route Resilience management panel at the bottom of the Models
 * settings page (`settings.models.item`, declared by ui-settings-models'
 * Models entry). The status ticker converges the panel on pushed invalidations
 * instead of polling for configuration drift: any host settings document,
 * credential, or adapter-topology change bumps it, and the mounted panel
 * re-fetches the host status route and the settings document.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-route-resilience: settings dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle

  let tick = 0
  const listeners = new Set<() => void>()
  const bump = (): void => {
    tick += 1
    for (const listener of listeners) listener()
  }
  const statusTicker: HostObservable<number> = {
    getSnapshot: () => tick,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  ctx.effect(() => {
    const disposers = [
      ctx.remote.$on('settings/document-updated', bump),
      ctx.remote.$on('credentials/updated', bump),
      ctx.remote.$on('llm/adapters-updated', bump),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'dsh-route-resilience: status invalidations')

  const injected = (): RouteResilienceSettingsInjected => ({
    api: connection.api,
    hooks: { status: statusTicker },
  })
  ctx.slots.inject('settings.models.item', () => ctx.slots.register({
    name: 'settings.models.item',
    id: 'dsh-route-resilience',
    order: 0,
    locale: NS,
    inject: injected,
  }, RouteResilienceSettingsSection))
}
