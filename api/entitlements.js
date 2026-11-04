// Direitos de acesso (Cakto): regras puras, sem I/O. Quem chama (server.js) guarda o resultado
// em db.json. Spec §7: docs/superpowers/specs/2026-11-03-alcateia-app-design.md
//
// Contrato:
// - Nada aqui lê o relógio por conta própria: `now` (ms) entra por parâmetro. Só se faltar (ou for
//   inválido) cai em Date.now(), para o servidor não precisar passá-lo em toda chamada. Os testes
//   sempre injetam.
// - Nada aqui muta as entradas; toda função devolve listas novas.
// - Entrada malformada (webhook com lixo) nunca lança: devolve a lista sem mudança e um `reason`.
//   A única exceção é `grant`, que é entrada do admin e lança Error com mensagem clara.
// - Os campos do payload da Cakto (data.customer.email, data.subscription.id/next_payment_date/
//   recurrence_period, data.offer.id, data.product.id, data.status, data.offer_type, data.paidAt)
//   seguem a documentação; o formato real será confirmado com um evento de teste (D7).
import { normalizeEmail } from './password.js';

const DAY = 86400000;
const SEEN_MAX = 500;
const GRACE_DEFAULT = 3;
const MAX_MS = 8.64e15; // limite de uma Date; além disso toISOString lança RangeError
const PLAN_NAMES = new Set(['mensal', 'trimestral', 'semestral', 'manual']);
const STATUSES = new Set(['active', 'inactive']);

// Ativam (ou estendem). Só estes dois podem adotar uma assinatura nova (outro subscription.id).
const ACTIVATE = new Set(['purchase_approved', 'subscription_created', 'subscription_renewed',
  'subscription_late_recovered', 'subscription_resumed']);
const ADOPT_SUBSCRIPTION = new Set(['purchase_approved', 'subscription_created']);
// Sem payment novo na hora: a contagem sem next_payment_date parte de agora, não do paidAt antigo.
const COUNT_FROM_NOW = new Set(['subscription_late_recovered', 'subscription_resumed']);
const BLOCK_NOW = new Set(['refund', 'chargeback']);
const NO_EFFECT = new Set(['subscription_late', 'subscription_renewal_refused']);
// Lista de negação (não de permissão): campo ausente ou valor desconhecido não pode trancar quem pagou.
const NOT_MAIN_OFFER = new Set(['orderbump', 'order_bump', 'upsell', 'downsell']);
const NOT_PAID = new Set(['waiting_payment', 'pending', 'refused', 'refunded', 'chargedback', 'canceled',
  'cancelled', 'expired', 'abandoned']);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const lower = v => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const inRange = n => Number.isFinite(n) && Math.abs(n) <= MAX_MS;
const iso = n => new Date(n).toISOString();

/** Milissegundos de uma data ISO (texto) ou de um número; null se não for uma data válida. */
function ms(v) {
  const n = typeof v === 'string' ? Date.parse(v) : typeof v === 'number' ? v : NaN;
  return inRange(n) ? n : null;
}

