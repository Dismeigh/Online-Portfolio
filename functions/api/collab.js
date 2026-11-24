// POST /api/collab: collab request form on the press kit page. See lib/collab.js. Pings the phone (kind "collab").
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { collabTables, submitCollab } from '../../lib/collab.js';
import { alert } from '../../lib/push.js';
export const onRequestPost = guard(async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await collabTables(env.ARCADE);
  const r = await submitCollab(env.ARCADE, b, await visitorKey(request, env));
  if (r.error) return json(r, 400);
  if (r.id) { const job = alert(env, 'collab', { title: 'New collab request', body: `${r.name}: ${r.kind}`, tab: 'clients' }); if (waitUntil) waitUntil(job); else await job; }
  return json({ ok: true });
});
