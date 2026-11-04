/* Task D3: the Cakto webhook, sign-up by purchase e-mail, the 402 and `access` on the profile.
   Real server.js in a child process, like server-admin-state.test.js. Everything here sits behind
   ACCESS_MODE=subscription; the last group checks that with it off the server is the upstream one. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const HOOK_SECRET = 'segredo-de-teste';
const PW = 'Cobalto-Tigre-4721-vela';
const EMAIL = 'aluna@example.com';
const ADMIN = 'u_adm_1', OLD = 'u_old_1';

function mintSession(uid) {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return payload + '.' + crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}
const cookieOf = uid => ({ Cookie: `gymsid=${mintSession(uid)}` });

const order = (over = {}) => ({
  id: 'ord-1', status: 'paid', offer_type: 'main', paidAt: new Date().toISOString(),
  customer: { email: EMAIL, name: 'Aluna' },
  product: { id: 'prod-1' }, offer: { id: 'off-m', name: 'Mensal' },
  subscription: { id: 'sub-1', status: 'active', recurrence_period: 30, next_payment_date: new Date(Date.now() + 30 * 86400000).toISOString() },
  ...over,
});
const ev = (event, data, extra = {}) => ({ event, data, secret: HOOK_SECRET, ...extra });

async function startServer(t, { env = {}, db } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-access-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SESSION_SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(db || {
    users: [
      { id: ADMIN, name: 'Adminna', created: new Date().toISOString(), admin: true },
      { id: OLD, name: 'Antiga', created: new Date().toISOString() }
    ], creds: [], subs: [], invites: []
  }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost',
      PASSWORD_LOGIN: '1', ACCESS_MODE: 'subscription', CAKTO_WEBHOOK_SECRET: HOOK_SECRET,
      ACCESS_GRACE_DAYS: '3', RENEW_URL: 'https://pay.cakto.com.br/xyz', INVITE_ONLY: '', ...env
    }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.port = await boundPort(child, () => h.log);
  h.api = `http://127.0.0.1:${h.port}`;
  h.raw = async (method, p, { body, headers = {} } = {}) => {
    const r = await fetch(h.api + p, { method, headers, body });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, body: json, text, headers: r.headers };
  };
  h.req = (method, p, { body, headers = {}, uid } = {}) => h.raw(method, p, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(uid ? cookieOf(uid) : {}), ...headers }
  });
  h.hook = (payload, { secretInBody = true } = {}) => {
    const p = secretInBody ? payload : (({ secret, ...rest }) => rest)(payload);
    return h.req('POST', '/api/hooks/cakto', { body: p });
  };
  h.signed = (rawText, { ts = Math.floor(Date.now() / 1000), key = HOOK_SECRET, contentType = 'application/json' } = {}) => {
    const sig = 'v1=' + crypto.createHmac('sha256', key).update(`${ts}.`).update(rawText).digest('hex');
    return h.raw('POST', '/api/hooks/cakto', {
      body: rawText,
      headers: { 'Content-Type': contentType, 'X-Cakto-Timestamp': String(ts), 'X-Cakto-Signature': sig }
    });
  };
  h.stackFrames = () => h.log.split('\n').filter(l => /^\s+at /.test(l)).length;
  h.db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  h.register = (over = {}) => h.req('POST', '/api/register/password', { body: { name: 'Aluna', password: PW, email: EMAIL, ...over } });
  h.put = uid => h.req('PUT', '/api/data', { uid, body: { state: { workouts: [], routines: [], unit: 'kg' } } });
  return h;
}
const buy = (h, over, eventName = 'purchase_approved') => h.hook(ev(eventName, order(over)));
const cookieFrom = r => (r.headers.get('set-cookie') || '').split(';')[0];

/* ---------- webhook ---------- */

test('webhook: sem assinatura nem secret no corpo responde 401 e nada é gravado', async t => {
  const h = await startServer(t);
  const r = await h.req('POST', '/api/hooks/cakto', { body: { event: 'purchase_approved', data: order() } });
  assert.equal(r.status, 401);
  assert.deepEqual(h.db().entitlements || [], []);
});

