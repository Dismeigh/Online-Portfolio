// GET /api/clipreact -> { counts: { 1: { laugh, fire, skull }, ... }, mine: ['1:fire', ...] }
// POST { clip, kind } toggles that visitor's reaction. Counts only; nobody sees who reacted.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { reactTables, reactState, toggleReact } from '../../lib/clipreact.js';
const fresh = (d, s = 200) => { const r = json(d, s); r.headers.set('Cache-Control', 'no-store'); return r; };
export const onRequestGet = guard(async ({ request, env }) => {
  await reactTables(env.ARCADE);
  return fresh(await reactState(env.ARCADE, await visitorKey(request, env)));
});
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  await reactTables(env.ARCADE);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const who = await visitorKey(request, env);
  const r = await toggleReact(env.ARCADE, who, b);
  if (r.error) return json({ error: r.error }, r.status);
  return fresh({ ok: true, on: r.on, ...(await reactState(env.ARCADE, who)) });
});
