// POST /api/suggest { kind: quote|clip, ... } -> { ok }. Viewer suggestions for the Quote Board and home page clips. See lib/suggest.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { suggestTables, submitSuggestion } from '../../lib/suggest.js';
import { alert } from '../../lib/push.js';
export const onRequestPost = guard(async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await suggestTables(env.ARCADE);
  const r = await submitSuggestion(env.ARCADE, b, await visitorKey(request, env));
  if (r.error) return json(r, 400);
  if (r.sent) { const job = alert(env, 'suggest', { title: r.kind === 'quote' ? 'New quote suggestion' : 'New clip suggestion', body: 'Waiting in the dashboard (Content tab).', tab: 'content' }); if (waitUntil) waitUntil(job); else await job; }
  return json({ ok: true });
});