test('webhook: secret errado no corpo responde 401', async t => {
  const h = await startServer(t);
  const r = await h.req('POST', '/api/hooks/cakto', { body: { ...ev('purchase_approved', order()), secret: 'outro' } });
  assert.equal(r.status, 401);
  assert.deepEqual(h.db().entitlements || [], []);
});

test('webhook: secret correto e compra aprovada gravam 1 direito ativo; o repetido continua sendo 1 (dedup)', async t => {
  const h = await startServer(t);
  const r = await buy(h);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  let d = h.db();
  assert.equal(d.entitlements.length, 1);
  assert.equal(d.entitlements[0].email, EMAIL);
  assert.equal(d.entitlements[0].status, 'active');
  assert.deepEqual(d.caktoSeen, ['purchase_approved:ord-1']);
  const again = await buy(h);
  assert.equal(again.status, 200);
  d = h.db();
  assert.equal(d.entitlements.length, 1);
  assert.deepEqual(d.caktoSeen, ['purchase_approved:ord-1']);
});

test('webhook: assinatura HMAC válida vale; timestamp velho, chave errada e corpo adulterado dão 401', async t => {
  const h = await startServer(t);
  const raw = JSON.stringify({ event: 'purchase_approved', data: order() });
  assert.equal((await h.signed(raw, { ts: Math.floor(Date.now() / 1000) - 3600 })).status, 401);
  assert.equal((await h.signed(raw, { key: 'chave-errada' })).status, 401);
  // assinado com um corpo e enviado outro
  const sig = 'v1=' + crypto.createHmac('sha256', HOOK_SECRET).update(`${Math.floor(Date.now() / 1000)}.`).update(raw).digest('hex');
  const tampered = await h.raw('POST', '/api/hooks/cakto', {
    body: raw + ' ', headers: { 'Content-Type': 'application/json', 'X-Cakto-Timestamp': String(Math.floor(Date.now() / 1000)), 'X-Cakto-Signature': sig }
  });
  assert.equal(tampered.status, 401);
  assert.deepEqual(h.db().entitlements || [], []);
  const ok = await h.signed(raw);
  assert.equal(ok.status, 200);
  assert.equal(h.db().entitlements.length, 1);
});

test('webhook: a assinatura é conferida sobre os bytes exatos, não sobre o JSON reserializado', async t => {
  const h = await startServer(t);
  const raw = `{ "event" : "purchase_approved",\n  "data": ${JSON.stringify(order())} }`;
  const r = await h.signed(raw);
  assert.equal(r.status, 200);
  assert.equal(h.db().entitlements.length, 1);
});

test('webhook: evento ignorado, sem data.id ou desconhecido responde 200 e nada muda', async t => {
  const h = await startServer(t);
  for (const payload of [
    ev('checkout_abandonment', { customer: { email: EMAIL } }),
    ev('algum_evento_novo', order({ id: 'ord-9' })),
    ev('refund', order({ id: 'ord-8' })),               // reembolso de quem nunca comprou
    ev('purchase_approved', null),
    ev('purchase_approved', []),
    ev('purchase_approved', order({ customer: { email: 'isto-nao-e-email' } })),
    { event: 'purchase_approved', secret: HOOK_SECRET },
    { secret: HOOK_SECRET }
  ]) {
    const r = await h.hook(payload);
    assert.equal(r.status, 200, JSON.stringify(payload).slice(0, 80));
    assert.deepEqual(r.body, { ok: true });
  }
  assert.deepEqual(h.db().entitlements || [], []);
});