/** id como texto (a Cakto manda texto, mas aceitamos número), ou null. */
function idOf(v) {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function numberOr(v, fallback) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function context(opts) {
  const o = isObj(opts) ? opts : {};
  const now = inRange(o.now) ? o.now : Date.now();
  const grace = numberOr(o.graceDays, GRACE_DEFAULT);
  return { now, graceMs: (grace >= 0 ? grace : GRACE_DEFAULT) * DAY, plans: isObj(o.plans) ? o.plans : {} };
}

/** Plano e duração: CAKTO_PLANS (oferta, depois produto), depois recurrence_period 30/90/180, depois 30 dias. */
function planOf(data, plans) {
  for (const key of [idOf(data.offer?.id), idOf(data.product?.id)]) {
    if (key && Object.hasOwn(plans, key)) {
      const m = plans[key];
      const days = isObj(m) ? numberOr(m.days, 0) : 0;
      if (isObj(m) && PLAN_NAMES.has(m.plan) && days > 0) return { plan: m.plan, days };
    }
  }
  const rp = numberOr(data.subscription?.recurrence_period, 0);
  if (rp === 90) return { plan: 'trimestral', days: 90 };
  if (rp === 180) return { plan: 'semestral', days: 180 };
  return { plan: 'mensal', days: 30 };
}

/** Até quando vale: next_payment_date + carência, ou (paidAt | agora) + dias do plano + carência. */
function validUntilOf(data, event, days, ctx) {
  const next = ms(data.subscription?.next_payment_date);
  if (next != null) return next + ctx.graceMs;
  const paid = ms(data.paidAt);
  const anchor = paid == null ? ctx.now : COUNT_FROM_NOW.has(event) ? Math.max(paid, ctx.now) : paid;
  return anchor + days * DAY + ctx.graceMs;
}

const findIdx = (list, email) => list.findIndex(e => isObj(e) && e.email === email);

/** Aplica um pedido. Devolve { list, reason }; reason é null quando algo foi gravado. */
function applyOne(list, event, data, ctx) {
  if (!isObj(data)) return { list, reason: 'data-invalid' };
  if (NOT_MAIN_OFFER.has(lower(data.offer_type))) return { list, reason: 'not-main-offer' };
  const email = normalizeEmail(data.customer?.email);
  if (!email) return { list, reason: 'email-invalid' };

  const idx = findIdx(list, email);
  const cur = idx >= 0 ? list[idx] : null;
  const subId = idOf(data.subscription?.id);
  const put = rec => {
    const out = list.slice();
    if (idx >= 0) out[idx] = rec; else out.push(rec);
    return { list: out, reason: null };
  };
  const stamp = { lastEvent: event, updatedAt: iso(ctx.now) };

  if (ACTIVATE.has(event)) {
    if (NOT_PAID.has(lower(data.status))) return { list, reason: 'not-paid' };
    // renovação de uma assinatura antiga não adota nem estende a atual
    if (cur?.subscriptionId && subId && cur.subscriptionId !== subId && !ADOPT_SUBSCRIPTION.has(event)) {
      return { list, reason: 'other-subscription' };
    }
    const { plan, days } = planOf(data, ctx.plans);
    const until = validUntilOf(data, event, days, ctx);
    if (!inRange(until)) return { list, reason: 'invalid-date' };
    const keep = ms(cur?.validUntil) ?? 0; // nunca encurta
    return put({
      userId: null, createdAt: iso(ctx.now), ...cur,
      email, source: 'cakto', status: 'active', plan, subscriptionId: subId ?? cur?.subscriptionId ?? null,
      validUntil: iso(Math.max(keep, until)), canceled: false, ...stamp,
    });
  }

  if (!cur) return { list, reason: 'no-entitlement' };
  if (NO_EFFECT.has(event)) return { list, reason: 'no-effect' };
  // um evento de outra assinatura (ex.: reembolso de uma compra antiga) não mexe na atual
  if (cur.subscriptionId && subId && cur.subscriptionId !== subId) return { list, reason: 'other-subscription' };

  if (BLOCK_NOW.has(event)) return put({ ...cur, status: 'inactive', validUntil: iso(ctx.now), ...stamp });
  if (event === 'subscription_paused') return put({ ...cur, status: 'inactive', ...stamp });
  if (event === 'subscription_canceled') return put({ ...cur, canceled: true, ...stamp }); // mantém o período pago
  return put({ ...cur, ...stamp }); // refund_requested, dispute_defense_requested e demais: só registra
}

function runEvent(list, payload, ctx) {
  const entitlements = Array.isArray(list) ? list : [];
  const none = reason => ({ entitlements, changed: false, results: [], reason });
  if (!isObj(payload)) return none('payload-invalid');
  const event = lower(payload.event);
  if (!event) return none('event-missing');
  if (payload.data == null) return none('data-missing');
  const orders = Array.isArray(payload.data) ? payload.data : [payload.data];
  if (!orders.length) return none('data-missing');

  let cur = entitlements;
  const results = [];
  for (const data of orders) {
    const r = applyOne(cur, event, data, ctx);
    cur = r.list;
    results.push({ id: idOf(data?.id), applied: r.reason === null, reason: r.reason });
  }
  const applied = results.some(r => r.applied);
  return {
    entitlements: applied ? cur : entitlements, changed: applied, results,
    reason: applied ? null : results[0].reason,
  };
}

/**
 * Aplica um evento da Cakto (`{ event, data }`, `data` objeto ou array) à lista de direitos.
 * Devolve { entitlements, changed, results: [{ id, applied, reason }], reason }. `reason` é null
 * quando algo foi gravado; senão diz por que nada mudou. Nunca lança.
 * opts: { now (ms), graceDays (padrão 3), plans (CAKTO_PLANS já convertido de JSON) }.
 */
export function processEvent(list, payload, opts) {
  const base = Array.isArray(list) ? list : [];
  try {
    return runEvent(list, payload, context(opts));
  } catch {
    return { entitlements: base, changed: false, results: [], reason: 'internal-error' };
  }
}

/** Igual a processEvent, mas devolve só a lista nova de direitos. */
export const applyEvent = (list, payload, opts) => processEvent(list, payload, opts).entitlements;

/**
 * Deduplica por "<evento>:<data.id>" (últimos 500) e aplica só os pedidos novos.
 * db = { entitlements, caktoSeen }. Devolve { entitlements, caktoSeen, changed, reason, results };
 * `changed` é true quando há algo a salvar (direitos ou ids vistos). Pedido sem data.id
 * (checkout_abandonment) é ignorado. Nunca lança.
 */
export function ingest(db, payload, opts) {
  const src = isObj(db) ? db : {};
  const entitlements = Array.isArray(src.entitlements) ? src.entitlements : [];
  const seenList = Array.isArray(src.caktoSeen) ? src.caktoSeen.filter(s => typeof s === 'string') : [];
  const unchanged = (reason, results = []) => ({ entitlements, caktoSeen: seenList, changed: false, reason, results });
  try {
    if (!isObj(payload)) return unchanged('payload-invalid');
    const event = lower(payload.event);
    if (!event) return unchanged('event-missing');
    if (payload.data == null) return unchanged('data-missing');
    const orders = Array.isArray(payload.data) ? payload.data : [payload.data];
    if (!orders.length) return unchanged('data-missing');

    const seen = new Set(seenList);
    const fresh = [];
    const keys = [];
    const skipped = [];
    for (const data of orders) {
      const id = isObj(data) ? idOf(data.id) : null;
      if (!isObj(data)) skipped.push({ id: null, applied: false, reason: 'data-invalid' });
      else if (!id) skipped.push({ id: null, applied: false, reason: 'no-id' });
      else if (seen.has(`${event}:${id}`)) skipped.push({ id, applied: false, reason: 'duplicate' });
      else { seen.add(`${event}:${id}`); keys.push(`${event}:${id}`); fresh.push(data); }
    }
    if (!fresh.length) return unchanged(skipped[0].reason, skipped);

    const r = processEvent(entitlements, { event, data: fresh }, opts);
    return {
      entitlements: r.entitlements,
      caktoSeen: [...seenList, ...keys].slice(-SEEN_MAX),
      changed: true,
      reason: r.reason,
      results: [...skipped, ...r.results],
    };
  } catch {
    return unchanged('internal-error');
  }
}

/** Acesso ativo = status 'active' e validUntil > agora (igual a agora já não vale). Falha fechado. */
export function isActive(ent, now = Date.now()) {
  if (!isObj(ent) || ent.status !== 'active') return false;
  const until = ms(ent.validUntil);
  return until != null && until > now;
}
/** Apelido de isActive (nome usado no plano). */
export const hasAccess = isActive;

/** O direito que uma pessoa pode reivindicar ao se cadastrar com este e-mail (ativo, vigente, sem dono), ou null. */
export function findClaimable(list, rawEmail, now = Date.now()) {
  const email = normalizeEmail(rawEmail);
  if (!email || !Array.isArray(list)) return null;
  return list.find(e => isObj(e) && e.email === email && !e.userId && isActive(e, now)) || null;
}

/**
 * Vincula o userId ao direito livre daquele e-mail. Devolve { entitlements, entitlement }:
 * `entitlement` é o registro vinculado, ou null (e a lista segue igual) se não havia direito
 * ativo e sem dono, ou se o userId é inválido. Nunca lança.
 */
export function linkUser(list, rawEmail, userId, now = Date.now()) {
  const entitlements = Array.isArray(list) ? list : [];
  const uid = typeof userId === 'string' ? userId.trim() : '';
  const found = uid ? findClaimable(entitlements, rawEmail, now) : null;
  if (!found) return { entitlements, entitlement: null };
  const entitlement = { ...found, userId: uid, updatedAt: iso(inRange(now) ? now : Date.now()) };
  return { entitlements: entitlements.map(e => (e === found ? entitlement : e)), entitlement };
}

/**
 * Concessão manual do admin: cria ou ajusta o direito do e-mail (substitui plano, validade e status;
 * pode encurtar ou desativar). Mantém userId, createdAt e subscriptionId do registro existente.
 * Entrada do admin, então lança Error com mensagem clara quando inválida.
 */
export function grant(list, input, now = Date.now()) {
  const { email: rawEmail, plan, validUntil, status = 'active' } = isObj(input) ? input : {};
  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error('e-mail inválido');
  const until = ms(validUntil);
  if (until == null) throw new Error('validade inválida');
  if (plan != null && !PLAN_NAMES.has(plan)) throw new Error('plano inválido');
  if (!STATUSES.has(status)) throw new Error('status inválido');
  const at = inRange(now) ? now : Date.now();
  const entitlements = Array.isArray(list) ? list : [];
  const idx = findIdx(entitlements, email);
  const cur = idx >= 0 ? entitlements[idx] : null;
  const rec = {
    userId: null, subscriptionId: null, createdAt: iso(at), ...cur,
    email, status, source: 'manual', plan: plan ?? cur?.plan ?? 'manual', validUntil: iso(until),
    lastEvent: 'manual', updatedAt: iso(at),
  };
  const out = entitlements.slice();
  if (idx >= 0) out[idx] = rec; else out.push(rec);
  return out;
}
