// Direitos de acesso (Cakto): regras puras, sem servidor e sem relógio.
// Spec §7 e §9: docs/superpowers/specs/2026-11-03-alcateia-app-design.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEvent, processEvent, ingest, isActive, hasAccess, findClaimable, linkUser, grant,
} from '../entitlements.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-10T12:00:00Z');
const at = s => new Date(typeof s === 'number' ? s : Date.parse(s)).toISOString();
const plus = (s, days) => new Date(Date.parse(s) + days * DAY).toISOString();
const order = (over = {}) => ({
  id: 'ord-1', status: 'paid', offer_type: 'main', paidAt: '2026-11-10T11:00:00Z',
  customer: { email: ' Maria@Example.com ', name: 'Maria' },
  product: { id: 'prod-1' }, offer: { id: 'off-m', name: 'Mensal' },
  subscription: { id: 'sub-1', status: 'active', recurrence_period: 30, next_payment_date: '2026-12-10T12:00:00Z' },
  ...over,
});
const ev = (event, data) => ({ event, data });
const opts = { now: NOW, graceDays: 3, plans: {} };
const approved = (over, o = opts) => applyEvent([], ev('purchase_approved', order(over)), o);
const deepFreeze = x => {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); Object.values(x).forEach(deepFreeze); }
  return x;
};

/* ---------- criar / ativar ---------- */

test('purchase_approved cria direito ativo até next_payment_date + carência', () => {
  const list = approved();
  assert.equal(list.length, 1);
  const e = list[0];
  assert.equal(e.email, 'maria@example.com');
  assert.equal(e.status, 'active');
  assert.equal(e.source, 'cakto');
  assert.equal(e.plan, 'mensal');
  assert.equal(e.subscriptionId, 'sub-1');
  assert.equal(e.userId, null);
  assert.equal(e.validUntil, plus('2026-12-10T12:00:00Z', 3));
  assert.equal(e.lastEvent, 'purchase_approved');
  assert.equal(e.createdAt, at(NOW));
  assert.equal(e.updatedAt, at(NOW));
  assert.equal(isActive(e, NOW), true);
});

test('subscription_created também cria/ativa (spec §7.2)', () => {
  const [e] = applyEvent([], ev('subscription_created', order()), opts);
  assert.equal(e.status, 'active');
  assert.equal(e.validUntil, plus('2026-12-10T12:00:00Z', 3));
  assert.equal(e.lastEvent, 'subscription_created');
});

test('sem next_payment_date usa paidAt + dias do plano + carência', () => {
  const [e] = approved({ subscription: { id: 'sub-1', recurrence_period: 90 } });
  assert.equal(e.plan, 'trimestral');
  assert.equal(e.validUntil, plus('2026-11-10T11:00:00Z', 93));
});

test('sem paidAt nem next_payment_date usa o relógio injetado', () => {
  const [e] = approved({ paidAt: undefined, subscription: { id: 'sub-1' } });
  assert.equal(e.plan, 'mensal');
  assert.equal(e.validUntil, plus(at(NOW), 33));
});

test('carência: padrão 3 dias, configurável, inválida volta ao padrão', () => {
  const base = plus('2026-12-10T12:00:00Z', 0);
  assert.equal(approved({}, { now: NOW })[0].validUntil, plus(base, 3));
  assert.equal(approved({}, { now: NOW, graceDays: 0 })[0].validUntil, base);
  assert.equal(approved({}, { now: NOW, graceDays: 7 })[0].validUntil, plus(base, 7));
  for (const bad of [-1, NaN, 'abc', null, Infinity]) {
    assert.equal(approved({}, { now: NOW, graceDays: bad })[0].validUntil, plus(base, 3), String(bad));
  }
});

