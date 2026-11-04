// @vitest-environment happy-dom

/* Paid access (ACCESS_MODE=subscription), the client half. A profile whose right has lapsed is
   `blocked`: because /api/me says `access.active === false`, or because PUT /api/data answered
   402 'subscription-inactive'. A blocked profile stops pushing (one 402, not a request every
   time something changes or the poll comes round), keeps its local copy and what it owes, and
   leaves the blocked state when the server says the right is back. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
const { toast, stopRest, abandonWork } = vi.hoisted(() => ({ toast: vi.fn(), stopRest: vi.fn(), abandonWork: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast, stopRest, abandonWork }) } }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'

const clone = value => JSON.parse(JSON.stringify(value))
const workout = (id, d = '2026-09-01') => ({ id, d, start: 1, entries: [] })
const httpError = (status, data = {}) => Object.assign(new Error(data.error || 'HTTP ' + status), { status, data })
const inactive402 = () => httpError(402, { error: 'subscription inactive', code: 'subscription-inactive', renewUrl: 'https://pay.example/renew' })
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT')
const USER = { id: 'user-1', name: 'One' }
const fresh = { offline: false, pending: false, auth: false, lastError: null, lastSynced: 0, server: null }
const signedIn = (S, extra = {}) => useStore.setState({ S, user: USER, ready: true, sync: { ...fresh }, blocked: false, ...extra })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gym_owner', USER.id)
  api.mockReset(); toast.mockReset()
  useStore.setState({ S: clone(DEF), user: null, ready: false, sync: { ...fresh }, config: null, blocked: false })
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  useStore.setState({ S: clone(DEF), user: null, ready: false, sync: { ...fresh }, config: null, blocked: false })
})

describe('a 402 on the push', () => {
  it('blocks the profile, keeps the local copy and what it owes, and stops pushing', async () => {
    const S = { ...clone(DEF), _ts: 500, workouts: [workout('w1')] }
    signedIn(S)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    api.mockRejectedValueOnce(inactive402())

    await useStore.getState().pushState()

    const st = useStore.getState()
    expect(st.blocked).toBe(true)
    expect(st.user).toEqual(USER)                       // still signed in: Sign out is its own choice
    expect(st.S.workouts.map(w => w.id)).toEqual(['w1']) // nothing wiped
    expect(localStorage.getItem('gym_dirty')).toBe('1')  // still owed to the server
    expect(puts()).toHaveLength(1)

    // Neither another push nor a change to the copy asks again
    await useStore.getState().pushState()
    await useStore.getState().pushState()
    expect(puts()).toHaveLength(1)
  })

  it('does not turn into a retry loop with the poll and the debounce', async () => {
    vi.useFakeTimers()
    signedIn({ ...clone(DEF), _ts: 500, workouts: [workout('w1')] })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    api.mockRejectedValueOnce(inactive402())
    await useStore.getState().pushState()
    api.mockReset()
    api.mockImplementation(async path => { throw httpError(500) })
    useStore.getState().update(s => { s.restSec = 45 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toHaveLength(0)
    expect(useStore.getState().S.restSec).toBe(45)       // the edit is kept locally
  })

  it('a 402 that is not the subscription one is just an error', async () => {
    signedIn({ ...clone(DEF), _ts: 500, workouts: [workout('w1')] })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    api.mockRejectedValueOnce(httpError(402, { error: 'pay up' }))
    await useStore.getState().pushState()
    expect(useStore.getState().blocked).toBe(false)
    expect(useStore.getState().sync.status).toBe('error')
  })
})

describe('the session says the right is not active', () => {
  it('setUser blocks on access.active === false and releases on true, null or no access block', () => {
    useStore.getState().setUser({ ...USER, access: { active: false, plan: 'mensal', validUntil: '2020-01-01T00:00:00.000Z' } })
    expect(useStore.getState().blocked).toBe(true)
    useStore.getState().setUser({ ...USER, access: { active: true, plan: 'mensal', validUntil: '2999-01-01T00:00:00.000Z' } })
    expect(useStore.getState().blocked).toBe(false)
    useStore.getState().setUser({ ...USER, access: { active: false } })
    expect(useStore.getState().blocked).toBe(true)
    useStore.getState().setUser(null)
    expect(useStore.getState().blocked).toBe(false)
    // an instance without ACCESS_MODE sends no `access` at all: never blocked
    useStore.getState().setUser(USER)
    expect(useStore.getState().blocked).toBe(false)
  })
})

describe('recheckAccess ("I already renewed")', () => {
  it('lets the profile back in when the server says active, and sends what was owed', async () => {
    signedIn({ ...clone(DEF), _ts: 500, workouts: [workout('w1')] }, { blocked: true })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    localStorage.setItem('gym_dirty', '1')
    api.mockImplementation(async (path, o) => {
      if (path === '/api/me') return { user: { ...USER, access: { active: true, plan: 'mensal', validUntil: '2999-01-01T00:00:00.000Z' } } }
      if (o?.method === 'PUT') return { ok: true, rev: 2 }
      return {}
    })

    const ok = await useStore.getState().recheckAccess()

    expect(ok).toBe(true)
    expect(useStore.getState().blocked).toBe(false)
    expect(puts()).toHaveLength(1)
  })

  it('stays blocked, and asks nothing else, while it is still inactive', async () => {
    signedIn({ ...clone(DEF), _ts: 500 }, { blocked: true })
    api.mockImplementation(async path => {
      if (path === '/api/me') return { user: { ...USER, access: { active: false } } }
      throw new Error('unexpected ' + path)
    })
    expect(await useStore.getState().recheckAccess()).toBe(false)
    expect(useStore.getState().blocked).toBe(true)
    expect(api.mock.calls.map(([p]) => p)).toEqual(['/api/me'])
  })

  it('a failed check (offline) leaves it blocked and does not throw', async () => {
    signedIn({ ...clone(DEF), _ts: 500 }, { blocked: true })
    api.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await useStore.getState().recheckAccess()).toBe(false)
    expect(useStore.getState().blocked).toBe(true)
  })
})

describe('signing out while blocked', () => {
  it('goes ahead (forced) without asking the server to take the owed copy, and clears the block', async () => {
    signedIn({ ...clone(DEF), _ts: 500, workouts: [workout('w1')] }, { blocked: true })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    localStorage.setItem('gym_dirty', '1')
    api.mockImplementation(async path => { if (path === '/api/logout') return { ok: true }; throw new Error('unexpected ' + path) })
    const r = await useStore.getState().signOut({ force: true })
    expect(r.owed).toBe(true)
    expect(r.stashed).toBe(true)
    expect(useStore.getState().user).toBeNull()
    expect(useStore.getState().blocked).toBe(false)
    expect(puts()).toHaveLength(0)
  })
})

describe('the poll while blocked', () => {
  it('only asks whether the subscription is back, and lets the profile in when it is', async () => {
    signedIn({ ...clone(DEF), _ts: 500, workouts: [workout('w1')] }, { blocked: true })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    let active = false
    api.mockImplementation(async (path, o) => {
      if (path === '/api/me') return { user: { ...USER, access: { active } } }
      if (path === '/api/config') return {}
      if (o?.method === 'PUT') return { ok: true, rev: 2 }
      return { state: null, rev: 1 }
    })
    window.dispatchEvent(new Event('online'))
    await new Promise(r => setTimeout(r, 10))
    expect(api.mock.calls.map(([p]) => p)).toEqual(['/api/me'])
    expect(useStore.getState().blocked).toBe(true)

    active = true
    window.dispatchEvent(new Event('online'))
    await new Promise(r => setTimeout(r, 10))
    expect(useStore.getState().blocked).toBe(false)
  })
})
