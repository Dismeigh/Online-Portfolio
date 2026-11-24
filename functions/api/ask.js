// /api/ask: GET -> { answers } (answered questions only). POST { q, name, elapsed, website } -> { ok }. See lib/ask.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { askTables, publicAnswers, submitQuestion } from '../../lib/ask.js';
import { alert } from '../../lib/push.js';
export const onRequestGet = guard(async ({ env }) => {
  await askTables(env.ARCADE);
  return Response.json({ answers: await publicAnswers(env.ARCADE) }, { headers: { 'Cache-Control': 'public, max-age=60' } });
});
export const onRequestPost = guard(async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await askTables(env.ARCADE);
  const r = await submitQuestion(env.ARCADE, b, await visitorKey(request, env));
  if (r.error) return json(r, 400);
  if (r.id) { const job = alert(env, 'ask', { title: 'New question for the captain', body: `${r.name}: ${r.q.slice(0, 120)}`, tab: 'guestbook', focus: `ask-${r.id}` }); if (waitUntil) waitUntil(job); else await job; }
  return json({ ok: true });
});
