import { SLUG_RE } from '../_lib/crypto.js';
import { getSession, clearCookie, NO_STORE } from '../_lib/session.js';

const SECURITY = {
  ...NO_STORE,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Public, content-free page files that ship with the site.
async function siteFile(env, request, path) {
  let res = await env.ASSETS.fetch(new URL(path, request.url));
  for (let i = 0; i < 3 && res.status >= 300 && res.status < 400 && res.headers.get('Location'); i++)
    res = await env.ASSETS.fetch(new URL(res.headers.get('Location'), request.url));
  return res;
}

// What anyone without access gets: the same locked page for every address, whether or not the project exists.
async function locked(env, request, extraHeaders = {}) {
  const res = await siteFile(env, request, '/locked.html');
  return new Response(res.body, { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY, ...extraHeaders } });
}

const notFound = () => new Response('Not found', { status: 404, headers: { ...SECURITY, 'Content-Type': 'text/plain' } });

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const slug = parts[0];
  if (!slug || !SLUG_RE.test(slug)) return locked(env, request);

  const session = await getSession(request, env);
  if (session.state !== 'valid' || !session.slugs.includes(slug)) {
    if (session.state === 'expired' && !url.searchParams.has('s')) {
      return new Response(null, { status: 302, headers: { Location: `/p/${slug}?s=expired`, 'Set-Cookie': clearCookie(url), ...SECURITY } });
    }
    return locked(env, request);
  }

  // Protected image: /p/<slug>/assets/<file>
  if (parts.length === 3 && parts[1] === 'assets') {
    const file = parts[2];
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(file) || file.includes('..')) return notFound();
    const { value, metadata } = await env.CONTENT.getWithMetadata(`projects/${slug}/assets/${file}`, { type: 'stream' });
    if (!value) return notFound();
    const headers = new Headers({ ...SECURITY, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
    headers.set('Content-Type', (metadata && metadata.contentType) || 'application/octet-stream');
    return new Response(value, { headers });
  }

  if (parts.length !== 1) return notFound();

  // Protected page: public shell + private content from KV.
  const [shellRes, contentText] = await Promise.all([siteFile(env, request, '/protected-shell.html'), env.CONTENT.get(`projects/${slug}/content.html`, 'text')]);
  if (contentText === null) return notFound();
  const content = contentText.replaceAll('{{ASSETS}}', `/p/${slug}/assets`);

  const others = [];
  for (const s of session.slugs) {
    if (s === slug || !SLUG_RE.test(s)) continue;
    const m = await env.CONTENT.get(`projects/${s}/meta.json`, 'text');
    if (m === null) continue;
    try { others.push(`<a href="/p/${esc(s)}">${esc(JSON.parse(m).title)}</a>`); } catch { /* skip unreadable meta */ }
  }
  const iso = new Date(session.expiresAt * 1000).toISOString();
  const bar =
    `<div class="nda-session-bar"><span>Access active until <time datetime="${iso}">${iso.slice(0, 16).replace('T', ' ')} UTC</time></span>` +
    `<a href="/case-studies.html">← All case studies</a></div>` +
    `<script>document.querySelectorAll('time[datetime]').forEach(function(t){var d=new Date(t.getAttribute('datetime'));t.textContent=d.toLocaleString([], {weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});});</script>`;
  const more = others.length ? `<nav class="nda-more" aria-label="Other case studies you can open"><h3>Other case studies you can open</h3>${others.join('')}</nav>` : '';

  const html = (await shellRes.text()).replace('<!--SESSION_BAR-->', () => bar).replace('<!--CONTENT-->', () => content).replace('<!--MORE-->', () => more);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY } });
}

export const onRequest = () => new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
