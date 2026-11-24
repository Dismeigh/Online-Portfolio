// /api/cat: GET -> { food, mood, fedToday, today }; GET ?diary=1 -> { today, entries }; POST -> gives the cat a treat, once per visitor per day. See lib/shipcat.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { catTables, catStatus, giveTreat, catDiary, catToday } from '../../lib/shipcat.js';
export const onRequestGet = guard(async ({ env, request }) => {
  await catTables(env.ARCADE);
  const diary = new URL(request.url).searchParams.get('diary');
  const body = diary ? await catDiary(env.ARCADE) : { ...(await catStatus(env.ARCADE)), today: await catToday(env.ARCADE) };
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=60' } });
});
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  await catTables(env.ARCADE);
  return json({ ...(await giveTreat(env.ARCADE, await visitorKey(request, env))), today: await catToday(env.ARCADE) });
});
