// Admin protection, in two layers:
//   1. Cloudflare Access sits in front of /admin/* and /api/admin/* and only lets your Google login through.
//   2. This file independently verifies the signed login token Access attaches to every request, so the admin
//      stays closed even if the Access rule is ever misconfigured or removed. Not configured = closed.

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const parseJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

let jwksCache = { at: 0, keys: null, team: '' };
async function fetchJwks(team) {
  if (jwksCache.keys && jwksCache.team === team && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('could not load Access keys');
  const { keys } = await res.json();
  jwksCache = { at: Date.now(), keys, team };
  return keys;
}

// Pure function so it can be tested with generated keys. Returns the token's email, or throws.
export async function verifyAccessJwt(token, { jwks, team, aud, now = Math.floor(Date.now() / 1000) }) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new Error('malformed');
  const header = parseJson(parts[0]);
  const payload = parseJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('bad alg');
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) throw new Error('bad signature');
  if (payload.iss !== `https://${team}`) throw new Error('bad issuer');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error('bad audience');
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('expired');
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) throw new Error('not yet valid');
  if (typeof payload.email !== 'string') throw new Error('no email');
  return payload.email.toLowerCase();
}

const deny = (status, msg) => new Response(msg, { status, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });

// State-changing requests must come from this site (blocks cross-site requests riding your login).
function checkSameOrigin(request, url) {
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  const origin = request.headers.get('Origin');
  if (origin !== url.origin || !/application\/json/.test(request.headers.get('Content-Type') || '')) return deny(403, 'Forbidden');
  return null;
}

// Returns null when the request is the administrator, otherwise a Response to send back.
export async function requireAdmin(request, env) {
  const url = new URL(request.url);
  // Local development only: never honoured on a real hostname.
  if (env.DEV_BYPASS_ADMIN === '1' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return checkSameOrigin(request, url);

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL) return deny(503, 'Admin is not configured yet.');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return deny(403, 'Forbidden');
  try {
    const email = await verifyAccessJwt(token, { jwks: await fetchJwks(env.ACCESS_TEAM_DOMAIN), team: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD });
    if (email !== env.ADMIN_EMAIL.toLowerCase()) return deny(403, 'Forbidden');
  } catch {
    return deny(403, 'Forbidden');
  }
  return checkSameOrigin(request, url);
}