test('CAKTO_PLANS: oferta vence produto, produto vale sozinho, ambos vencem a recorrência', () => {
  const noNext = { subscription: { id: 'sub-1', recurrence_period: 30 }, paidAt: '2026-11-10T00:00:00Z' };
  const byOffer = approved(noNext, { ...opts, plans: { 'off-m': { plan: 'semestral', days: 180 } } })[0];
  assert.equal(byOffer.plan, 'semestral');
  assert.equal(byOffer.validUntil, plus('2026-11-10T00:00:00Z', 183));

  const byProduct = approved(noNext, { ...opts, plans: { 'prod-1': { plan: 'trimestral', days: 90 } } })[0];
  assert.equal(byProduct.plan, 'trimestral');
  assert.equal(byProduct.validUntil, plus('2026-11-10T00:00:00Z', 93));

  const both = approved(noNext, {
    ...opts, plans: { 'prod-1': { plan: 'trimestral', days: 90 }, 'off-m': { plan: 'semestral', days: 180 } },
  })[0];
  assert.equal(both.plan, 'semestral');
});

test('CAKTO_PLANS malformado cai na recorrência (nunca lança)', () => {
  const noNext = { subscription: { id: 'sub-1', recurrence_period: 90 }, paidAt: '2026-11-10T00:00:00Z' };
  for (const bad of [{ 'off-m': { plan: 'semestral', days: 0 } }, { 'off-m': { plan: 'vip', days: 30 } },
    { 'off-m': 'semestral' }, { 'off-m': null }, null, 'x', [], { constructor: { plan: 'mensal', days: 1 } }]) {
    const [e] = approved(noNext, { ...opts, plans: bad });
    assert.equal(e.plan, 'trimestral', JSON.stringify(bad));
    assert.equal(e.validUntil, plus('2026-11-10T00:00:00Z', 93));
  }
});

test('recorrência 30/90/180 mapeia o plano; outro valor ou ausência vira mensal de 30 dias', () => {
  const run = rp => approved({ subscription: { id: 's' + rp, recurrence_period: rp }, paidAt: '2026-11-10T00:00:00Z' })[0];
  assert.deepEqual([run(30).plan, run(90).plan, run(180).plan], ['mensal', 'trimestral', 'semestral']);
  assert.equal(run(180).validUntil, plus('2026-11-10T00:00:00Z', 183));
  for (const rp of [7, 365, 0, -5, 'x', null, undefined]) {
    const e = run(rp);
    assert.equal(e.plan, 'mensal', String(rp));
    assert.equal(e.validUntil, plus('2026-11-10T00:00:00Z', 33), String(rp));
  }
  assert.equal(run('90').plan, 'trimestral'); // número em texto
});

test('pedido não pago ou order bump não ativa', () => {
  for (const status of ['waiting_payment', 'refused', 'refunded', 'chargedback', 'canceled']) {
    assert.deepEqual(approved({ status }), [], status);
  }
  for (const offer_type of ['orderbump', 'upsell', 'downsell']) {
    assert.deepEqual(approved({ offer_type }), [], offer_type);
  }
  assert.equal(approved({ status: undefined, offer_type: undefined }).length, 1); // campo ausente não bloqueia
});

/* ---------- renovar / retomar / nunca encurtar ---------- */

test('renewed estende e nunca encurta', () => {
  let list = approved();
  const longer = order({ id: 'ord-2', subscription: { id: 'sub-1', next_payment_date: '2027-01-10T12:00:00Z', recurrence_period: 30 } });
  list = applyEvent(list, ev('subscription_renewed', longer), opts);
  assert.equal(list[0].validUntil, plus('2027-01-10T12:00:00Z', 3));
  const shorter = order({ id: 'ord-3', subscription: { id: 'sub-1', next_payment_date: '2026-11-20T12:00:00Z', recurrence_period: 30 } });
  const again = applyEvent(list, ev('subscription_renewed', shorter), opts);
  assert.equal(again[0].validUntil, list[0].validUntil);
  assert.equal(again[0].status, 'active');
});

test('late_recovered e resumed ativam e estendem; retomada sem next_payment_date conta a partir de agora', () => {
  let list = approved({ subscription: { id: 'sub-1', next_payment_date: '2026-11-05T12:00:00Z' }, paidAt: '2026-10-05T00:00:00Z' });
  assert.equal(isActive(list[0], NOW), false); // venceu em 08/11
  list = applyEvent(list, ev('subscription_paused', order({ id: 'p' })), opts);
  assert.equal(list[0].status, 'inactive');

  const noDate = id => order({ id, paidAt: '2026-10-05T00:00:00Z', subscription: { id: 'sub-1', recurrence_period: 30 } });
  const resumed = applyEvent(list, ev('subscription_resumed', noDate('r1')), opts);
  assert.equal(resumed[0].status, 'active');
  assert.equal(resumed[0].validUntil, plus(at(NOW), 33));
  assert.equal(isActive(resumed[0], NOW), true);

  const recovered = applyEvent(list, ev('subscription_late_recovered', noDate('r2')), opts);
  assert.equal(recovered[0].status, 'active');
  assert.equal(recovered[0].validUntil, plus(at(NOW), 33));
});

