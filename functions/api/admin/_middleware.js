import { requireAdmin } from '../../_lib/admin.js';

export async function onRequest({ request, env, next }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
