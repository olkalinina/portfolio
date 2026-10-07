import { sha256Hex, now } from './crypto.js';

export const COOKIE_SECURE = '__Host-nda_session';
export const COOKIE_PLAIN = 'nda_session'; // only used on http://localhost during development

export const cookieName = (url) => (url.protocol === 'https:' ? COOKIE_SECURE : COOKIE_PLAIN);

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function sessionCookie(url, token, maxAgeSeconds) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${cookieName(url)}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}
export const clearCookie = (url) => sessionCookie(url, '', 0);

// Returns { state: 'valid', slugs, expiresAt } | { state: 'expired' } | { state: 'none' }.
// A session stops working when it expires, when it is revoked, or when its code is revoked.
export async function getSession(request, env) {
  const url = new URL(request.url);
  const token = readCookie(request, cookieName(url));
  if (!token || token.length > 100) return { state: 'none' };
  const row = await env.DB.prepare(
    `SELECT s.slugs, s.expires_at, s.revoked_at AS s_revoked, c.revoked_at AS c_revoked
       FROM sessions s JOIN codes c ON c.id = s.code_id
      WHERE s.token_hash = ?`
  ).bind(await sha256Hex(token)).first();
  if (!row) return { state: 'none' };
  if (row.s_revoked || row.c_revoked || row.expires_at <= now()) return { state: 'expired' };
  return { state: 'valid', slugs: JSON.parse(row.slugs), expiresAt: row.expires_at };
}

export const NO_STORE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', Vary: 'Cookie' };
export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...NO_STORE, ...extra } });
