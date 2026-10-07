import { json } from '../../_lib/session.js';

// Projects that have content uploaded (a code can only unlock these).
export async function onRequestGet({ env }) {
  const list = await env.CONTENT.list({ prefix: 'projects/' });
  const out = [];
  for (const k of list.keys) {
    const m = k.name.match(/^projects\/([a-z0-9-]+)\/meta\.json$/);
    if (!m) continue;
    let title = m[1];
    try { title = JSON.parse(await env.CONTENT.get(k.name, 'text')).title || title; } catch { /* keep slug */ }
    out.push({ slug: m[1], title });
  }
  return json({ projects: out });
}
