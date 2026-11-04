// Verificação do webhook da Cakto: https://docs.cakto.com.br/conceitos/webhooks
// Função pura (sem I/O, só node:crypto). Quem chama (rota D3) lê o corpo BRUTO antes do JSON.parse e
// responde 401 quando `ok` é false; o motivo (`why`) serve só para log, nunca para a resposta.
//
// 1. Recomendado pela Cakto: X-Cakto-Signature = "v1=" + HMAC-SHA256(chave, "<timestamp>.<corpo bruto>") em hex,
//    com X-Cakto-Timestamp em segundos; vale só dentro de ±5 minutos.
// 2. Sem nenhum dos dois cabeçalhos: o campo "secret" do corpo, comparado em tempo constante com a mesma chave.
// Sem chave configurada (CAKTO_WEBHOOK_SECRET vazio) nada é aceito.
import crypto from 'node:crypto'

const TOLERANCE_S = 5 * 60

const sha256 = (v) => crypto.createHash('sha256').update(v).digest()

// Tempo constante e sem lançar com tamanhos diferentes: compara os resumos SHA-256 (sempre 32 bytes).
const safeEqual = (a, b) => crypto.timingSafeEqual(sha256(String(a)), sha256(String(b)))

// Node entrega os cabeçalhos em minúsculas, mas aceitamos qualquer caixa e valor em lista.
// Devolve undefined quando o cabeçalho não existe e '' quando existe mas não é texto utilizável.
function header(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined
  let v = headers[name]
  if (v === undefined) {
    const k = Object.keys(headers).find((key) => key.toLowerCase() === name)
    v = k === undefined ? undefined : headers[k]
  }
  if (v === undefined) return undefined
  if (Array.isArray(v)) v = v[0]
  return typeof v === 'string' ? v.trim() : ''
}

export function verifyCakto({ rawBody, headers, secret, nowSec } = {}) {
  try {
    if (typeof secret !== 'string' || secret.trim() === '') return { ok: false, why: 'no-secret' }
    const raw = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody
    if (!Buffer.isBuffer(raw) && !(raw instanceof Uint8Array)) return { ok: false, why: 'bad-body' }
    const now = Number.isFinite(nowSec) ? nowSec : Math.floor(Date.now() / 1000)

    const sig = header(headers, 'x-cakto-signature'), ts = header(headers, 'x-cakto-timestamp')
    if (sig !== undefined || ts !== undefined) {
      // Qualquer um dos cabeçalhos presente (mesmo vazio ou sozinho): só o HMAC vale, nunca cai para o secret do corpo.
      if (!sig || !ts) return { ok: false, why: 'bad-headers' }
      if (!/^\d{1,15}$/.test(ts)) return { ok: false, why: 'bad-timestamp' }
      if (Math.abs(now - Number(ts)) > TOLERANCE_S) return { ok: false, why: 'stale' }
      const want = crypto.createHmac('sha256', secret).update(`${ts}.`).update(raw).digest()
      let match = false
      for (const part of sig.split(',')) {
        const s = part.trim()
        if (!s.startsWith('v1=')) continue
        const hex = s.slice(3)
        if (!/^[0-9a-fA-F]{64}$/.test(hex)) continue
        if (crypto.timingSafeEqual(Buffer.from(hex, 'hex'), want)) match = true
      }
      return match ? { ok: true, via: 'hmac' } : { ok: false, why: 'bad-signature' }
    }

    let body
    try { body = JSON.parse(Buffer.from(raw).toString('utf8')) } catch { return { ok: false, why: 'bad-json' } }
    return typeof body?.secret === 'string' && safeEqual(body.secret, secret)
      ? { ok: true, via: 'secret' } : { ok: false, why: 'bad-secret' }
  } catch {
    return { ok: false, why: 'internal-error' }
  }
}
