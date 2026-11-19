import { guard, json, sameOrigin, currentUser, sessionCookie } from '../../../lib/accounts.js';

// POST /api/auth/logout
export async function onRequestPost({ env, request }) {
  const blocked = await guard(env);
  if (blocked) return blocked;
  if (!sameOrigin(request)) return json({ error: 'Bad request' }, 400);
  const me = await currentUser(env, request);
  if (me) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(me.sid).run();
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}
