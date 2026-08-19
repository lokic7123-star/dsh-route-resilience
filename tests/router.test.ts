/**
 * Unit tests for RouteResilienceRouter — the core routing/quarantine logic.
 *
 * Run: node --import tsx tests/router.test.ts
 * Or:  npx vitest run tests/router.test.ts (if vitest is available)
 */
import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { RouteResilienceRouter, DEFAULT_RETRYABLE_CODES } from '../src/index.ts'
import type { ModelGroup } from '../src/index.ts'

/** Minimal Agent stub — only the identity matters for WeakMap keys. */
function fakeAgent(): { id: string } {
  return { id: `agent-${Math.random().toString(36).slice(2, 8)}` }
}

function makeGroup(overrides: Partial<ModelGroup> & { id: string; targets: ModelGroup['targets'] }): ModelGroup {
  return {
    retryableCodes: DEFAULT_RETRYABLE_CODES,
    quarantineBaseMs: 60_000,
    quarantineCapMs: 300_000,
    ...overrides,
  }
}

describe('RouteResilienceRouter', () => {
  let router: RouteResilienceRouter
  let emitCalls: Array<{ provider: string; status: string }>

  beforeEach(() => {
    emitCalls = []
    router = new RouteResilienceRouter((_agent, data) => {
      emitCalls.push({ provider: data.provider, status: data.status })
    })
  })

  describe('setGroups', () => {
    it('accepts valid groups', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      const snap = router.snapshot()
      assert.equal(snap.groups.length, 1)
      assert.equal(snap.groups[0].id, 'g1')
    })

    it('rejects empty group id', () => {
      assert.throws(() => router.setGroups([makeGroup({ id: '', targets: [{ provider: 'p1', model: 'm1' }] })]))
    })

    it('rejects duplicate group ids', () => {
      const g = makeGroup({ id: 'g1', targets: [{ provider: 'p1', model: 'm1' }] })
      assert.throws(() => router.setGroups([g, { ...g }]))
    })

    it('rejects empty targets', () => {
      assert.throws(() => router.setGroups([makeGroup({ id: 'g1', targets: [] })]))
    })

    it('rejects duplicate targets', () => {
      const t = { provider: 'p1', model: 'm1' }
      assert.throws(() => router.setGroups([makeGroup({ id: 'g1', targets: [t, t] })]))
    })

    it('rejects quarantineCapMs < quarantineBaseMs', () => {
      assert.throws(() => router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }],
        quarantineBaseMs: 100_000,
        quarantineCapMs: 50_000,
      })]))
    })
  })

  describe('route', () => {
    it('passes through when no active group', () => {
      router.setGroups([makeGroup({ id: 'g1', targets: [{ provider: 'p1', model: 'm1' }] })])
      const agent = fakeAgent()
      const config = { provider: 'other', model: 'm1' }
      const result = router.route(agent, 0, 0, config)
      assert.deepEqual(result, config)
    })

    it('routes active group to first healthy target', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      const result = router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })
      assert.equal(result.provider, 'p1')
      assert.equal(result.model, 'm1')
    })

    it('rotates across requests (round-robin)', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      const r1 = router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })
      const r2 = router.route(agent, 1, 0, { provider: 'g1', model: 'm1' })
      assert.equal(r1.provider, 'p1')
      assert.equal(r2.provider, 'p2')
    })
  })

  describe('failover', () => {
    it('switches to next target on retryable error', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })

      const result = router.failover(agent, 0, 0, {
        code: 'RATE_LIMIT',
        message: 'rate limited',
        status: 429,
      })
      assert.deepEqual(result, {
        group: 'g1',
        from: { provider: 'p1', model: 'm1' },
        to: { provider: 'p2', model: 'm2' },
      })
    })

    it('quarantines route on RATE_LIMIT', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })

      router.failover(agent, 0, 0, { code: 'RATE_LIMIT', message: 'rate limited', status: 429 })
      const snap = router.snapshot()
      const p1Health = snap.health.find(h => h.provider === 'p1')
      assert.equal(p1Health?.status, 'quarantined')
    })

    it('disables route on AUTH error', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })

      router.failover(agent, 0, 0, { code: 'AUTH', message: 'unauthorized', status: 401 })
      const snap = router.snapshot()
      const p1Health = snap.health.find(h => h.provider === 'p1')
      assert.equal(p1Health?.status, 'disabled')
    })

    it('does not switch on non-retryable error', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
        retryableCodes: ['RATE_LIMIT'],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })

      const result = router.failover(agent, 0, 0, {
        code: 'PARSE_ERROR',
        message: 'bad json',
      })
      assert.equal(result, undefined)
    })

    it('returns undefined when no next target exists', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })

      const result = router.failover(agent, 0, 0, { code: 'RATE_LIMIT', message: 'rate limited', status: 429 })
      assert.equal(result, undefined)
    })
  })

  describe('finishTurn', () => {
    it('clears turn routing state so next step picks from rotation pointer', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      // First route picks p1 (pointer starts at 0), advances pointer to 1
      const r1 = router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })
      assert.equal(r1.provider, 'p1')
      // finishTurn clears attempt tracking; pointer is now at 1
      router.finishTurn(agent, 0)
      // Next route for turn 0 picks from pointer (1) = p2
      const r2 = router.route(agent, 0, 1, { provider: 'g1', model: 'm1' })
      assert.equal(r2.provider, 'p2')
    })
  })

  describe('snapshot', () => {
    it('returns read-only view with all groups and health', () => {
      router.setGroups([
        makeGroup({ id: 'g1', targets: [{ provider: 'p1', model: 'm1' }] }),
        makeGroup({ id: 'g2', targets: [{ provider: 'p2', model: 'm2' }] }),
      ])
      router.setActiveGroup('g1')
      const snap = router.snapshot()
      assert.equal(snap.activeGroup, 'g1')
      assert.equal(snap.groups.length, 2)
      assert.equal(snap.health.length, 2)
      assert.deepEqual(Object.keys(snap.rotation), [])
    })
  })

  describe('emission', () => {
    it('emits quarantine event on RATE_LIMIT', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })
      router.failover(agent, 0, 0, { code: 'RATE_LIMIT', message: 'rate limited', status: 429 })
      assert.ok(emitCalls.some(e => e.provider === 'p1' && e.status === 'quarantined'))
    })

    it('emits disabled event on AUTH', () => {
      router.setGroups([makeGroup({
        id: 'g1',
        targets: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
      })])
      router.setActiveGroup('g1')
      const agent = fakeAgent()
      router.route(agent, 0, 0, { provider: 'g1', model: 'm1' })
      router.failover(agent, 0, 0, { code: 'AUTH', message: 'unauthorized', status: 401 })
      assert.ok(emitCalls.some(e => e.provider === 'p1' && e.status === 'disabled'))
    })
  })
})
