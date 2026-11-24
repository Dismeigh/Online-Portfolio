// /api/cat: GET -> { food, mood, fedToday, today }; GET ?diary=1 -> { today, entries }; POST -> gives the cat a treat, once per visitor per day ({ spot: true }: caught it peeking out, bonus once a day). See lib/shipcat.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { catTables, catStatus, giveTreat, catDiary, catToday, catSpotted } from '../../lib/shipcat.js';
export const onRequestGet = guard(async ({ env, request }) => {
  await catTables(env.ARCADE);
  const diary = new URL(request.url).searchParams.get('diary');
  const body = diary ? await catDiary(env.ARCADE) : { ...(await catStatus(env.ARCADE)), today: await catToday(env.ARCADE) };
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=60' } });
});
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  await catTables(env.ARCADE);
  let b = {}; try { b = await request.json(); } catch {}
  const v = await visitorKey(request, env);
  return json({ ...(b?.spot ? await catSpotted(env.ARCADE, v) : await giveTreat(env.ARCADE, v)), today: await catToday(env.ARCADE) });
});
