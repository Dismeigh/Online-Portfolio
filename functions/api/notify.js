// Viewer go-live alerts. GET -> { key } (push key); POST { sub } subscribes; DELETE { endpoint } unsubscribes. See lib/golive.js.
import { guard, json, sameOrigin } from '../../lib/arcade.js';
import { goliveTables, viewerKey, subscribe, unsubscribe } from '../../lib/golive.js';
export const onRequestGet = guard(async ({ env }) => {
  if (!env.DASHBOARD_PASSWORD) return json({ error: 'Not set up.' }, 503);
  await goliveTables(env.ARCADE);
  return Response.json({ key: await viewerKey(env) }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
});
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await goliveTables(env.ARCADE);
  const r = await subscribe(env, b?.sub);
  return json(r, r.error ? 400 : 200);
});
export const onRequestDelete = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await goliveTables(env.ARCADE);
  return json(await unsubscribe(env, b?.endpoint));
});
