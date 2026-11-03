/* scripts/videos/verify.mjs: a lógica (verifyAll, summarize) com fetch injetado, e o programa
   executado como o CI o executa (mapa de produção vazio). Nenhum teste toca a rede. */
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { oembedUrl, summarize, verifyAll } from '../../scripts/videos/verify.mjs'

const script = join(dirname(fileURLToPath(import.meta.url)), '../../scripts/videos/verify.mjs')
const reply = status => async () => ({ status })

describe('verifyAll', () => {
  it('consulta o oEmbed de cada id, com a URL do vídeo codificada', async () => {
    const seen = []
    const r = await verifyAll(['abcdefghijk', 'ZYXWVUTSRQP'], async url => { seen.push(url); return { status: 200 } })
    expect(r).toEqual({ ok: expect.arrayContaining(['abcdefghijk', 'ZYXWVUTSRQP']), failed: [], network: [] })
    expect(seen.sort()).toEqual([oembedUrl('ZYXWVUTSRQP'), oembedUrl('abcdefghijk')].sort())
    expect(oembedUrl('abcdefghijk')).toBe('https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabcdefghijk&format=json')
  })
  it('status diferente de 200 é falha do vídeo', async () => {
    const r = await verifyAll(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'],
      async url => ({ status: url.includes('bbbbbbbbbbb') ? 401 : url.includes('ccccccccccc') ? 404 : 200 }))
    expect(r.ok).toEqual(['aaaaaaaaaaa'])
    expect(r.failed.sort((a, b) => a.id.localeCompare(b.id))).toEqual([{ id: 'bbbbbbbbbbb', status: 401 }, { id: 'ccccccccccc', status: 404 }])
    expect(r.network).toEqual([])
  })
  it('exceção do fetch é falha de rede, não do vídeo', async () => {
    const r = await verifyAll(['aaaaaaaaaaa'], async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }) })
    expect(r).toEqual({ ok: [], failed: [], network: [{ id: 'aaaaaaaaaaa', error: 'ENOTFOUND' }] })
  })
  it('lista vazia não chama o fetch', async () => {
    let calls = 0
    expect(await verifyAll([], async () => { calls++; return { status: 200 } })).toEqual({ ok: [], failed: [], network: [] })
    expect(calls).toBe(0)
  })
  it('respeita o limite de requisições simultâneas', async () => {
    let live = 0, peak = 0
    const slow = async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 5)); live--; return { status: 200 } }
    const ids = Array.from({ length: 10 }, (_, i) => 'id' + String(i).padStart(9, '0'))
    const r = await verifyAll(ids, slow, { concurrency: 3 })
    expect(r.ok.length).toBe(10)
    expect(peak).toBeLessThanOrEqual(3)
  })
})

describe('summarize (código de saída)', () => {
  const ok = { ok: ['a'], failed: [], network: [] }
  it('mapa vazio sai 0 com "nenhum vídeo curado"', () => {
    expect(summarize([], ok)).toEqual({ code: 0, lines: ['nenhum vídeo curado'] })
  })
  it('tudo certo sai 0', () => expect(summarize(['a'], ok).code).toBe(0))
  it('falha de vídeo sai 1 e nomeia o id e o status', () => {
    const s = summarize(['a', 'b'], { ok: ['a'], failed: [{ id: 'b', status: 404 }], network: [] })
    expect(s.code).toBe(1)
    expect(s.lines.join('\n')).toMatch(/b.*404/)
  })
  it('sem rede sai 2, ou 0 com --offline-ok (e avisa)', () => {
    const r = { ok: [], failed: [], network: [{ id: 'a', error: 'ENOTFOUND' }] }
    expect(summarize(['a'], r).code).toBe(2)
    const off = summarize(['a'], r, { offlineOk: true })
    expect(off.code).toBe(0)
    expect(off.lines.join('\n')).toMatch(/--offline-ok/)
  })
  it('falha de vídeo vence a falta de rede dos outros', () => {
    expect(summarize(['a', 'b'], { ok: [], failed: [{ id: 'a', status: 404 }], network: [{ id: 'b', error: 'x' }] }, { offlineOk: true }).code).toBe(1)
  })
})

describe('programa', () => {
  it('com o mapa de produção vazio sai 0 e diz que não há vídeo curado', () => {
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/nenhum vídeo curado/)
  })
})
