import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISE_VIDEOS, videoFor } from './exercise-videos.js'
import { EXIDX } from './exercises.js'

const YT_ID = /^[A-Za-z0-9_-]{11}$/
const real = Object.values(EXIDX).find(e => !e.custom)

// O mapa é dado curado (Task C3): os testes de comportamento mexem nele e o restauram.
afterEach(() => { for (const k of Object.keys(EXERCISE_VIDEOS)) if (!saved.has(k)) delete EXERCISE_VIDEOS[k] })
const saved = new Set(Object.keys(EXERCISE_VIDEOS))

describe('mapa de vídeos curados', () => {
  it('todo id é um id de vídeo do YouTube (11 caracteres) e todo exercício existe no catálogo', () => {
    for (const [ex, vid] of Object.entries(EXERCISE_VIDEOS)) {
      expect(vid, ex).toMatch(YT_ID)
      expect(EXIDX[ex], ex).toBeTruthy()
    }
  })
})

describe('videoFor', () => {
  it('devolve o id curado do exercício', () => {
    EXERCISE_VIDEOS[real.id] = 'abcdefghijk'
    expect(videoFor(real)).toBe('abcdefghijk')
    expect(videoFor(EXIDX[real.id])).toBe('abcdefghijk')
  })
  it('devolve null sem vídeo curado, sem exercício ou com entrada que não é exercício', () => {
    expect(videoFor(real)).toBeNull()
    expect(videoFor({ id: '0000-inexistente' })).toBeNull()
    for (const v of [null, undefined, 'abcdefghijk', 42, {}]) expect(videoFor(v)).toBeNull()
  })
  it('não confunde o id do exercício com uma propriedade herdada do objeto', () => {
    expect(videoFor({ id: 'constructor' })).toBeNull()
    expect(videoFor({ id: '__proto__' })).toBeNull()
    expect(videoFor({ id: 'toString' })).toBeNull()
  })
  it('id mal formado no mapa vale como sem vídeo (nunca vira um iframe quebrado)', () => {
    for (const bad of ['curto', 'longo-demais-12', 'com espaço!', 'abc/def?ghi', '', null, 123, ['abcdefghijk']]) {
      EXERCISE_VIDEOS[real.id] = bad
      expect(videoFor(real), String(bad)).toBeNull()
    }
  })
  it('exercício próprio do usuário nunca usa o mapa', () => {
    EXERCISE_VIDEOS['c_meu'] = 'abcdefghijk'
    EXERCISE_VIDEOS[real.id] = 'abcdefghijk'
    expect(videoFor({ id: 'c_meu', custom: true, n: 'Meu exercício' })).toBeNull()
    expect(videoFor({ ...real, custom: true })).toBeNull()
  })
})