test('renewed volta a ativar quem estava inativo e limpa o cancelamento', () => {
  let list = approved();
  list = applyEvent(list, ev('subscription_canceled', order({ id: 'c' })), opts);
  assert.equal(list[0].canceled, true);
  list = applyEvent(list, ev('subscription_renewed', order({ id: 'r', subscription: { id: 'sub-1', next_payment_date: '2027-01-10T12:00:00Z' } })), opts);
  assert.equal(list[0].canceled, false);
  assert.equal(list[0].validUntil, plus('2027-01-10T12:00:00Z', 3));
});

test('nova assinatura (compra aprovada) de quem já teve outra é adotada e nunca encurta', () => {
  let list = approved();
  const before = list[0].validUntil;
  const again = order({ id: 'ord-20', subscription: { id: 'sub-NEW', recurrence_period: 30, next_payment_date: '2026-11-15T12:00:00Z' } });
  list = applyEvent(list, ev('purchase_approved', again), opts);
  assert.equal(list.length, 1);
  assert.equal(list[0].subscriptionId, 'sub-NEW');
  assert.equal(list[0].validUntil, before); // 15/11 + 3 d é menor que o que já tinha
});

test('renovação de assinatura antiga não adota nem estende', () => {
  let list = approved();
  list = applyEvent(list, ev('purchase_approved', order({ id: 'n', subscription: { id: 'sub-NEW', next_payment_date: '2026-12-10T12:00:00Z' } })), opts);
  const old = order({ id: 'o', subscription: { id: 'sub-1', next_payment_date: '2030-01-01T00:00:00Z' } });
  const after = applyEvent(list, ev('subscription_renewed', old), opts);
  assert.deepEqual(after, list);
});

test('compra aprovada sobre um direito manual: estende sem encurtar', () => {
  let list = grant([], { email: 'maria@example.com', plan: 'manual', validUntil: '2027-06-01T00:00:00Z' }, NOW);
  list = applyEvent(list, ev('purchase_approved', order()), opts);
  assert.equal(list.length, 1);
  assert.equal(list[0].source, 'cakto');
  assert.equal(list[0].validUntil, at('2027-06-01T00:00:00Z'));
});

/* ---------- sem mudança / cancelar / pausar / bloquear / registrar ---------- */

test('late e renewal_refused não mudam nada (vale a carência)', () => {
  const list = approved();
  for (const name of ['subscription_late', 'subscription_renewal_refused']) {
    const same = applyEvent(list, ev(name, order({ id: 'x-' + name })), opts);
    assert.deepEqual(same, list, name);
    assert.equal(same[0].status, 'active');
  }
});

test('canceled mantém até validUntil, sem estender', () => {
  let list = approved();
  const before = list[0].validUntil;
  const data = order({ id: 'ord-5', subscription: { id: 'sub-1', next_payment_date: '2030-01-01T00:00:00Z' } });
  list = applyEvent(list, ev('subscription_canceled', data), opts);
  assert.equal(list[0].status, 'active');
  assert.equal(list[0].validUntil, before);
  assert.equal(list[0].canceled, true);
  assert.equal(list[0].lastEvent, 'subscription_canceled');
  assert.equal(isActive(list[0], NOW), true);
  assert.equal(isActive(list[0], Date.parse(before) + 1), false); // depois do período pago, acabou
});

test('paused inativa; resumed reativa', () => {
  let list = approved();
  list = applyEvent(list, ev('subscription_paused', order({ id: 'ord-6' })), opts);
  assert.equal(list[0].status, 'inactive');
  assert.equal(isActive(list[0], NOW), false);
  list = applyEvent(list, ev('subscription_resumed', order({ id: 'ord-7' })), opts);
  assert.equal(list[0].status, 'active');
  assert.equal(isActive(list[0], NOW), true);
});

