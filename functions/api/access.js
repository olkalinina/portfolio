import { SLUG_RE } from '../_lib/crypto.js';
import { getSession, json } from '../_lib/session.js';

// Tells the locked card whether this browser already holds a valid session for a project.
export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug') || '';
  if (!SLUG_RE.test(slug)) return json({ access: false });
  const s = await getSession(request, env);
  return json({ access: s.state === 'valid' && s.slugs.includes(slug) });
}
