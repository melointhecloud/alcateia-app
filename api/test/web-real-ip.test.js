/* The web container runs behind someone else's proxy on Railway: it has to resolve the private
   network's (IPv6) DNS, and it has to pass the visitor's address to the API instead of the
   proxy's, or the sign-in throttle counts every student as one client. Both are switched by
   environment variables (docs/DEPLOY-RAILWAY.md) and default to the old behaviour for compose.
   The nginx side was proven against a real container; what is checked here is what can drift
   without anyone running Docker: the template still takes the variables, the image still ships
   the two entrypoint scripts, and the scripts refuse the values that would open a hole. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'real-ip-'));

// Runs web/12-real-ip.sh the way nginx's entrypoint does, writing to a scratch file.
function realIp(env) {
  const conf = path.join(tmp, `conf-${Math.random().toString(36).slice(2)}`);
  const r = spawnSync('sh', [path.join(ROOT, 'web/12-real-ip.sh')], {
    env: { PATH: process.env.PATH, REAL_IP_CONF: conf, ...env }, encoding: 'utf8'
  });
  return { ...r, conf: fs.existsSync(conf) ? fs.readFileSync(conf, 'utf8') : null };
}
// Sources web/11-resolver.envsh like the entrypoint does and prints what envsubst would see.
function resolver(env) {
  const r = spawnSync('sh', ['-c', '. "$1" && echo "$RESOLVER|$RESOLVER_IPV6"', 'sh', path.join(ROOT, 'web/11-resolver.envsh')], {
    env: { PATH: process.env.PATH, ...env }, encoding: 'utf8'
  });
  // The script also logs one line to stdout; the last line is the echo above.
  return { ...r, stdout: r.stdout.trim().split('\n').pop() };
}

test('the template takes the resolver family from RESOLVER_IPV6 and includes the real-ip file', () => {
  const t = read('web/nginx.conf.template');
  const lines = t.split('\n').filter(l => /^\s*resolver\s/.test(l));
  assert.equal(lines.length, 2, 'both /api blocks have a resolver');
  for (const l of lines) assert.match(l, /resolver \$\{RESOLVER\} valid=10s ipv6=\$\{RESOLVER_IPV6\};/);
  assert.match(t, /^\s*include \/etc\/nginx\/real-ip\.conf;$/m);
  // The proxy headers stay derived from $remote_addr, which realip rewrites: never from the request.
  assert.match(t, /proxy_set_header X-Real-IP \$remote_addr;/);
  assert.match(t, /proxy_set_header X-Forwarded-For \$remote_addr;/);
});

test('the image defaults keep compose as it was: IPv4 resolver, no trusted proxy', () => {
  const d = read('web/Dockerfile');
  assert.match(d, /^ENV RESOLVER_IPV6=off$/m);
  assert.match(d, /^ENV REAL_IP_FROM=""$/m);
  assert.match(d, /^ENV REAL_IP_HEADER=""$/m);
  assert.match(d, /^COPY --chmod=755 web\/11-resolver\.envsh web\/12-real-ip\.sh \/docker-entrypoint\.d\/$/m);
});

test('REAL_IP_FROM empty writes no directive at all', () => {
  const r = realIp({});
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.conf, /set_real_ip_from|real_ip_header/);
  // A header with nobody to trust is a warning, not a way to trust the header from anyone.
  const h = realIp({ REAL_IP_HEADER: 'X-Real-IP' });
  assert.equal(h.status, 0, h.stderr);
  assert.doesNotMatch(h.conf, /set_real_ip_from|real_ip_header/);
  assert.match(h.stderr, /ignored/);
});

test('REAL_IP_FROM writes one set_real_ip_from per range and defaults the header to X-Real-IP', () => {
  const r = realIp({ REAL_IP_FROM: 'fd12::/16, 10.0.0.0/8  192.0.2.1' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.conf.split('\n').filter(l => !l.startsWith('#') && l), [
    'set_real_ip_from fd12::/16;', 'set_real_ip_from 10.0.0.0/8;', 'set_real_ip_from 192.0.2.1;',
    'real_ip_header X-Real-IP;', 'real_ip_recursive on;'
  ]);
  const x = realIp({ REAL_IP_FROM: '10.0.0.0/8', REAL_IP_HEADER: 'X-Forwarded-For' });
  assert.match(x.conf, /^real_ip_header X-Forwarded-For;$/m);
});

test('REAL_IP_FROM refuses a range that trusts everyone and anything that is not an address', () => {
  for (const bad of ['0.0.0.0/0', '::/0', '10.0.0.0/8,0.0.0.0/0', '*', 'all', '10.0.0.1;evil', '$(id)', 'unix:']) {
    const r = realIp({ REAL_IP_FROM: bad });
    assert.notEqual(r.status, 0, `REAL_IP_FROM=${bad} must be refused`);
    assert.equal(r.conf, null, 'and nothing may be written');
  }
});

test('REAL_IP_HEADER refuses anything that is not a header name', () => {
  for (const bad of ['X;y', 'X Real', 'X-Real-IP;', '$remote_addr']) {
    const r = realIp({ REAL_IP_FROM: '10.0.0.0/8', REAL_IP_HEADER: bad });
    assert.notEqual(r.status, 0, `REAL_IP_HEADER=${bad} must be refused`);
  }
});

test('RESOLVER_IPV6 accepts on and off only; RESOLVER passes through, auto reads resolv.conf', () => {
  assert.equal(resolver({ RESOLVER: '127.0.0.11', RESOLVER_IPV6: 'off' }).stdout.trim(), '127.0.0.11|off');
  assert.equal(resolver({ RESOLVER: '[fd12::10]', RESOLVER_IPV6: 'on' }).stdout.trim(), '[fd12::10]|on');
  const bad = resolver({ RESOLVER: '127.0.0.11', RESOLVER_IPV6: 'maybe' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /RESOLVER_IPV6/);

  const v4 = path.join(tmp, 'resolv-v4');
  const v6 = path.join(tmp, 'resolv-v6');
  const none = path.join(tmp, 'resolv-none');
  fs.writeFileSync(v4, 'search x\nnameserver 10.96.0.10\nnameserver 10.96.0.11\n');
  fs.writeFileSync(v6, 'nameserver fd12::10\n');
  fs.writeFileSync(none, 'search x\n');
  assert.equal(resolver({ RESOLVER: 'auto', RESOLVER_IPV6: 'off', RESOLV_CONF: v4 }).stdout.trim(), '10.96.0.10|off');
  assert.equal(resolver({ RESOLVER: 'auto', RESOLVER_IPV6: 'on', RESOLV_CONF: v6 }).stdout.trim(), '[fd12::10]|on');
  assert.notEqual(resolver({ RESOLVER: 'auto', RESOLV_CONF: none }).status, 0);
});