test('refund e chargeback bloqueiam na hora (validUntil = agora)', () => {
  for (const name of ['refund', 'chargeback']) {
    let list = approved();
    list = applyEvent(list, ev(name, order({ id: 'ord-9', status: name === 'refund' ? 'refunded' : 'chargedback' })), opts);
    assert.equal(list[0].status, 'inactive', name);
    assert.equal(list[0].validUntil, at(NOW), name);
    assert.equal(isActive(list[0], NOW), false, name);
    assert.equal(isActive(list[0], NOW + 1000), false, name);
    assert.equal(list[0].lastEvent, name);
  }
});

test('refund_requested, dispute_defense_requested e eventos desconhecidos só registram', () => {
  const list = approved();
  for (const name of ['refund_requested', 'dispute_defense_requested', 'subscription_foo', 'checkout_abandonment']) {
    const later = applyEvent(list, ev(name, order({ id: 'k-' + name })), { ...opts, now: NOW + 5000 });
    assert.equal(later[0].status, 'active', name);
    assert.equal(later[0].validUntil, list[0].validUntil, name);
    assert.equal(later[0].lastEvent, name);
    assert.equal(later[0].updatedAt, at(NOW + 5000));
  }
});

test('evento de e-mail sem direito não cria nada (exceto ativação)', () => {
  for (const name of ['refund', 'chargeback', 'subscription_canceled', 'subscription_paused', 'subscription_late', 'refund_requested', 'foo']) {
    const r = processEvent([], ev(name, order()), opts);
    assert.deepEqual(r.entitlements, [], name);
    assert.equal(r.changed, false, name);
  }
});

test('evento de outra assinatura não derruba a atual', () => {
  const list = approved();
  for (const name of ['refund', 'chargeback', 'subscription_paused', 'subscription_canceled']) {
    const other = order({ id: 'ord-10', subscription: { id: 'sub-OLD', recurrence_period: 30 } });
    const after = applyEvent(list, ev(name, other), opts);
    assert.deepEqual(after, list, name);
  }
});

test('order bump em reembolso não bloqueia o plano principal', () => {
  const list = approved();
  const bump = order({ id: 'b', offer_type: 'orderbump', status: 'refunded' });
  assert.deepEqual(applyEvent(list, ev('refund', bump), opts), list);
});

/* ---------- forma do payload ---------- */

test('data em array (Webhook V2) processa cada pedido', () => {
  const list = applyEvent([], ev('purchase_approved', [order(), order({ id: 'ord-2', customer: { email: 'ana@example.com' } })]), opts);
  assert.deepEqual(list.map(e => e.email).sort(), ['ana@example.com', 'maria@example.com']);
});

test('e-mail com maiúsculas, espaços e acento de largura total vira uma só chave', () => {
  let list = approved({ customer: { email: '  MARIA@Example.COM ' } });
  list = applyEvent(list, ev('subscription_renewed', order({ id: 'r', customer: { email: 'maria@example.com' }, subscription: { id: 'sub-1', next_payment_date: '2027-01-10T12:00:00Z' } })), opts);
  assert.equal(list.length, 1);
  assert.equal(list[0].email, 'maria@example.com');
  assert.equal(list[0].validUntil, plus('2027-01-10T12:00:00Z', 3));
});

test('e-mail inválido ou ausente é ignorado com motivo', () => {
  for (const customer of [{ email: 'nao-e-email' }, {}, null, 'x', { email: 5 }, { email: '' }]) {
    const r = processEvent([], ev('purchase_approved', order({ customer })), opts);
    assert.deepEqual(r.entitlements, []);
    assert.equal(r.changed, false);
    assert.equal(r.reason, 'email-invalid');
  }
});

