import { requireAdmin } from '../_lib/admin.js';

// The admin page itself is a static file; this makes sure nobody but the administrator can fetch it.
export async function onRequest({ request, env, next }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
