// Security tests. Run through tests/run-local.sh (local, throwaway copy of the database) or, for the
// public-facing checks on a deployed site (Cloudflare itself rejects spoofed CF-Connecting-IP headers):  node tests/security.mjs remote https://your-site [ONE-FRESH-CODE]
import { execFileSync } from 'node:child_process';
import { verifyAccessJwt } from '../functions/_lib/admin.js';

const MODE = process.argv[2];
const BASE = MODE === 'remote' ? process.argv[3].replace(/\/$/, '') : 'http://localhost:8788';
const REMOTE_CODE = process.argv[4];
const SLUG = 'un-escap-risk-portal', OTHER = 'digital-assets-management';
const STATE = process.env.STATE; // local only: where the throwaway database lives
let pass = 0, failed = 0;
const ok = (c, name, extra = '') => { c ? pass++ : failed++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : '  <-- ' + extra)); };
const H = { Connection: 'close' };
const JH = { ...H, 'Content-Type': 'application/json', Origin: BASE };
const now = () => Math.floor(Date.now() / 1000);
const sql = (q) => JSON.parse(execFileSync('npx', ['-y', 'wrangler@4', 'd1', 'execute', 'portfolio-access', '--local', '--persist-to', STATE, '--json', '--command', q], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0].results;
let ipN = 10;
const redeem = (code, slug = SLUG, ip) => fetch(BASE + '/api/redeem', { method: 'POST', headers: MODE === 'remote' ? JH : { ...JH, 'CF-Connecting-IP': ip || `198.51.100.${ipN++}` }, body: JSON.stringify({ code, slug }) });
const get = (path, cookie, redirect = 'manual') => fetch(BASE + path, { headers: cookie ? { ...H, Cookie: cookie } : H, redirect });
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
const LEAK = ['Placeholder Project', 'Example Organisation', 'fake hero image'];
const leaks = (t) => LEAK.filter((m) => t.includes(m));
const admin = async (path, body) => { const r = await fetch(BASE + path, body === undefined ? { headers: H } : { method: 'POST', headers: JH, body: JSON.stringify(body) }); return { r, d: await r.json().catch(() => ({})) }; };
const mkCode = async (o = {}) => { const { r, d } = await admin('/api/admin/codes', { label: o.label || 'Test client', slugs: o.slugs || [SLUG], codeValidDays: o.days || 7, sessionHours: o.hours || 48 }); if (r.status !== 200) throw new Error('could not create code'); return d; };

async function noSession() {
  console.log('--- No session: nothing is delivered');
  for (const p of [`/p/${SLUG}`, `/p/${SLUG}/assets/01-hero.svg`, `/p/${OTHER}`, `/p/does-not-exist`, `/p/${SLUG}/`]) {
    const r = await get(p); const t = await r.text();
    ok(r.status === 401 && !leaks(t).length && t.includes('under NDA'), `GET ${p} -> 401 locked page, no content`, r.status);
  }
  ok((await (await get(`/p/${SLUG}`)).text()) === (await (await get('/p/does-not-exist')).text()), 'existing and non-existing projects look identical (no enumeration)');
  const h = await get(`/p/${SLUG}`); ok(/no-store/.test(h.headers.get('cache-control')) && /noindex/.test(h.headers.get('x-robots-tag')), 'locked response: no-store + noindex');
  ok((await (await get(`/api/access?slug=${SLUG}`)).json()).access === false, '/api/access without cookie -> false');
  ok((await get('/api/redeem')).status === 405, 'GET /api/redeem -> 405');
  const bad = await redeem('ABCD-EFGH-JKMN'); ok(bad.status === 401 && (await bad.text()) === '{"ok":false}', 'wrong code -> generic 401');
  ok((await get(`/p/${SLUG}`, 'nda_session=' + 'A'.repeat(43))).status === 401 && (await get(`/p/${SLUG}`, '__Host-nda_session=' + 'A'.repeat(43))).status === 401, 'forged cookie -> locked');
}

async function withCode() {
  console.log('--- Redeeming, one-time use, sessions');
  const c1 = await mkCode({ hours: 2 });
  let r = await redeem(c1.code, OTHER); ok(r.status === 401, 'valid code on a project it does not unlock -> rejected');
  ok(sql(`SELECT redeemed_at FROM codes WHERE id='${c1.id}'`)[0].redeemed_at === null, 'that rejected attempt did NOT burn the code');
  r = await redeem(c1.code.toLowerCase().replace(/-/g, ' '), SLUG); const setc = r.headers.get('set-cookie') || ''; const body = await r.json();
  ok(r.status === 200 && body.redirect === `/p/${SLUG}`, 'valid code (lowercase, spaces) -> 200');
  ok(/HttpOnly/i.test(setc) && /SameSite=Lax/i.test(setc), 'cookie is HttpOnly + SameSite=Lax', setc);
  ok(Math.abs(+/Max-Age=(\d+)/.exec(setc)[1] - 7200) < 15, 'session length follows the admin setting (2h)');
  const cookie = setc.split(';')[0];
  r = await get(`/p/${SLUG}`, cookie); let t = await r.text();
  ok(r.status === 200 && t.includes('Placeholder Project'), 'granted page loads');
  ok(/no-store/.test(r.headers.get('cache-control')) && /noindex/.test(r.headers.get('x-robots-tag')) && /default-src/.test(r.headers.get('content-security-policy')), 'page headers: no-store, noindex, CSP');
  ok(!/<title>[^<]*(UN ESCAP|Placeholder)/i.test(t), 'page <title> does not contain the project name');
  r = await get(`/p/${SLUG}/assets/01-hero.svg`, cookie); ok(r.status === 200 && r.headers.get('content-type') === 'image/svg+xml' && /no-store/.test(r.headers.get('cache-control')), 'protected image loads with no-store');
  ok((await get(`/p/${SLUG}`, cookie)).status === 200, 'reload still works');
  ok((await (await get(`/api/access?slug=${SLUG}`, cookie)).json()).access === true, '/api/access with cookie -> true');
  r = await get(`/p/${OTHER}`, cookie); ok(r.status === 401 && !leaks(await r.text()).length, 'session for project A cannot open project B');
  for (const p of [`/p/${SLUG}/assets/..%2f..%2fcontent.html`, `/p/${SLUG}/assets/%2e%2e/content.html`, `/p/${SLUG}/assets/nope.svg`, `/p/${SLUG}/extra/path`]) {
    r = await get(p, cookie); ok([401, 404].includes(r.status) && !leaks(await r.text()).length, `odd path ${p} -> ${r.status}`);
  }
  r = await redeem(c1.code, SLUG); const used = await r.text(); ok(r.status === 401, 'same code again -> rejected');
  const ex = await mkCode(); sql(`UPDATE codes SET expires_at=${now() - 60} WHERE id='${ex.id}'`);
  const exr = await redeem(ex.code, SLUG); const exT = await exr.text(); const bogus = await (await redeem('ABCD-EFGH-JKMN', SLUG)).text();
  ok(exr.status === 401 && used === bogus && bogus === exT, 'used / invalid / expired codes return the identical response');

  console.log('--- Race: 12 simultaneous attempts with one code');
  const cr = await mkCode(); const res = await Promise.all(Array.from({ length: 12 }, () => redeem(cr.code, SLUG, '203.0.113.7')));
  ok(res.filter((x) => x.status === 200).length === 1, `exactly one of 12 simultaneous redemptions succeeds (got ${res.filter((x) => x.status === 200).length})`);
  ok(sql(`SELECT COUNT(*) n FROM sessions WHERE code_id='${cr.id}'`)[0].n === 1, 'and exactly one session exists');

  console.log('--- Revoke and expiry');
  const cm = await mkCode({ slugs: [SLUG, OTHER], hours: 1 }); const mc = cookieOf(await redeem(cm.code, SLUG));
  ok((await get(`/p/${OTHER}`, mc)).status === 404, 'second project in the same code passes the access check (404 = no content uploaded)');
  await admin(`/api/admin/codes/${cm.id}/revoke`, {});
  r = await get(`/p/${SLUG}`, mc); ok(r.status === 302 && /s=expired/.test(r.headers.get('location')), 'revoking a code ends its live session immediately');
  r = await get(`/p/${SLUG}?s=expired`, mc); ok(r.status === 401 && !leaks(await r.text()).length, 'revoked session: locked page, no content');
  const ce = await mkCode({ hours: 1 }); const ec = cookieOf(await redeem(ce.code, SLUG)); sql(`UPDATE sessions SET expires_at=${now() - 5} WHERE code_id='${ce.id}'`);
  r = await get(`/p/${SLUG}`, ec); ok(r.status === 302 && /s=expired/.test(r.headers.get('location')), 'expired session -> "expired" state');
  const cs = await mkCode({ hours: 1 }); const sc = cookieOf(await redeem(cs.code, SLUG)); const sid = sql(`SELECT id FROM sessions WHERE code_id='${cs.id}'`)[0].id;
  ok((await admin(`/api/admin/sessions/${sid}/revoke`, {})).r.status === 200 && (await get(`/p/${SLUG}`, sc)).status === 302, 'ending only the session locks the client out at once');
  ok((await redeem(cs.code, SLUG)).status === 401, '...and the code still cannot be reused');
  ok((await admin(`/api/admin/sessions/${sid}/revoke`, {})).r.status === 404, 'ending twice -> 404');
  const cu = await mkCode(); await admin(`/api/admin/codes/${cu.id}/revoke`, {}); ok((await redeem(cu.code, SLUG)).status === 401, 'a revoked unused code cannot be redeemed');

  console.log('--- Rate limit');
  const ip = '192.0.2.99', st = []; for (let i = 0; i < 9; i++) st.push((await redeem('ABCD-EFGH-JKMN', SLUG, ip)).status);
  ok(st.slice(0, 8).every((s) => s === 401) && st[8] === 429, `8 wrong tries, then blocked: ${st.join(',')}`);
  const cb = await mkCode(); ok((await redeem(cb.code, SLUG, ip)).status === 429, 'a correct code is refused while the IP is blocked');
  ok((await redeem(cb.code, SLUG, '192.0.2.100')).status === 200, 'a different IP is unaffected');

  console.log('--- Storage');
  const codes = sql('SELECT code_hash FROM codes'), sess = sql('SELECT token_hash FROM sessions');
  ok(codes.every((x) => /^[0-9a-f]{64}$/.test(x.code_hash)) && sess.every((x) => /^[0-9a-f]{64}$/.test(x.token_hash)), 'only 64-char hashes stored (codes, session tokens)');
  const dump = JSON.stringify(sql('SELECT * FROM codes')) + JSON.stringify(sql('SELECT * FROM sessions')) + JSON.stringify(sql('SELECT * FROM attempts'));
  ok(![c1, cr, cb, cm].some((c) => dump.includes(c.code) || dump.includes(c.code.replace(/-/g, ''))), 'no plain-text code anywhere in the database');
  ok(!/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(JSON.stringify(sql('SELECT * FROM attempts'))), 'no raw IP address stored');
  const x = await fetch(BASE + '/api/redeem', { method: 'POST', headers: { ...JH, Origin: 'https://evil.example', 'CF-Connecting-IP': '198.51.100.250' }, body: JSON.stringify({ code: cb.code, slug: SLUG }) }); ok(x.status === 403, 'cross-site POST to /api/redeem refused');
}

async function adminApi() {
  console.log('--- Admin API (local dev bypass on)');
  let { r, d } = await admin('/api/admin/projects'); ok(r.status === 200 && d.projects.some((p) => p.slug === SLUG), 'lists uploaded projects');
  const base = { label: 'x', slugs: [SLUG], codeValidDays: 7, sessionHours: 48 };
  for (const [patch, name] of [[{ label: '' }, 'empty label'], [{ slugs: [] }, 'no project'], [{ slugs: ['nope-not-uploaded'] }, 'project without content'], [{ codeValidDays: 0 }, 'code days 0'], [{ sessionHours: 99999 }, 'session too long'], [{ slugs: ['../../etc'] }, 'bad slug']]) ok((await admin('/api/admin/codes', { ...base, ...patch })).r.status === 400, `rejects ${name}`);
  r = await fetch(BASE + '/api/admin/codes', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' }); ok(r.status === 403, 'cross-site POST refused');
  r = await fetch(BASE + '/api/admin/codes', { method: 'POST', headers: { ...H, 'Content-Type': 'text/plain', Origin: BASE }, body: '{}' }); ok(r.status === 403, 'non-JSON POST refused');
  const c = await mkCode({ label: 'Admin test <b>client</b>' });
  ok(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/.test(c.code), 'code format XXXX-XXXX-XXXX, no look-alike characters');
  ({ d } = await admin('/api/admin/codes')); const row = d.codes.find((x) => x.id === c.id);
  ok(row && row.status === 'unused' && !JSON.stringify(d).includes(c.code.replace(/-/g, '')) && !JSON.stringify(d).includes(c.code), 'listed as "unused"; the code is never returned again');
  ok(row.label === 'Admin test <b>client</b>', 'label kept as plain text');
  await redeem(c.code, SLUG); ({ d } = await admin('/api/admin/codes')); const r2 = d.codes.find((x) => x.id === c.id);
  ok(r2.status === 'active' && r2.redeemedAt && r2.sessionExpiresAt > r2.redeemedAt, 'list shows active + redeemed time + session expiry');
  r = await fetch(BASE + '/admin/', { headers: H }); const html = await r.text(); ok(r.status === 200 && /Generate a code/.test(html) && /no-store/.test(r.headers.get('cache-control')) && /noindex/.test(r.headers.get('x-robots-tag')), 'admin page: no-store + noindex');
}

async function adminClosed() {
  console.log('--- Admin is closed without a valid Access login (no dev bypass)');
  for (const [m, p] of [['GET', '/admin/'], ['GET', '/admin/index.html'], ['GET', '/api/admin/codes'], ['GET', '/api/admin/projects'], ['POST', '/api/admin/codes'], ['POST', '/api/admin/codes/x/revoke'], ['POST', '/api/admin/sessions/x/revoke']]) {
    const r = await fetch(BASE + p, { method: m, headers: m === 'POST' ? JH : H, body: m === 'POST' ? '{}' : undefined, redirect: 'manual' }); const t = await r.text();
    ok(([302, 403, 503].includes(r.status) || (p === '/admin/index.html' && r.status === 404)) && !/Access codes|Generate a code|"codes"/.test(t), `${m} ${p} -> ${r.status}, nothing leaked`);
  }
  const r = await fetch(BASE + '/api/admin/codes', { headers: { ...H, 'Cf-Access-Jwt-Assertion': 'a.b.c' }, redirect: 'manual' }); ok([302, 403, 503].includes(r.status), 'forged Access header not accepted');
}

async function jwtUnit() {
  console.log('--- Access token verification (generated keys)');
  const gen = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const kp = await gen(), other = await gen(); const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const T = 'team.cloudflareaccess.com', AUD = 'aud123', n = 2_000_000_000;
  const mk = async (payload, key = kp.privateKey, header = { alg: 'RS256', kid: 'k1' }) => { const h = b64(header), p = b64(payload); return `${h}.${p}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + p))).toString('base64url')}`; };
  const good = { iss: 'https://' + T, aud: [AUD], exp: n + 300, email: 'Me@Example.com' };
  const v = (tok, aud = AUD) => verifyAccessJwt(tok, { jwks: [jwk], team: T, aud, now: n }).then((e) => e, (e) => e.message);
  const t = await mk(good);
  ok((await v(t)) === 'me@example.com', 'valid token accepted');
  ok((await v(await mk({ ...good, exp: n - 1 }))) === 'expired', 'expired rejected');
  ok((await v(await mk({ ...good, aud: ['other'] }))) === 'bad audience', 'wrong audience rejected');
  ok((await v(await mk({ ...good, iss: 'https://evil.example' }))) === 'bad issuer', 'wrong issuer rejected');
  ok((await v(await mk(good, other.privateKey))) === 'bad signature', 'signed by a different key -> rejected');
  ok((await v(await mk(good, kp.privateKey, { alg: 'none', kid: 'k1' }))) === 'bad alg', 'alg "none" rejected');
  ok((await v(await mk(good, kp.privateKey, { alg: 'RS256', kid: 'zzz' }))) === 'unknown key', 'unknown key id rejected');
  const [h, , s] = t.split('.'); ok((await v(`${h}.${b64({ ...good, email: 'attacker@evil.com' })}.${s}`)) === 'bad signature', 'tampered payload rejected');
  ok((await v('not-a-token')) === 'malformed', 'garbage rejected');
  ok((await v(t, 'x1,aud123')) === 'me@example.com' && (await v(t, ' aud123 , other')) === 'me@example.com', 'several allowed audiences: any match is accepted');
  ok((await v(t, 'x1,x2')) === 'bad audience' && (await v(t, '')) === 'bad audience' && (await v(t, ',')) === 'bad audience', 'no match / empty list rejected');
}

async function exposure() {
  console.log('--- Nothing internal is public, and the admin page has no public copy');
  const MARK = 'Access codes — Admin';
  for (const p of ['/admin%2f', '/admin%2F', '/%61dmin%2f', '//admin', '/admin/index.html', '/ADMIN', '/admin/x']) {
    const r = await get(p); const t = await r.text();
    ok(!(r.status === 200 && t.includes(MARK)), `${p} does not serve the admin page`, r.status);
  }
  for (const p of ['/wrangler.toml', '/README.md', '/readme.md', '/.gitignore', '/migrations/0001_init.sql', '/tests/security.mjs', '/tests/run-local.sh', '/sample-content/un-escap-risk-portal/meta.json', '/functions/_lib/crypto.js', '/.dev.vars', '/.git/config', '/.env', '/package.json']) {
    const r = await get(p); ok(r.status === 404, `${p} -> 404 (not downloadable)`, r.status);
  }
  const h = await get('/about');
  const hv = (n) => h.headers.get(n) || '';
  ok(/max-age=\d{7,}/.test(hv('strict-transport-security')), 'public pages send HSTS');
  ok(/frame-ancestors/.test(hv('content-security-policy')) && /object-src 'none'/.test(hv('content-security-policy')), 'public pages send a content-security policy');
  ok(/SAMEORIGIN|DENY/.test(hv('x-frame-options')) && /nosniff/.test(hv('x-content-type-options')) && hv('permissions-policy') !== '', 'frame, sniffing and permissions headers present');
}

async function adminPageOpen() {
  console.log('--- Admin page (local, login bypass on)');
  const r = await get('/admin'); const t = await r.text();
  ok(r.status === 200 && t.includes('Access codes — Admin'), 'the real admin page loads at /admin');
  ok(/no-store/.test(r.headers.get('cache-control')) && /DENY/.test(r.headers.get('x-frame-options')) && /frame-ancestors 'none'/.test(r.headers.get('content-security-policy')), 'admin page: no-store, no framing');
}

async function remote() {
  await exposure();
  await noSession();
  console.log('--- Deployed admin is closed');
  for (const p of ['/admin/', '/api/admin/codes', '/api/admin/projects']) { const r = await fetch(BASE + p, { headers: H, redirect: 'manual' }); const t = await r.text(); ok([302, 401, 403, 503].includes(r.status) && !/Generate a code|"codes"/.test(t), `${p} -> ${r.status}, nothing leaked`); }
  if (!REMOTE_CODE) { console.log('(no code given: skipping redemption tests)'); return; }
  const r = await redeem(REMOTE_CODE, SLUG); ok(r.status === 200, 'fresh code redeems'); const ck = cookieOf(r);
  ok((await get(`/p/${SLUG}`, ck)).status === 200, 'protected page loads with the session');
  ok((await redeem(REMOTE_CODE, SLUG)).status === 401, 'the same code cannot be used again');
}

({ open: async () => { await noSession(); await exposure(); await withCode(); await adminApi(); await adminPageOpen(); }, closed: async () => { await adminClosed(); await exposure(); await jwtUnit(); }, remote }[MODE] || (() => { console.log('usage: see top of file'); process.exit(2); }))()
  .then(() => { console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
