import { guard, json, sameOrigin, currentUser, addSecrets, userSecrets } from '../../../lib/accounts.js';

// POST /api/me/secrets { ids: [...] } -> { secrets }
export async function onRequestPost({ env, request }) {
  const blocked = await guard(env);
  if (blocked) return blocked;
  if (!sameOrigin(request)) return json({ error: 'Bad request' }, 400);
  const me = await currentUser(env, request);
  if (!me) return json({ error: 'Not signed in' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  if (Array.isArray(body?.ids)) await addSecrets(env, me.id, body.ids.map(String));
  return json({ secrets: await userSecrets(env, me.id) });
}
