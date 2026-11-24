// /api/cat: GET -> { food, mood, fedToday }; POST -> gives the cat a treat, once per visitor per day. See lib/shipcat.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { catTables, catStatus, giveTreat } from '../../lib/shipcat.js';
export const onRequestGet = guard(async ({ env }) => {
  await catTables(env.ARCADE);
  return Response.json(await catStatus(env.ARCADE), { headers: { 'Cache-Control': 'public, max-age=60' } });
});
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  await catTables(env.ARCADE);
  return json(await giveTreat(env.ARCADE, await visitorKey(request, env)));
});
