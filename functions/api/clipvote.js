// /api/clipvote: GET -> { month, mine, winner }; POST { clip } -> { ok, mine }. Counts stay private. See lib/clipvote.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { voteTables, publicVote, castVote } from '../../lib/clipvote.js';
export const onRequestGet = guard(async ({ request, env }) => {
  await voteTables(env.ARCADE);
  return json(await publicVote(env.ARCADE, await visitorKey(request, env)));
});
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await voteTables(env.ARCADE);
  const r = await castVote(env.ARCADE, await visitorKey(request, env), b?.clip);
  return json(r, r.error ? 400 : 200);
});