test('webhook: com assinatura válida, corpo malformado ou de outro tipo ainda responde 200 (nunca 4xx/5xx por conteúdo)', async t => {
  const h = await startServer(t);
  for (const raw of ['{isto não é json', '', '[1,2,3]', 'null', '"texto"', '42', '{"event":{"x":1},"data":7}']) {
    const r = await h.signed(raw);
    assert.equal(r.status, 200, `corpo ${JSON.stringify(raw)}`);
    assert.deepEqual(r.body, { ok: true });
  }
  // mesmo com outro Content-Type: a assinatura é a credencial
  const r = await h.signed(JSON.stringify({ event: 'purchase_approved', data: order() }), { contentType: 'text/plain' });
  assert.equal(r.status, 200);
  assert.equal(h.db().entitlements.length, 1);
  assert.equal(h.stackFrames(), 0, 'nenhum stack trace no log');
});

test('webhook: data em array (Webhook V2) cria um direito por pedido', async t => {
  const h = await startServer(t);
  const r = await h.hook(ev('purchase_approved', [order({ id: 'a' }), order({ id: 'b', customer: { email: 'outra@example.com' }, subscription: { id: 'sub-2', recurrence_period: 90 } })]));
  assert.equal(r.status, 200);
  assert.deepEqual(h.db().entitlements.map(e => e.email).sort(), [EMAIL, 'outra@example.com']);
});

test('webhook: sem CAKTO_WEBHOOK_SECRET configurado a rota recusa tudo com 401', async t => {
  const h = await startServer(t, { env: { CAKTO_WEBHOOK_SECRET: '' } });
  for (const body of [ev('purchase_approved', order(), { secret: '' }), ev('purchase_approved', order(), { secret: undefined }), { event: 'purchase_approved', data: order() }]) {
    const r = await h.req('POST', '/api/hooks/cakto', { body });
    assert.equal(r.status, 401);
  }
  // nem uma assinatura feita com chave vazia
  assert.equal((await h.signed(JSON.stringify({ event: 'purchase_approved', data: order() }), { key: '' })).status, 401);
  assert.deepEqual(h.db().entitlements || [], []);
});