test('processEvent explica o que aconteceu', () => {
  assert.equal(processEvent([], ev('purchase_approved', order()), opts).changed, true);
  assert.equal(processEvent([], ev('purchase_approved', order()), opts).reason, null);
  assert.equal(processEvent([], ev('purchase_approved', order({ status: 'waiting_payment' })), opts).reason, 'not-paid');
  assert.equal(processEvent([], ev('purchase_approved', order({ offer_type: 'orderbump' })), opts).reason, 'not-main-offer');
  assert.equal(processEvent([], ev('refund', order()), opts).reason, 'no-entitlement');
  const list = approved();
  assert.equal(processEvent(list, ev('subscription_late', order({ id: 'l' })), opts).reason, 'no-effect');
  assert.equal(processEvent(list, ev('refund', order({ subscription: { id: 'sub-OLD' } })), opts).reason, 'other-subscription');
});

/* ---------- entrada malformada nunca lança ---------- */

test('payload malformado: sem exceção, sem mudança, com motivo', () => {
  const list = approved();
  const weird = [
    undefined, null, 0, 'texto', 42, true, [], () => {}, {}, { event: 5, data: order() }, { event: '', data: order() },
    { event: 'purchase_approved' }, { event: 'purchase_approved', data: null }, { event: 'purchase_approved', data: 'x' },
    { event: 'purchase_approved', data: 7 }, { event: 'purchase_approved', data: [] },
    { event: 'purchase_approved', data: [null, undefined, 5, 'x', []] }, { event: 'purchase_approved', data: {} },
    { event: 'purchase_approved', data: { customer: {}, subscription: 'x', offer: 5, product: [] } },
  ];
  for (const payload of weird) {
    let r;
    assert.doesNotThrow(() => { r = processEvent(list, payload, opts); }, String(payload));
    assert.deepEqual(r.entitlements, list);
    assert.equal(r.changed, false);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0, JSON.stringify(payload));
    assert.doesNotThrow(() => applyEvent(list, payload, opts));
    assert.doesNotThrow(() => ingest({ entitlements: list, caktoSeen: [] }, payload, opts));
  }
});

test('lista, db e opções malformados também não lançam', () => {
  for (const bad of [undefined, null, 'x', 5, {}]) {
    let out;
    assert.doesNotThrow(() => { out = applyEvent(bad, ev('purchase_approved', order()), opts); });
    assert.equal(out.length, 1); // lista inválida é tratada como vazia
  }
  for (const o of [undefined, null, 5, 'x', {}, { now: 'ontem' }, { now: NaN, graceDays: {}, plans: 7 }]) {
    assert.doesNotThrow(() => applyEvent([], ev('purchase_approved', order()), o));
  }
  for (const db of [undefined, null, 'x', {}, { entitlements: 'x', caktoSeen: 7 }, { entitlements: [null, 5, 'x'], caktoSeen: [null, 1] }]) {
    let r;
    assert.doesNotThrow(() => { r = ingest(db, ev('purchase_approved', order()), opts); });
    assert.equal(r.entitlements.filter(e => e && e.email === 'maria@example.com').length, 1);
    assert.ok(r.caktoSeen.every(s => typeof s === 'string'));
  }
  assert.doesNotThrow(() => isActive(null, NOW));
  assert.doesNotThrow(() => findClaimable('x', 'a@b.co', NOW));
  assert.doesNotThrow(() => linkUser(undefined, 'a@b.co', 'u1', NOW));
});

test('datas absurdas não lançam RangeError', () => {
  const huge = '+275760-09-13T00:00:00.000Z';
  for (const next_payment_date of [huge, 'ontem', '0000-00-00', 12345, {}, []]) {
    let r;
    assert.doesNotThrow(() => { r = processEvent([], ev('purchase_approved', order({ subscription: { id: 's', next_payment_date } })), opts); }, String(next_payment_date));
    for (const e of r.entitlements) assert.ok(Number.isFinite(Date.parse(e.validUntil)));
  }
  const r = processEvent([], ev('purchase_approved', order({ subscription: { id: 's', next_payment_date: huge } })), opts);
  assert.deepEqual(r.entitlements, []);
  assert.equal(r.reason, 'invalid-date');
  assert.doesNotThrow(() => applyEvent([], ev('purchase_approved', order({ paidAt: huge, subscription: { id: 's' } })), opts));
});

