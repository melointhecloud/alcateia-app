// The pictures on a printed plan (#817): which file, the licence's size limit, the deadline, and
// the fallback to text. No real media file is read here: fetch, the store and the decode are
// stand-ins, and the bytes are a few placeholder bytes.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXIDX } from './exercises.js'
import {
  printPictureSource, loadPrintPictures, printedExerciseIds, isPrintPicture, PLACEHOLDER_PICTURE,
  readPrintPictures, writePrintPictures, PRINT_PICTURES_KEY,
} from './print-pictures.js'

const S = {
  unit: 'kg', week: {},
  routines: [
    { id: 'a', name: 'A', ex: [{ id: '0025', sets: 3, reps: 5 }, { id: '0027', sets: 3, reps: 8 }] },
    { id: 'b', name: 'B', ex: [{ id: '0027', sets: 3, reps: 8 }, { id: '0289', sets: 3, reps: 10 }] },
  ],
}
const okFetch = () => vi.fn(async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }) }))
const size = (w, h) => async () => ({ width: w, height: h })
const HASH = 'a'.repeat(64)
const PHASH = 'b'.repeat(64)
const custom = (media) => ({ id: 'c_mine', n: 'my move', custom: true, bp: 'chest', ...(media ? { media } : {}) })

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock('./mobile.js') })

describe('printPictureSource', () => {
  it('a catalogue exercise has no picture in this fork: it prints as text', () => {
    expect(printPictureSource(S, '0025')).toBeNull()
    const id = Object.keys(EXIDX).find(k => EXIDX[k].fv)
    expect(printPictureSource({ ...S, exFigure: 'female' }, id)).toBeNull()
  })

  it('a custom exercise prints its poster, a small photo itself, a link or nothing not at all', () => {
    const poster = { hash: PHASH, mime: 'image/webp', size: 2000, width: 480, height: 360 }
    const video = { kind: 'video', hash: HASH, mime: 'video/mp4', size: 5e6, width: 1920, height: 1080, poster }
    const photo = { kind: 'image', hash: HASH, mime: 'image/jpeg', size: 300000, width: 1200, height: 900 }
    const huge = { ...photo, size: 9e6 }
    expect(printPictureSource(S, 'x', { x: custom(video) })).toEqual({ kind: 'custom', file: poster })
    expect(printPictureSource(S, 'x', { x: custom(photo) }).file.hash).toBe(HASH)
    expect(printPictureSource(S, 'x', { x: custom(huge) })).toBeNull()
    expect(printPictureSource(S, 'x', { x: custom() })).toBeNull()
    expect(printPictureSource(S, 'nope')).toBeNull()
  })
})

describe('loadPrintPictures', () => {
  it('catalogue exercises load nothing: no request, no picture', async () => {
    const fetchImpl = okFetch()
    const out = await loadPrintPictures(S, { fetchImpl, decode: size(180, 180) })
    expect(out).toEqual({})
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('lists only one routine\'s exercises for a routine printout', () => {
    expect(printedExerciseIds(S, 'a')).toEqual(['0025', '0027'])
    expect(printedExerciseIds(S).sort()).toEqual(['0025', '0027', '0289'])
  })

  it('stops waiting at the deadline and keeps what came in', async () => {
    const photo = { kind: 'image', hash: HASH, mime: 'image/jpeg', size: 3, width: 100, height: 100 }
    const slow = { kind: 'image', hash: PHASH, mime: 'image/jpeg', size: 3, width: 100, height: 100 }
    const S2 = { ...S, routines: [{ id: 'c', name: 'C', ex: [{ id: 'x', sets: 3, reps: 8 }, { id: 'y', sets: 3, reps: 8 }] }] }
    const store = { get: vi.fn(hash => hash === HASH
      ? Promise.resolve({ blob: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }) })
      : new Promise(() => {})) }
    const out = await loadPrintPictures(S2, { store, fetchImpl: vi.fn(), decode: size(100, 100), timeoutMs: 50, index: { x: custom(photo), y: custom(slow) } })
    expect(Object.keys(out)).toEqual(['x'])
  })

  it('reads a custom photo from the local store, whatever its size in px', async () => {
    const photo = { kind: 'image', hash: HASH, mime: 'image/jpeg', size: 3, width: 1200, height: 900 }
    const S2 = { ...S, routines: [{ id: 'c', name: 'C', ex: [{ id: 'x', sets: 3, reps: 8 }] }] }
    const store = { get: vi.fn(async () => ({ blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) })) }
    const fetchImpl = vi.fn()
    const out = await loadPrintPictures(S2, { store, fetchImpl, decode: size(1200, 900), index: { x: custom(photo) } })
    expect(store.get).toHaveBeenCalledWith(HASH)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(out.x).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('the placeholder fills every exercise that has a picture without loading anything', async () => {
    const photo = { kind: 'image', hash: HASH, mime: 'image/jpeg', size: 3, width: 100, height: 100 }
    const S2 = { ...S, routines: [{ id: 'c', name: 'C', ex: [{ id: 'x', sets: 3, reps: 8 }, { id: '0025', sets: 3, reps: 8 }] }] }
    const fetchImpl = vi.fn()
    const out = await loadPrintPictures(S2, { placeholder: true, fetchImpl, index: { x: custom(photo), '0025': EXIDX['0025'] } })
    // the catalogue exercise has no picture in this fork; the custom one does
    expect(out).toEqual({ x: PLACEHOLDER_PICTURE })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(isPrintPicture(PLACEHOLDER_PICTURE)).toBe(true)
  })
})

describe('the "With pictures" switch', () => {
  it('is on until this device turns it off, and survives storage that throws', () => {
    const mem = new Map()
    const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
    expect(readPrintPictures(storage)).toBe(true)
    writePrintPictures(false, storage)
    expect(mem.get(PRINT_PICTURES_KEY)).toBe('0')
    expect(readPrintPictures(storage)).toBe(false)
    const broken = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
    expect(readPrintPictures(broken)).toBe(true)
    expect(() => writePrintPictures(true, broken)).not.toThrow()
  })

  it('only image data: URLs count as pictures', () => {
    expect(isPrintPicture('data:image/webp;base64,AAA')).toBe(true)
    expect(isPrintPicture('exercise-media/still/x.webp')).toBe(false)
    expect(isPrintPicture('javascript:alert(1)')).toBe(false)
    expect(isPrintPicture('data:text/html,<b>')).toBe(false)
  })
})