test('webhook: não exige cookie, CSRF nem Origin: a assinatura é a credencial (e sem ela o erro é 401, não 403)', async t => {
  const h = await startServer(t);
  const hostile = { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' };
  const raw = JSON.stringify({ event: 'purchase_approved', data: order() });
  const unsigned = await h.req('POST', '/api/hooks/cakto', { body: JSON.parse(raw), headers: hostile });
  assert.equal(unsigned.status, 401);
  assert.equal(unsigned.body.code, undefined);
  const ts = Math.floor(Date.now() / 1000);
  const sig = 'v1=' + crypto.createHmac('sha256', HOOK_SECRET).update(`${ts}.`).update(raw).digest('hex');
  const signed = await h.raw('POST', '/api/hooks/cakto', {
    body: raw, headers: { 'Content-Type': 'application/json', 'X-Cakto-Timestamp': String(ts), 'X-Cakto-Signature': sig, ...hostile }
  });
  assert.equal(signed.status, 200);
});

test('webhook: corpo grande demais é recusado com 413 e nada é gravado', async t => {
  const h = await startServer(t);
  const r = await h.raw('POST', '/api/hooks/cakto', { body: JSON.stringify({ event: 'x', secret: HOOK_SECRET, pad: 'a'.repeat(1.2 * 1024 * 1024) }), headers: { 'Content-Type': 'application/json' } });
  assert.equal(r.status, 413);
  assert.deepEqual(h.db().entitlements || [], []);
});

test('webhook: o log não traz corpo, e-mail nem segredo', async t => {
  const h = await startServer(t);
  await buy(h);
  await h.req('POST', '/api/hooks/cakto', { body: { event: 'purchase_approved', data: order({ id: 'zz' }), secret: 'palpite-' + EMAIL } });
  await h.signed('{lixo');
  assert.ok(h.log.includes('cakto'), 'registra o mínimo');
  assert.ok(!h.log.includes(EMAIL), 'e-mail no log');
  assert.ok(!h.log.includes(HOOK_SECRET), 'segredo no log');
  assert.ok(!h.log.includes('palpite'), 'corpo no log');
});

test('CAKTO_PLANS inválido não derruba o servidor: avisa uma vez e cai na recorrência do evento', async t => {
  const h = await startServer(t, { env: { CAKTO_PLANS: '{isto não é json' } });
  assert.equal((await buy(h)).status, 200);
  assert.equal((await buy(h, { id: 'ord-2', customer: { email: 'b@example.com' } })).status, 200);
  assert.equal(h.db().entitlements.length, 2);
  assert.equal(h.log.split('CAKTO_PLANS').length - 1, 1, 'um aviso só');
});

test('CAKTO_PLANS válido escolhe o plano pela oferta', async t => {
  const h = await startServer(t, { env: { CAKTO_PLANS: JSON.stringify({ 'off-m': { plan: 'semestral', days: 180 } }) } });
  await buy(h, { subscription: undefined });
  const e = h.db().entitlements[0];
  assert.equal(e.plan, 'semestral');
  assert.ok(Date.parse(e.validUntil) > Date.now() + 170 * 86400000);
});

/* ---------- cadastro ---------- */

test('cadastro com direito ativo: 200, e-mail no perfil e userId no direito', async t => {
  const h = await startServer(t);
  await buy(h);
  const r = await h.register({ email: '  Aluna@Example.COM ' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.user.name, 'Aluna');
  assert.equal(r.body.user.access.active, true);
  const d = h.db();
  const user = d.users.find(u => u.name === 'Aluna');
  assert.equal(user.email, EMAIL);
  assert.equal(d.entitlements[0].userId, user.id);
});

test('cadastro sem e-mail: 400 code email; e-mail que não é e-mail: 400 email-invalid', async t => {
  const h = await startServer(t);
  await buy(h);
  for (const email of [undefined, '', '   ']) {
    const r = await h.register({ email });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'email');
  }
  const bad = await h.register({ email: 'sem-arroba' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'email-invalid');
  assert.equal(h.db().users.length, 2);
});

test('cadastro sem compra: 403 no-subscription, com a mesma resposta para e-mail inexistente, inativo, vencido e já usado', async t => {
  const h = await startServer(t);
  await buy(h, { id: 'o1', customer: { email: 'usada@example.com' } });
  assert.equal((await h.register({ name: 'Primeira', email: 'usada@example.com' })).status, 200);
  await buy(h, { id: 'o2', customer: { email: 'reembolsada@example.com' }, subscription: { id: 's2' } });
  await h.hook(ev('refund', order({ id: 'o2r', customer: { email: 'reembolsada@example.com' }, subscription: { id: 's2' } })));
  // vencido: direito manual com validade no passado
  const admin = await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'vencida@example.com', plan: 'manual', validUntil: new Date(Date.now() - 86400000).toISOString() } });
  assert.equal(admin.status, 200, admin.text);

  const answers = [];
  for (const email of ['nunca@example.com', 'reembolsada@example.com', 'vencida@example.com', 'usada@example.com', 'USADA@example.com']) {
    const r = await h.register({ name: 'Outra', email });
    answers.push({ status: r.status, body: r.body });
  }
  for (const a of answers) {
    assert.equal(a.status, 403);
    assert.deepEqual(a.body, { error: 'não encontramos uma assinatura ativa para este e-mail', code: 'no-subscription' });
  }
  assert.equal(h.db().users.length, 3, 'só admin, antiga e a primeira');
});

test('segundo cadastro com o mesmo e-mail falha (direito já reivindicado)', async t => {
  const h = await startServer(t);
  await buy(h);
  assert.equal((await h.register()).status, 200);
  const second = await h.register({ name: 'Intrusa' });
  assert.equal(second.status, 403);
  assert.equal(second.body.code, 'no-subscription');
});