test('getter que lança dentro do payload é contido (webhook responde 200 sempre)', () => {
  const data = order();
  Object.defineProperty(data, 'customer', { get() { throw new Error('boom'); } });
  const list = approved();
  let r;
  assert.doesNotThrow(() => { r = processEvent(list, ev('refund', data), opts); });
  assert.deepEqual(r.entitlements, list);
  assert.equal(r.changed, false);
  assert.equal(r.reason, 'internal-error');
  assert.doesNotThrow(() => ingest({ entitlements: list, caktoSeen: [] }, ev('refund', data), opts));
});

test('não muta a lista, o payload nem as opções', () => {
  const list = deepFreeze(approved());
  const payload = deepFreeze(ev('subscription_renewed', [order({ id: 'r' })]));
  const o = deepFreeze({ ...opts, plans: { 'off-m': { plan: 'mensal', days: 30 } } });
  const out = applyEvent(list, payload, o);
  assert.notEqual(out, list);
  const db = deepFreeze({ entitlements: list, caktoSeen: ['x:1'] });
  assert.doesNotThrow(() => ingest(db, ev('purchase_approved', order({ id: 'z', customer: { email: 'z@z.co' } })), opts));
  assert.doesNotThrow(() => grant(list, { email: 'a@b.co', validUntil: '2027-01-01' }, NOW));
  assert.doesNotThrow(() => linkUser(list, 'maria@example.com', 'u1', NOW));
});

/* ---------- ingest: dedup ---------- */

test('ingest deduplica por evento+id e devolve o que mudou', () => {
  const db = { entitlements: [], caktoSeen: [] };
  const a = ingest(db, ev('purchase_approved', order()), opts);
  assert.equal(a.changed, true);
  assert.deepEqual(a.caktoSeen, ['purchase_approved:ord-1']);
  assert.equal(a.entitlements.length, 1);
  const b = ingest({ entitlements: a.entitlements, caktoSeen: a.caktoSeen }, ev('purchase_approved', order()), opts);
  assert.equal(b.changed, false);
  assert.equal(b.reason, 'duplicate');
  assert.equal(b.entitlements.length, 1);
  assert.deepEqual(b.caktoSeen, a.caktoSeen);
});

test('mesmo id em eventos diferentes não é duplicata', () => {
  let db = { entitlements: [], caktoSeen: [] };
  for (const name of ['purchase_approved', 'subscription_created', 'subscription_renewed']) {
    const r = ingest(db, ev(name, order()), opts);
    assert.equal(r.changed, true, name);
    db = { entitlements: r.entitlements, caktoSeen: r.caktoSeen };
  }
  assert.deepEqual(db.caktoSeen, ['purchase_approved:ord-1', 'subscription_created:ord-1', 'subscription_renewed:ord-1']);
});

test('ingest com array: processa só os pedidos novos e ignora repetido dentro do mesmo envio', () => {
  const first = ingest({ entitlements: [], caktoSeen: [] }, ev('purchase_approved', order()), opts);
  const batch = [order(), order({ id: 'ord-2', customer: { email: 'ana@example.com' } }), order({ id: 'ord-2', customer: { email: 'ana@example.com' } })];
  const r = ingest({ entitlements: first.entitlements, caktoSeen: first.caktoSeen }, ev('purchase_approved', batch), opts);
  assert.equal(r.changed, true);
  assert.deepEqual(r.entitlements.map(e => e.email).sort(), ['ana@example.com', 'maria@example.com']);
  assert.deepEqual(r.caktoSeen, ['purchase_approved:ord-1', 'purchase_approved:ord-2']);
  assert.deepEqual(r.results.map(x => [x.id, x.applied, x.reason]).sort(),
    [['ord-1', false, 'duplicate'], ['ord-2', false, 'duplicate'], ['ord-2', true, null]].sort());
});

test('checkout_abandonment sem data.id é ignorado', () => {
  const db = { entitlements: [], caktoSeen: [] };
  const r = ingest(db, ev('checkout_abandonment', { customer: { email: 'a@b.co' }, product: { id: 'p' } }), opts);
  assert.equal(r.changed, false);
  assert.equal(r.reason, 'no-id');
  assert.deepEqual(r.entitlements, []);
  assert.deepEqual(r.caktoSeen, []);
});

