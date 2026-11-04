import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISE_VIDEOS, videoFor } from './exercise-videos.js'
import { EXIDX } from './exercises.js'
import { POOLS } from './plan-generator.js'

const YT_ID = /^[A-Za-z0-9_-]{11}$/
// Um exercício real que NÃO tem vídeo curado: os testes de comportamento mexem nele e o restauram.
const real = Object.values(EXIDX).find(e => !e.custom && !Object.hasOwn(EXERCISE_VIDEOS, e.id))
const curated = { ...EXERCISE_VIDEOS }

afterEach(() => {
  for (const k of Object.keys(EXERCISE_VIDEOS)) if (!Object.hasOwn(curated, k)) delete EXERCISE_VIDEOS[k]
  Object.assign(EXERCISE_VIDEOS, curated)
})

// CSV simples com campos entre aspas (como o gerado na Task C3).
function parseCsv(text) {
  const rows = []
  let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== '\r') cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  const [head, ...body] = rows
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}
const csv = parseCsv(readFileSync(new URL('../../../docs/curadoria-videos.csv', import.meta.url), 'utf8'))
const poolIds = [...new Set(Object.values(POOLS).flatMap(p => Object.values(p).flat()))]

describe('mapa de vídeos curados', () => {
  it('todo id é um id de vídeo do YouTube (11 caracteres) e todo exercício existe no catálogo', () => {
    for (const [ex, vid] of Object.entries(EXERCISE_VIDEOS)) {
      expect(vid, ex).toMatch(YT_ID)
      expect(EXIDX[ex], ex).toBeTruthy()
    }
  })
  it('nenhum vídeo se repete entre exercícios diferentes', () => {
    const vids = Object.values(EXERCISE_VIDEOS)
    expect(new Set(vids).size).toBe(vids.length)
  })
})

describe('planilha de curadoria (docs/curadoria-videos.csv)', () => {
  it('tem uma linha por exercício dos pools dos templates, sem repetir', () => {
    expect(csv.map(r => r.id).sort()).toEqual([...poolIds].sort())
  })
  it('todo exercício do CSV existe no catálogo', () => {
    for (const r of csv) expect(EXIDX[r.id], r.id).toBeTruthy()
  })
  it('status coerente: com vídeo é proposto-verificado-oembed, sem vídeo é sem-video', () => {
    for (const r of csv) {
      if (r.url_escolhida) expect(r.status, r.id).toBe('proposto-verificado-oembed')
      else expect(r.status, r.id).toBe('sem-video')
    }
  })
  it('o CSV e o mapa concordam, exercício por exercício', () => {
    const fromCsv = {}
    for (const r of csv) {
      if (!r.url_escolhida) continue
      const m = /^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/.exec(r.url_escolhida)
      expect(m, `${r.id} ${r.url_escolhida}`).toBeTruthy()
      expect(r.titulo_canal, r.id).toMatch(/\S \| \S/)
      fromCsv[r.id] = m[1]
    }
    expect(EXERCISE_VIDEOS).toEqual(fromCsv)
  })
  it('exercícios sem vídeo caem no botão "Ver como fazer" (videoFor devolve null)', () => {
    for (const r of csv.filter(r => !r.url_escolhida)) expect(videoFor(EXIDX[r.id]), r.id).toBeNull()
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
