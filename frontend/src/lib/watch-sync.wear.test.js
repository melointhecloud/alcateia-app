// @vitest-environment happy-dom
// The Wear OS watch speaks the Apple Watch's protocol over another wire. (The watch app and its
// fixture files are not in this fork, so the checks against them are gone.)
// Android counts as a phone with a watch link, the iPhone still does, the web does not.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mobile = vi.hoisted(() => ({ platform: 'android', status: null }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ status: (...a) => mobile.status(...a) }) }))
vi.mock('./mobile.js', async (orig) => ({ ...(await orig()), MOBILE: true, nativePlatform: async () => mobile.platform }))

const ws = await import('./watch-sync.js')
const { buildSnapshot, applyEvents, bindWatchActions, bindWatchAppActions, streakFor, watchStatus, _setWatchPluginForTest, _resetWatchSync } = ws

const state = () => ({
  unit: 'kg', restSec: 90, routines: [], weekStart: 1,
  workouts: [
    { id: 'old', d: '2026-10-19', entries: [{ id: '0025', target: { sets: 2, reps: 8 }, sets: [{ w: 55, r: 8, done: true }, { w: 57.5, r: 6, done: true }] }] },
  ],
  active: {
    id: 'w-1', name: 'Push day', cur: 0, d: '2026-10-29', start: 1761742800000,
    entries: [
      { id: '0025', target: { sets: 2, reps: 8, weight: 60, restSec: 120 }, sets: [{ w: 60, r: 8, done: true, at: 1761742900000 }, { w: 60, r: 8, done: false }] },
      { id: '0001', target: { sets: 1, reps: 10 }, sets: [{ w: 20, r: 10, done: false, phase: 'warmup' }, { w: 30, r: 10, done: false }] },
    ],
  },
})

beforeEach(() => { localStorage.clear(); _resetWatchSync(); mobile.platform = 'android' })
afterEach(() => _resetWatchSync())

describe('the snapshot the Wear OS watch parses', () => {
  it('carries the week streak for the Tile', () => {
    expect(streakFor(state(), '2026-10-29')).toEqual({ weeks: 1, thisWeekDone: false })
    expect(streakFor({ workouts: [] })).toEqual({ weeks: 0, thisWeekDone: false })
    expect(streakFor(null)).toEqual({ weeks: 0, thisWeekDone: false })
  })
})

describe('the watch link per platform', () => {
  it('asks the native WatchBridge on Android, as on the iPhone', async () => {
    const status = vi.fn(async () => ({ supported: true, paired: true, installed: true, reachable: true }))
    mobile.status = status
    for (const platform of ['android', 'ios']) {
      _resetWatchSync()
      mobile.platform = platform
      expect(await watchStatus()).toMatchObject({ paired: true, installed: true, reachable: true })
    }
    expect(status).toHaveBeenCalledTimes(2)
  })

  it('has none on the web', async () => {
    mobile.platform = 'web'
    expect(await watchStatus()).toEqual({ paired: false, installed: false })
  })

  it('without the watch app installed, nothing is linked', async () => {
    _setWatchPluginForTest({ status: async () => ({ supported: true, paired: true, installed: false }) })
    expect(await watchStatus()).toMatchObject({ installed: false })
  })
})
