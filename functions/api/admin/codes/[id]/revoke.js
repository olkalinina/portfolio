import { json } from '../../../../_lib/session.js';
import { now } from '../../../../_lib/crypto.js';

// Revoking a code also ends any session that was created from it, immediately.
export async function onRequestPost({ env, params }) {
  const t = now();
  const [c] = await env.DB.batch([
    env.DB.prepare('UPDATE codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(t, params.id),
    env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE code_id = ? AND revoked_at IS NULL').bind(t, params.id),
  ]);
  return json({ ok: c.meta.changes === 1 }, c.meta.changes === 1 ? 200 : 404);
}