test('ingest guarda só os últimos 500 ids vistos', () => {
  let db = { entitlements: [], caktoSeen: [] };
  for (let i = 0; i < 520; i++) {
    const r = ingest(db, ev('subscription_late', order({ id: 'o' + i })), opts);
    db = { entitlements: r.entitlements, caktoSeen: r.caktoSeen };
  }
  assert.equal(db.caktoSeen.length, 500);
  assert.equal(db.caktoSeen[0], 'subscription_late:o20');
  assert.equal(db.caktoSeen[499], 'subscription_late:o519');
  // um id que já saiu da janela volta a ser processado; um recente não
  assert.equal(ingest(db, ev('subscription_late', order({ id: 'o0' })), opts).changed, true);
  assert.equal(ingest(db, ev('subscription_late', order({ id: 'o519' })), opts).changed, false);
});

test('ingest registra o id mesmo quando o evento não muda direitos', () => {
  const r = ingest({ entitlements: [], caktoSeen: [] }, ev('refund', order()), opts);
  assert.equal(r.changed, true); // caktoSeen mudou: quem chama precisa salvar
  assert.deepEqual(r.entitlements, []);
  assert.deepEqual(r.caktoSeen, ['refund:ord-1']);
  assert.equal(r.reason, 'no-entitlement');
});

test('ids numéricos viram texto na chave de dedup', () => {
  const r = ingest({ entitlements: [], caktoSeen: [] }, ev('purchase_approved', order({ id: 987 })), opts);
  assert.deepEqual(r.caktoSeen, ['purchase_approved:987']);
  assert.equal(ingest({ entitlements: r.entitlements, caktoSeen: r.caktoSeen }, ev('purchase_approved', order({ id: '987' })), opts).changed, false);
});

test('nome do evento é normalizado (caixa e espaços)', () => {
  const r = ingest({ entitlements: [], caktoSeen: [] }, ev(' Purchase_Approved ', order()), opts);
  assert.equal(r.entitlements[0].status, 'active');
  assert.deepEqual(r.caktoSeen, ['purchase_approved:ord-1']);
});

/* ---------- isActive ---------- */

test('isActive: status active e validUntil > agora (igual a agora não vale)', () => {
  const e = { status: 'active', validUntil: at(NOW + 1) };
  assert.equal(isActive(e, NOW), true);
  assert.equal(isActive({ ...e, validUntil: at(NOW) }, NOW), false);
  assert.equal(isActive({ ...e, validUntil: at(NOW - 1) }, NOW), false);
  assert.equal(isActive({ ...e, status: 'inactive' }, NOW), false);
  assert.equal(isActive({ ...e, validUntil: 'lixo' }, NOW), false);
  assert.equal(isActive({ ...e, validUntil: undefined }, NOW), false);
  assert.equal(isActive(null, NOW), false);
  assert.equal(isActive(undefined, NOW), false);
  assert.equal(hasAccess, isActive); // apelido usado no plano
});

/* ---------- cadastro: achar e vincular ---------- */

test('findClaimable: só ativo, vigente e sem dono; e-mail normalizado', () => {
  let list = approved();
  assert.equal(findClaimable(list, ' MARIA@example.com ', NOW).email, 'maria@example.com');
  assert.equal(findClaimable(list, 'outra@example.com', NOW), null);
  assert.equal(findClaimable(list, 'invalido', NOW), null);
  assert.equal(findClaimable(list, undefined, NOW), null);
  assert.equal(findClaimable(list, 'maria@example.com', NOW + 60 * DAY), null); // vencido
  assert.equal(findClaimable(applyEvent(list, ev('refund', order({ id: 'r' })), opts), 'maria@example.com', NOW), null); // inativo
  list = list.map(e => ({ ...e, userId: 'u1' }));
  assert.equal(findClaimable(list, 'maria@example.com', NOW), null); // já reivindicado
});