test('corrida: dois cadastros simultâneos com o mesmo e-mail criam um perfil só', async t => {
  const h = await startServer(t);
  await buy(h);
  const rs = await Promise.all([h.register({ name: 'Ana' }), h.register({ name: 'Bia' }), h.register({ name: 'Cris' })]);
  assert.deepEqual(rs.map(r => r.status).sort(), [200, 403, 403]);
  const d = h.db();
  assert.equal(d.users.filter(u => u.email === EMAIL).length, 1);
  assert.equal(d.entitlements[0].userId, d.users.find(u => u.email === EMAIL).id);
});

test('cadastro: INVITE_ONLY=1 do ambiente não atrapalha quem tem assinatura (quem decide é o direito)', async t => {
  const h = await startServer(t, { env: { INVITE_ONLY: '1' } });
  await buy(h);
  const r = await h.register();
  assert.equal(r.status, 200, r.text);
});

test('cadastro por convite (caso manual): vale sem direito, queima o convite, mas o acesso segue inativo até o admin liberar', async t => {
  const h = await startServer(t);
  const inv = await h.req('POST', '/api/admin/invites/new', { uid: ADMIN, body: {} });
  const code = inv.body.invite.code;
  const r = await h.register({ name: 'Manual', email: 'manual@example.com', code });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.user.access.active, false);
  assert.ok(h.db().invites[0].usedBy);
  const again = await h.register({ name: 'Manual2', email: 'manual2@example.com', code });
  assert.equal(again.status, 403);
  const put = await h.req('PUT', '/api/data', { headers: { Cookie: cookieFrom(r) }, body: { state: { workouts: [], routines: [] } } });
  assert.equal(put.status, 402);
});

test('cadastro com direito ativo do mesmo e-mail e convite inválido: o direito basta', async t => {
  const h = await startServer(t);
  await buy(h);
  const r = await h.register({ code: 'NAOEXISTE' });
  assert.equal(r.status, 200, r.text);
});

test('cadastro: as tentativas negadas contam no limitador do endereço', async t => {
  const h = await startServer(t);
  let last;
  for (let i = 0; i < 25; i++) last = await h.register({ name: 'N' + i, email: `x${i}@example.com` });
  assert.equal(last.status, 429);
});

