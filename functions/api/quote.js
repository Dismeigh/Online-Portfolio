// POST /api/quote: the quote request form on the Work page. See lib/clients.js. Pings the phone (kind "quote").
import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { clientTables, submitQuote } from '../../lib/clients.js';
import { alert } from '../../lib/push.js';
export const onRequestPost = guard(async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  await clientTables(env.ARCADE);
  const r = await submitQuote(env.ARCADE, b, await visitorKey(request, env));
  if (r.error) return json(r, 400);
  if (r.id) { const job = alert(env, 'quote', { title: 'New quote request', body: `${r.name}: ${r.service}`, tab: 'clients' }); if (waitUntil) waitUntil(job); else await job; }
  return json({ ok: true });
});
