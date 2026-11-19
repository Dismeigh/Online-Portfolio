import { guard, json, sameOrigin, currentUser, userSecrets, publicUser, sessionCookie } from '../../../lib/accounts.js';

// GET /api/me -> { user } (user is null when signed out)
export async function onRequestGet({ env, request }) {
  const blocked = await guard(env);
  if (blocked) return blocked;
  const me = await currentUser(env, request);
  if (!me) return json({ user: null });
  return json({ user: publicUser(me, await userSecrets(env, me.id)) });
}

// DELETE /api/me : remove the viewer's account and everything saved for it
export async function onRequestDelete({ env, request }) {
  const blocked = await guard(env);
  if (blocked) return blocked;
  if (!sameOrigin(request)) return json({ error: 'Bad request' }, 400);
  const me = await currentUser(env, request);
  if (!me) return json({ error: 'Not signed in' }, 401);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM secrets WHERE user_id = ?').bind(me.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(me.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(me.id),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}
