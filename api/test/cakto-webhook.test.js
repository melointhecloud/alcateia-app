// api/test/cakto-webhook.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { verifyCakto } from '../cakto-webhook.js'

const SECRET = 'segredo-de-teste'
const NOW = 1_800_000_000
const body = Buffer.from(JSON.stringify({ secret: SECRET, event: 'purchase_approved', data: { id: 'x' } }))
const sign = (ts, raw, key = SECRET) => 'v1=' + crypto.createHmac('sha256', key).update(`${ts}.`).update(raw).digest('hex')
const hdr = (ts, sig) => ({ 'x-cakto-timestamp': String(ts), 'x-cakto-signature': sig })
const check = (over = {}) => verifyCakto({ rawBody: body, secret: SECRET, nowSec: NOW, headers: hdr(NOW, sign(NOW, body)), ...over })

test('assinatura HMAC válida', () => {
  assert.deepEqual(check(), { ok: true, via: 'hmac' })
})
test('corpo bruto como string também vale', () => {
  assert.deepEqual(check({ rawBody: body.toString('utf8') }), { ok: true, via: 'hmac' })
})
test('corpo adulterado (espaço a mais)', () => {
  assert.equal(check({ rawBody: Buffer.from(body.toString() + ' ') }).ok, false)
})
test('corpo adulterado em um único byte', () => {
  const t = Buffer.from(body)
  t[t.length - 3] ^= 1
  assert.equal(check({ rawBody: t }).ok, false)
})
test('corpo re-serializado (JSON.parse + stringify com outra formatação) não vale', () => {
  const pretty = Buffer.from(JSON.stringify(JSON.parse(body.toString()), null, 2))
  assert.equal(check({ rawBody: pretty }).ok, false)
})
test('chave errada', () => {
  assert.equal(check({ headers: hdr(NOW, sign(NOW, body, 'outra')) }).ok, false)
})
test('assinatura feita com outro timestamp', () => {
  assert.equal(check({ headers: hdr(NOW, sign(NOW - 1, body)) }).ok, false)
})
test('timestamp fora de 5 minutos (passado)', () => {
  const old = NOW - 301
  assert.deepEqual(check({ headers: hdr(old, sign(old, body)) }), { ok: false, why: 'stale' })
})
test('timestamp fora de 5 minutos (futuro)', () => {
  const fut = NOW + 301
  assert.deepEqual(check({ headers: hdr(fut, sign(fut, body)) }), { ok: false, why: 'stale' })
})
test('timestamp exatamente no limite de 5 minutos ainda vale', () => {
  const edgeOld = NOW - 300, edgeNew = NOW + 300
  assert.equal(check({ headers: hdr(edgeOld, sign(edgeOld, body)) }).ok, true)
  assert.equal(check({ headers: hdr(edgeNew, sign(edgeNew, body)) }).ok, true)
})
test('timestamp não numérico', () => {
  for (const ts of ['abc', '', ' ', '1e9', '0x10', '-5', '12.5', 'NaN', 'Infinity', String(NOW) + 'abc']) {
    const r = check({ headers: hdr(ts, sign(ts, body)) })
    assert.equal(r.ok, false, `ts=${JSON.stringify(ts)}`)
  }
})
test('cabeçalhos presentes e inválidos NÃO caem para o secret do corpo', () => {
  for (const sig of ['v1=00', 'v1=', 'v1', 'lixo', 'v2=' + 'a'.repeat(64), '=', ',', 'V1=' + 'a'.repeat(64)]) {
    const r = check({ headers: hdr(NOW, sig) })
    assert.equal(r.ok, false, `sig=${sig}`)
  }
})
test('assinatura hex com comprimento diferente, não hex ou vazia nunca lança e rejeita', () => {
  const good = sign(NOW, body).slice(3)
  const variants = [good.slice(0, -2), good + '00', good.slice(0, -1), 'z'.repeat(64), good.slice(0, 63) + 'g', '', 'a']
  for (const v of variants) {
    assert.doesNotThrow(() => check({ headers: hdr(NOW, 'v1=' + v) }))
    assert.equal(check({ headers: hdr(NOW, 'v1=' + v) }).ok, false, `v=${v}`)
  }
})
test('hex em maiúsculas equivale', () => {
  assert.equal(check({ headers: hdr(NOW, 'v1=' + sign(NOW, body).slice(3).toUpperCase()) }).ok, true)
})
test('aceita várias assinaturas separadas por vírgula (transição de versão)', () => {
  assert.equal(check({ headers: hdr(NOW, 'v2=abc, ' + sign(NOW, body)) }).ok, true)
  assert.equal(check({ headers: hdr(NOW, sign(NOW, body, 'velha') + ',' + sign(NOW, body)) }).ok, true)
})
test('várias assinaturas, nenhuma válida', () => {
  assert.equal(check({ headers: hdr(NOW, 'v2=abc, ' + sign(NOW, body, 'velha')) }).ok, false)
})
test('nomes de cabeçalho em outra caixa e valor em lista', () => {
  assert.equal(check({ headers: { 'X-Cakto-Timestamp': String(NOW), 'X-Cakto-Signature': sign(NOW, body) } }).ok, true)
  assert.equal(check({ headers: { 'x-cakto-timestamp': [String(NOW)], 'x-cakto-signature': [sign(NOW, body)] } }).ok, true)
})
test('sem cabeçalhos: aceita o secret do corpo', () => {
  assert.deepEqual(check({ headers: {} }), { ok: true, via: 'secret' })
  assert.deepEqual(check({ headers: undefined }), { ok: true, via: 'secret' })
})
test('sem cabeçalhos e secret errado/ausente no corpo', () => {
  const wrong = Buffer.from(JSON.stringify({ secret: 'x', event: 'e', data: {} }))
  assert.equal(check({ rawBody: wrong, headers: {} }).ok, false)
  assert.equal(check({ rawBody: Buffer.from('{}'), headers: {} }).ok, false)
  assert.equal(check({ rawBody: Buffer.from('nao-json'), headers: {} }).ok, false)
  assert.equal(check({ rawBody: Buffer.from('null'), headers: {} }).ok, false)
  assert.equal(check({ rawBody: Buffer.from('[]'), headers: {} }).ok, false)
  assert.equal(check({ rawBody: Buffer.alloc(0), headers: {} }).ok, false)
})
test('secret do corpo com tamanho diferente ou tipo errado não lança e rejeita', () => {
  for (const s of [SECRET + 'x', SECRET.slice(1), '', 123, null, [SECRET], { a: 1 }, true]) {
    const raw = Buffer.from(JSON.stringify({ secret: s }))
    assert.doesNotThrow(() => check({ rawBody: raw, headers: {} }))
    assert.equal(check({ rawBody: raw, headers: {} }).ok, false, `secret=${JSON.stringify(s)}`)
  }
})
test('só um dos cabeçalhos (ou vazio): rejeita, não cai para o secret do corpo', () => {
  assert.equal(check({ headers: { 'x-cakto-signature': sign(NOW, body) } }).ok, false)
  assert.equal(check({ headers: { 'x-cakto-timestamp': String(NOW) } }).ok, false)
  assert.equal(check({ headers: { 'x-cakto-signature': '', 'x-cakto-timestamp': '' } }).ok, false)
  assert.equal(check({ headers: { 'x-cakto-signature': '' } }).ok, false)
})
test('sem segredo configurado nada passa (HMAC nem secret do corpo)', () => {
  for (const secret of ['', '   ', undefined, null, 0, {}]) {
    assert.equal(check({ secret, headers: {} }).ok, false)
    assert.equal(check({ secret, headers: hdr(NOW, sign(NOW, body, '')) }).ok, false)
    assert.equal(check({ secret, rawBody: Buffer.from('{"secret":""}'), headers: {} }).ok, false)
    assert.equal(check({ secret, rawBody: Buffer.from('{"secret":"undefined"}'), headers: {} }).ok, false)
  }
  assert.deepEqual(check({ secret: '' }), { ok: false, why: 'no-secret' })
})
test('entradas malformadas nunca lançam', () => {
  const bad = [undefined, null, 42, {}, [], () => 1]
  for (const rawBody of bad) assert.doesNotThrow(() => check({ rawBody }))
  for (const rawBody of bad) assert.equal(check({ rawBody }).ok, false)
  assert.doesNotThrow(() => verifyCakto())
  assert.doesNotThrow(() => verifyCakto({}))
  assert.equal(verifyCakto().ok, false)
  assert.equal(check({ headers: 'x' }).ok, true) // sem cabeçalhos legíveis cai no secret do corpo
})
test('nowSec padrão usa o relógio real', () => {
  const ts = Math.floor(Date.now() / 1000)
  assert.equal(verifyCakto({ rawBody: body, secret: SECRET, headers: hdr(ts, sign(ts, body)) }).ok, true)
  const old = ts - 3600
  assert.equal(verifyCakto({ rawBody: body, secret: SECRET, headers: hdr(old, sign(old, body)) }).why, 'stale')
})
