// Shared helpers. No secrets live in code: CODE_PEPPER is a Cloudflare secret.

// 31 characters: no 0/O, 1/I or L, so codes are easy to read out and type. 12 characters ≈ 59 bits.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const enc = new TextEncoder();

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function generateCode() {
  const out = [];
  const limit = 256 - (256 % ALPHABET.length); // rejection sampling: no modulo bias
  while (out.length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < limit && out.length < 12) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  const s = out.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

// Returns the canonical 12-character code, or null if the input cannot be a valid code.
export function normalizeCode(input) {
  if (typeof input !== 'string' || input.length > 40) return null;
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 12) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  return s;
}

export async function hmacHex(secret, message) {
  if (!secret) throw new Error('CODE_PEPPER is not configured');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export async function sha256Hex(message) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(message)));
}

export const randomToken = (bytes) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
export const now = () => Math.floor(Date.now() / 1000);

export const codeHash = (env, normalized) => hmacHex(env.CODE_PEPPER, 'code:' + normalized);
export const ipHash = (env, ip) => hmacHex(env.CODE_PEPPER, 'ip:' + ip);