test('cadastro passkey (register/options) fica fechado sem convite com ACCESS_MODE', async t => {
  const h = await startServer(t);
  const r = await h.req('POST', '/api/register/options', { body: { name: 'Qualquer' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'invite');
});

/* ---------- bloqueio e perfil ---------- */

test('PUT /api/data: 402 sem direito; 200 com direito ativo; GET segue funcionando', async t => {
  const h = await startServer(t);
  const none = await h.put(OLD);
  assert.equal(none.status, 402);
  assert.deepEqual(none.body, { error: 'subscription inactive', code: 'subscription-inactive', renewUrl: 'https://pay.cakto.com.br/xyz' });
  assert.equal((await h.req('GET', '/api/data', { uid: OLD })).status, 200);

  await buy(h);
  const reg = await h.register();
  const cookie = { Cookie: cookieFrom(reg) };
  const ok = await h.req('PUT', '/api/data', { headers: cookie, body: { state: { workouts: [], routines: [], unit: 'kg' } } });
  assert.equal(ok.status, 200, ok.text);
});

test('admin nunca recebe 402, mesmo sem direito', async t => {
  const h = await startServer(t);
  const r = await h.put(ADMIN);
  assert.equal(r.status, 200, r.text);
  const me = await h.req('GET', '/api/me', { uid: ADMIN });
  assert.equal(me.body.user.access.active, true);
});

test('reembolso bloqueia na hora e a renovação reativa', async t => {
  const h = await startServer(t);
  await buy(h);
  const reg = await h.register();
  const cookie = { Cookie: cookieFrom(reg) };
  const put = () => h.req('PUT', '/api/data', { headers: cookie, body: { state: { workouts: [], routines: [], unit: 'kg' } } });
  assert.equal((await put()).status, 200);

  assert.equal((await h.hook(ev('refund', order()))).status, 200);
  const blocked = await put();
  assert.equal(blocked.status, 402);
  assert.equal(blocked.body.code, 'subscription-inactive');
  assert.equal((await h.req('GET', '/api/data', { headers: cookie })).status, 200);
  const me = await h.req('GET', '/api/me', { headers: cookie });
  assert.equal(me.body.user.access.active, false);

  // renovação (id novo): reativa e o perfil volta a salvar
  assert.equal((await h.hook(ev('subscription_renewed', order({ id: 'ord-2' })))).status, 200);
  assert.equal((await put()).status, 200);
  assert.equal((await h.req('GET', '/api/me', { headers: cookie })).body.user.access.active, true);
});

test('GET /api/me traz access { active, plan, validUntil }', async t => {
  const h = await startServer(t);
  await buy(h);
  const reg = await h.register();
  const me = await h.req('GET', '/api/me', { headers: { Cookie: cookieFrom(reg) } });
  const a = me.body.user.access;
  assert.equal(a.active, true);
  assert.equal(a.plan, 'mensal');
  assert.ok(Date.parse(a.validUntil) > Date.now());
  const old = await h.req('GET', '/api/me', { uid: OLD });
  assert.deepEqual(old.body.user.access, { active: false, plan: null, validUntil: null });
});

test('o e-mail do perfil não dá acesso por conta própria: só o userId do direito vale', async t => {
  const h = await startServer(t, { db: { users: [
    { id: ADMIN, name: 'Adminna', created: '2026-01-01T00:00:00Z', admin: true },
    { id: OLD, name: 'Antiga', created: '2026-01-01T00:00:00Z', email: EMAIL }
  ], creds: [], subs: [], invites: [] } });
  await buy(h);                                    // direito livre do mesmo e-mail
  assert.equal((await h.put(OLD)).status, 402);
});

test('/api/config expõe access_mode e renew_url só com ACCESS_MODE ligado', async t => {
  const on = await startServer(t);
  const c = await on.req('GET', '/api/config');
  assert.equal(c.body.access_mode, 'subscription');
  assert.equal(c.body.renew_url, 'https://pay.cakto.com.br/xyz');
  assert.ok(!JSON.stringify(c.body).includes(HOOK_SECRET));
  const off = await startServer(t, { env: { ACCESS_MODE: '' } });
  const c2 = await off.req('GET', '/api/config');
  assert.equal(c2.body.access_mode, undefined);
  assert.equal(c2.body.renew_url, undefined);
});

/* ---------- admin ---------- */

test('GET/PUT /api/admin/entitlements: só admin; cria, ajusta e vincula ao perfil existente', async t => {
  const h = await startServer(t);
  assert.equal((await h.req('GET', '/api/admin/entitlements')).status, 401);
  const reg = await (async () => { await buy(h); return h.register(); })();
  assert.equal((await h.req('GET', '/api/admin/entitlements', { headers: { Cookie: cookieFrom(reg) } })).status, 403);
  assert.equal((await h.req('PUT', '/api/admin/entitlements', { headers: { Cookie: cookieFrom(reg) }, body: { email: 'x@example.com', validUntil: new Date(Date.now() + 1e9).toISOString() } })).status, 403);

  const bad = await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'nada', validUntil: new Date(Date.now() + 1e9).toISOString() } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error);
  assert.equal((await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'a@example.com', validUntil: 'ontem' } })).status, 400);
  assert.equal((await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'a@example.com', plan: 'vitalicio', validUntil: new Date(Date.now() + 1e9).toISOString() } })).status, 400);

  // direito manual para um perfil que já existe (migração): vincula por userId
  assert.equal((await h.put(OLD)).status, 402);
  const until = new Date(Date.now() + 30 * 86400000).toISOString();
  const g = await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'Antiga@Example.com', plan: 'manual', validUntil: until, userId: OLD } });
  assert.equal(g.status, 200, g.text);
  const row = g.body.entitlements.find(e => e.email === 'antiga@example.com');
  assert.equal(row.userId, OLD);
  assert.equal(row.source, 'manual');
  assert.equal((await h.put(OLD)).status, 200);

  // o mesmo perfil não pode ficar com dois direitos
  const dup = await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'outro@example.com', validUntil: until, userId: OLD } });
  assert.equal(dup.status, 409);
  // userId inexistente
  const ghost = await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'outro@example.com', validUntil: until, userId: 'fantasma' } });
  assert.equal(ghost.status, 400);

  // desativar ajusta na hora
  const off = await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'antiga@example.com', validUntil: until, status: 'inactive' } });
  assert.equal(off.status, 200);
  assert.equal((await h.put(OLD)).status, 402);

  const list = await h.req('GET', '/api/admin/entitlements', { uid: ADMIN });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.entitlements));
  assert.ok(list.body.entitlements.some(e => e.email === EMAIL && e.userName === 'Aluna'));
});