test('linkUser: grava o userId no direito livre e devolve lista nova', () => {
  const list = approved();
  const r = linkUser(list, 'MARIA@example.com', 'u1', NOW);
  assert.equal(r.entitlement.userId, 'u1');
  assert.equal(r.entitlement.updatedAt, at(NOW));
  assert.equal(r.entitlements[0].userId, 'u1');
  assert.equal(list[0].userId, null); // original intacto
  // segunda tentativa (outra pessoa, mesmo e-mail) não rouba
  const again = linkUser(r.entitlements, 'maria@example.com', 'u2', NOW);
  assert.equal(again.entitlement, null);
  assert.equal(again.entitlements[0].userId, 'u1');
});

test('linkUser: sem direito ativo ou userId inválido não muda nada', () => {
  const list = approved();
  for (const [email, uid, now] of [['outra@example.com', 'u1', NOW], ['maria@example.com', '', NOW], ['maria@example.com', null, NOW],
    ['maria@example.com', 5, NOW], ['maria@example.com', 'u1', NOW + 90 * DAY]]) {
    const r = linkUser(list, email, uid, now);
    assert.equal(r.entitlement, null);
    assert.deepEqual(r.entitlements, list);
  }
});

/* ---------- concessão manual ---------- */

test('grant manual cria com source manual e ativo', () => {
  const list = grant([], { email: 'Lia@Example.com', plan: 'manual', validUntil: '2027-01-01T00:00:00Z' }, NOW);
  assert.equal(list.length, 1);
  assert.equal(list[0].email, 'lia@example.com');
  assert.equal(list[0].source, 'manual');
  assert.equal(list[0].status, 'active');
  assert.equal(list[0].plan, 'manual');
  assert.equal(list[0].subscriptionId, null);
  assert.equal(list[0].userId, null);
  assert.equal(list[0].validUntil, at('2027-01-01T00:00:00Z'));
  assert.equal(list[0].lastEvent, 'manual');
  assert.equal(list[0].createdAt, at(NOW));
  assert.equal(isActive(list[0], NOW), true);
});

test('grant ajusta o direito existente sem perder o userId e sem duplicar', () => {
  let list = linkUser(approved(), 'maria@example.com', 'u1', NOW).entitlements;
  const created = list[0].createdAt;
  list = grant(list, { email: ' MARIA@example.com', plan: 'semestral', validUntil: '2027-05-01T00:00:00Z' }, NOW + 1000);
  assert.equal(list.length, 1);
  assert.equal(list[0].userId, 'u1');
  assert.equal(list[0].createdAt, created);
  assert.equal(list[0].plan, 'semestral');
  assert.equal(list[0].source, 'manual');
  assert.equal(list[0].validUntil, at('2027-05-01T00:00:00Z'));
  assert.equal(list[0].updatedAt, at(NOW + 1000));
});

test('grant pode encurtar ou desativar (decisão do admin)', () => {
  let list = approved();
  list = grant(list, { email: 'maria@example.com', validUntil: '2026-11-12T00:00:00Z' }, NOW);
  assert.equal(list[0].validUntil, at('2026-11-12T00:00:00Z'));
  list = grant(list, { email: 'maria@example.com', validUntil: '2027-01-01T00:00:00Z', status: 'inactive' }, NOW);
  assert.equal(list[0].status, 'inactive');
  assert.equal(isActive(list[0], NOW), false);
});

test('grant com plano omitido usa manual; entradas inválidas lançam erro claro', () => {
  assert.equal(grant([], { email: 'a@b.co', validUntil: '2027-01-01' }, NOW)[0].plan, 'manual');
  assert.throws(() => grant([], { email: 'x', validUntil: '2027-01-01' }, NOW), /e-mail/);
  assert.throws(() => grant([], { email: 'a@b.co', validUntil: 'amanhã' }, NOW), /validade/);
  assert.throws(() => grant([], { email: 'a@b.co' }, NOW), /validade/);
  assert.throws(() => grant([], { email: 'a@b.co', validUntil: '+275760-09-14T00:00:00.000Z' }, NOW), /validade/);
  assert.throws(() => grant([], { email: 'a@b.co', validUntil: '2027-01-01', plan: 'vip' }, NOW), /plano/);
  assert.throws(() => grant([], { email: 'a@b.co', validUntil: '2027-01-01', status: 'talvez' }, NOW), /status/);
  assert.throws(() => grant([], null, NOW), /e-mail/);
  assert.throws(() => grant([], undefined, NOW), /e-mail/);
});
