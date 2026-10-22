// Files that live in the project but are not part of the website: they must never be downloadable.
// (Everything in the project folder is published as a static file unless it is blocked here.)
const BLOCKED = /^\/(?:wrangler\.toml|readme(?:\.md)?|ui-system(?:\.md)?|\.gitignore|\.git|\.dev\.vars|\.env|\.wrangler|package(?:-lock)?\.json|migrations|tests|sample-content|private-content|node_modules|functions|admin)(?:\/|$)/i;

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch { /* keep as is */ }
  path = path.replace(/\/{2,}/g, '/');
  // /admin itself is served (behind the login) by functions/admin; only odd spellings of it are refused here.
  const isRealAdmin = /^\/admin\/?$/i.test(url.pathname);
  if (!isRealAdmin && BLOCKED.test(path)) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  }
  return next();
}