test('direito manual sem userId liga sozinho ao perfil que já tem esse e-mail (feito pelo admin)', async t => {
  const h = await startServer(t, { db: { users: [
    { id: ADMIN, name: 'Adminna', created: '2026-01-01T00:00:00Z', admin: true },
    { id: OLD, name: 'Antiga', created: '2026-01-01T00:00:00Z', email: 'antiga@example.com' }
  ], creds: [], subs: [], invites: [] } });
  const g = await h.req('PUT', '/api/admin/entitlements', { uid: ADMIN, body: { email: 'antiga@example.com', validUntil: new Date(Date.now() + 1e9).toISOString() } });
  assert.equal(g.status, 200);
  assert.equal(g.body.entitlements[0].userId, OLD);
  assert.equal((await h.put(OLD)).status, 200);
});

/* ---------- db.json ---------- */

test('db.json antigo (sem entitlements/caktoSeen) carrega e ganha os campos ao primeiro save, no db.json e no .bak', async t => {
  const h = await startServer(t);
  assert.equal(h.db().entitlements, undefined);        // arquivo antigo no disco
  await buy(h);
  const d = h.db();
  assert.equal(d.entitlements.length, 1);
  assert.equal(d.users.length, 2);
  const bak = JSON.parse(fs.readFileSync(path.join(h.dataDir, 'db.json.bak'), 'utf8'));
  assert.equal(bak.entitlements.length, 1);
  assert.deepEqual(bak.caktoSeen, ['purchase_approved:ord-1']);
});

test('db.json com entitlements/caktoSeen de tipo errado não derruba o servidor', async t => {
  const h = await startServer(t, { db: { users: [{ id: ADMIN, name: 'Adminna', created: 'x', admin: true }], creds: [], subs: [], invites: [], entitlements: 'lixo', caktoSeen: { a: 1 } } });
  assert.equal((await buy(h)).status, 200);
  assert.equal(h.db().entitlements.length, 1);
});

/* ---------- ACCESS_MODE desligado = upstream ---------- */

test('sem ACCESS_MODE: sem 402, sem access no perfil, cadastro sem e-mail, webhook e config como no upstream', async t => {
  const h = await startServer(t, { env: { ACCESS_MODE: '' } });
  assert.equal((await h.put(OLD)).status, 200);
  const me = await h.req('GET', '/api/me', { uid: OLD });
  assert.equal(me.body.user.access, undefined);
  const reg = await h.register({ email: undefined });
  assert.equal(reg.status, 200, reg.text);
  assert.equal(reg.body.user.access, undefined);
  const hook = await buy(h);
  assert.equal(hook.status, 404);
  assert.equal(h.db().entitlements?.length ?? 0, 0);
  assert.equal((await h.req('POST', '/api/register/options', { body: { name: 'Qualquer' } })).status, 200);
});

test('ACCESS_MODE aceita só o valor "subscription"', async t => {
  const h = await startServer(t, { env: { ACCESS_MODE: '1' } });
  assert.equal((await h.put(OLD)).status, 200);
  assert.equal((await buy(h)).status, 404);
});
