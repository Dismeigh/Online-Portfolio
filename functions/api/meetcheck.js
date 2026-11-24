// /api/meetcheck: GET -> { meets: [{ key, n, mine }] } for today's car meets; POST { key } -> check in once. Counts only. See lib/meetcheck.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { checkTables, meetCounts, checkIn } from '../../lib/meetcheck.js';
export const onRequestGet = guard(async ({ request, env }) => {
  await checkTables(env.ARCADE);
  return json(await meetCounts(env, new URL(request.url).origin, await visitorKey(request, env)));
});
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await checkTables(env.ARCADE);
  const r = await checkIn(env, new URL(request.url).origin, await visitorKey(request, env), b?.key);
  return json(r, r.error ? 400 : 200);
});
