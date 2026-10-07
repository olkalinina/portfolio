import { normalizeCode, codeHash, ipHash, randomToken, sha256Hex, SLUG_RE, now } from '../_lib/crypto.js';
import { json, sessionCookie } from '../_lib/session.js';

const MAX_FAILURES = 8;     // failed attempts allowed per IP...
const WINDOW_SECONDS = 900; // ...in 15 minutes

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ ok: false }, 403);

  let body;
  try { body = await request.json(); } catch { body = null; }

  const t = now();
  const ipH = await ipHash(env, request.headers.get('CF-Connecting-IP') || 'unknown');

  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE ip_hash = ? AND ts > ?')
    .bind(ipH, t - WINDOW_SECONDS).first();
  if (recent.n >= MAX_FAILURES) return json({ ok: false }, 429, { 'Retry-After': String(WINDOW_SECONDS) });

  const fail = async () => {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO attempts (ip_hash, ts) VALUES (?, ?)').bind(ipH, t),
      env.DB.prepare('DELETE FROM attempts WHERE ts < ?').bind(t - 86400),
    ]);
    return json({ ok: false }, 401); // identical for wrong, expired, used, revoked, or not valid for this project
  };

  const code = normalizeCode(body && body.code);
  const slug = body && body.slug;
  if (!code || typeof slug !== 'string' || !SLUG_RE.test(slug)) return fail();

  const hash = await codeHash(env, code);
  const sid = randomToken(16);
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);

  // One transaction. The UPDATE can only succeed for a code that is unused, not revoked, not expired and
  // valid for this project, and it marks the code as used in the same statement, so two simultaneous
  // attempts with the same code cannot both succeed.
  const [burn, create] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE codes SET redeemed_at = ?1, redeemed_session = ?2
        WHERE code_hash = ?3 AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at > ?1
          AND EXISTS (SELECT 1 FROM json_each(codes.slugs) WHERE value = ?4)`
    ).bind(t, sid, hash, slug),
    env.DB.prepare(
      `INSERT INTO sessions (id, token_hash, code_id, slugs, created_at, expires_at)
       SELECT ?1, ?2, id, slugs, ?3, ?3 + session_hours * 3600 FROM codes WHERE redeemed_session = ?1`
    ).bind(sid, tokenHash, t),
  ]);
  if (burn.meta.changes !== 1 || create.meta.changes !== 1) return fail();

  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE id = ?').bind(sid).first();
  return json({ ok: true, redirect: '/p/' + slug }, 200, { 'Set-Cookie': sessionCookie(url, token, row.expires_at - t) });
}

export const onRequest = () => json({ ok: false }, 405, { Allow: 'POST' });
