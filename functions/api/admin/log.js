// Dashboard: Ship's Log moderation. GET recent entries (including hidden ones); POST { id, action: pin|unpin|hide|unhide|delete }.
import { adminOnly, noStore } from '../../../lib/admin.js';
export const onRequestGet = adminOnly(async ({ env }) => {
  const rows = await env.ARCADE.prepare('SELECT id, name, message, created_at, hidden, pinned FROM guestbook ORDER BY pinned DESC, created_at DESC LIMIT 150').all().catch(() => ({ results: [] }));
  return noStore({ entries: rows.results.map(r => ({ id: r.id, name: r.name, message: r.message, at: new Date(r.created_at).toISOString(), hidden: !!r.hidden, pinned: !!r.pinned })) });
});
const ACTIONS = {
  pin: 'UPDATE guestbook SET pinned = 1 WHERE id = ?', unpin: 'UPDATE guestbook SET pinned = 0 WHERE id = ?',
  hide: 'UPDATE guestbook SET hidden = 1 WHERE id = ?', unhide: 'UPDATE guestbook SET hidden = 0 WHERE id = ?',
  delete: 'DELETE FROM guestbook WHERE id = ?',
};
export const onRequestPost = adminOnly(async ({ env, request }) => {
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id) || id < 1 || !Object.hasOwn(ACTIONS, String(b.action))) return noStore({ error: 'Unknown action.' }, 400);
  await env.ARCADE.prepare(ACTIONS[b.action]).bind(id).run();
  return noStore({ ok: true });
});
