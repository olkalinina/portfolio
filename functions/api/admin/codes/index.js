import { generateCode, normalizeCode, codeHash, SLUG_RE, now } from '../../../_lib/crypto.js';
import { json } from '../../../_lib/session.js';

export async function onRequestGet({ env }) {
  const t = now();
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.label, c.slugs, c.created_at, c.expires_at, c.session_hours, c.redeemed_at, c.revoked_at,
            s.id AS session_id, s.expires_at AS session_expires_at, s.revoked_at AS session_revoked_at
       FROM codes c LEFT JOIN sessions s ON s.code_id = c.id
      ORDER BY c.created_at DESC LIMIT 300`
  ).all();
  const codes = results.map((r) => {
    let status;
    if (r.revoked_at) status = 'revoked';
    else if (!r.redeemed_at) status = r.expires_at <= t ? 'code_expired' : 'unused';
    else if (r.session_revoked_at) status = 'session_revoked';
    else if (r.session_expires_at <= t) status = 'session_expired';
    else status = 'active';
    return { id: r.id, label: r.label, slugs: JSON.parse(r.slugs), createdAt: r.created_at, codeExpiresAt: r.expires_at, sessionHours: r.session_hours,
      redeemedAt: r.redeemed_at, sessionId: r.session_id, sessionExpiresAt: r.session_expires_at, status };
  });
  return json({ codes });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const label = typeof b.label === 'string' ? b.label.trim() : '';
  const slugs = Array.isArray(b.slugs) ? [...new Set(b.slugs)] : [];
  const codeDays = Number(b.codeValidDays), sessionHours = Number(b.sessionHours);
  if (!label || label.length > 80) return json({ error: 'Enter a client label (up to 80 characters).' }, 400);
  if (!slugs.length || slugs.length > 20 || !slugs.every((s) => typeof s === 'string' && SLUG_RE.test(s))) return json({ error: 'Choose at least one project.' }, 400);
  if (!Number.isInteger(codeDays) || codeDays < 1 || codeDays > 90) return json({ error: 'The code must be valid for 1 to 90 days.' }, 400);
  if (!Number.isInteger(sessionHours) || sessionHours < 1 || sessionHours > 720) return json({ error: 'Access must last 1 to 720 hours.' }, 400);
  for (const s of slugs) if ((await env.CONTENT.get(`projects/${s}/meta.json`, 'text')) === null) return json({ error: 'A chosen project has no content uploaded yet.' }, 400);

  const t = now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare('INSERT INTO codes (id, code_hash, label, slugs, created_at, expires_at, session_hours) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, await codeHash(env, normalizeCode(code)), label, JSON.stringify(slugs), t, t + codeDays * 86400, sessionHours).run();
      // The only time the full code exists in readable form: it is returned here and never stored.
      return json({ id, code, label, slugs, codeExpiresAt: t + codeDays * 86400, sessionHours });
    } catch (e) {
      if (!/UNIQUE/i.test(String(e))) throw e; // astronomically unlikely hash collision: try a new code
    }
  }
  return json({ error: 'Could not generate a code. Try again.' }, 500);
}
