#!/usr/bin/env node
// Confere, no oEmbed do YouTube, se cada vídeo curado (frontend/src/lib/exercise-videos.js) ainda
// existe e pode ser incorporado. Node puro, sem dependências.
//
//   node scripts/videos/verify.mjs [--offline-ok]
//
// Saída: 0 tudo certo (ou mapa vazio), 1 algum vídeo falhou (não-200: removido, privado, sem
// incorporação), 2 sem rede (nenhuma resposta; com --offline-ok vira 0 com aviso, para CI sem rede).
import { pathToFileURL } from 'node:url'

export const oembedUrl = id =>
  'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json'

// Consulta cada id. `fetchImpl` é injetável (testes). Um status diferente de 200 é falha do vídeo;
// uma exceção do fetch (DNS, timeout, sem rede) é falha de rede, que não diz nada sobre o vídeo.
export async function verifyAll(ids, fetchImpl = fetch, { concurrency = 4, timeoutMs = 10000 } = {}) {
  const result = { ok: [], failed: [], network: [] }
  const queue = [...ids]
  const worker = async () => {
    for (let id; (id = queue.shift()) !== undefined;) {
      try {
        const res = await fetchImpl(oembedUrl(id), { signal: AbortSignal.timeout(timeoutMs) })
        if (res.status === 200) result.ok.push(id)
        else result.failed.push({ id, status: res.status })
      } catch (e) {
        result.network.push({ id, error: String(e?.cause?.code || e?.message || e) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, ids.length)) }, worker))
  return result
}

// Código de saída e texto do resumo, separados do I/O para serem testáveis.
export function summarize(ids, r, { offlineOk = false } = {}) {
  if (!ids.length) return { code: 0, lines: ['nenhum vídeo curado'] }
  const lines = [`${ids.length} vídeo(s): ${r.ok.length} ok, ${r.failed.length} com falha, ${r.network.length} sem resposta`]
  for (const f of r.failed) lines.push(`  FALHOU ${f.id}: HTTP ${f.status}`)
  for (const n of r.network) lines.push(`  SEM REDE ${n.id}: ${n.error}`)
  if (r.failed.length) return { code: 1, lines }
  if (r.network.length) {
    lines.push(offlineOk ? 'aviso: sem rede, verificação ignorada (--offline-ok)' : 'sem rede: não foi possível verificar (use --offline-ok em CI sem rede)')
    return { code: offlineOk ? 0 : 2, lines }
  }
  return { code: 0, lines }
}

async function main() {
  const { EXERCISE_VIDEOS } = await import('../../frontend/src/lib/exercise-videos.js')
  const ids = [...new Set(Object.values(EXERCISE_VIDEOS))]
  const { code, lines } = summarize(ids, ids.length ? await verifyAll(ids) : { ok: [], failed: [], network: [] },
    { offlineOk: process.argv.includes('--offline-ok') })
  for (const l of lines) (code === 1 ? console.error : console.log)(l)
  process.exit(code)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
