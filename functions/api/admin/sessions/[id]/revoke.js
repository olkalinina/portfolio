import { json } from '../../../../_lib/session.js';
import { now } from '../../../../_lib/crypto.js';

// Ends one active session. The code stays used (it can never be redeemed again).
export async function onRequestPost({ env, params }) {
  const r = await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now(), params.id).run();
  return json({ ok: r.meta.changes === 1 }, r.meta.changes === 1 ? 200 : 404);
}
