import { guard, json, sameOrigin, currentUser } from '../../../lib/accounts.js';

// POST /api/me/hall { show: true|false } : opt in or out of the public Hall of Fame
export async function onRequestPost({ env, request }) {
  const blocked = await guard(env);
  if (blocked) return blocked;
  if (!sameOrigin(request)) return json({ error: 'Bad request' }, 400);
  const me = await currentUser(env, request);
  if (!me) return json({ error: 'Not signed in' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  await env.DB.prepare('UPDATE users SET show_in_hall = ? WHERE id = ?').bind(body?.show ? 1 : 0, me.id).run();
  return json({ showInHall: !!body?.show });
}
