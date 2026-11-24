// POST /api/feedback { type, message, contact, page, width, browser } -> { ok }. The footer feedback box. See lib/feedback.js.
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { feedbackTables, submitFeedback, TYPES } from '../../lib/feedback.js';
import { alert } from '../../lib/push.js';
export const onRequestPost = guard(async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await feedbackTables(env.ARCADE);
  const r = await submitFeedback(env.ARCADE, b, await visitorKey(request, env));
  if (r.error) return json(r, 400);
  if (r.sent) { const job = alert(env, 'feedback', { title: `New site feedback: ${TYPES[r.type]}`, body: 'Waiting in the dashboard (Overview).', tab: 'overview' }); if (waitUntil) waitUntil(job); else await job; }
  return json({ ok: true });
});
