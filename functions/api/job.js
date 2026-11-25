// Public, private-link pages for clients: GET /api/job?s=<status code>, ?i=<invoice code> or ?a=<agreement code>. See lib/clients.js.
import { clientTables, jobStatus, jobInvoice, jobAgreement, signAgreement } from '../../lib/clients.js';
import { sameOrigin } from '../../lib/arcade.js';
import { alert } from '../../lib/push.js';
import { reviewTables, reviewState, submitReview } from '../../lib/reviews.js';
const out = (d, s = 200) => Response.json(d, { status: s, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' } });
export async function onRequestGet({ request, env }) {
  if (!env.ARCADE) return out({ error: 'Offline.' }, 503);
  try {
    await clientTables(env.ARCADE);
    const q = new URL(request.url).searchParams;
    if (q.get('s')) await reviewTables(env.ARCADE);
    const d = q.get('s') ? (r => r && { ...r })(await jobStatus(env.ARCADE, q.get('s'))) : q.get('i') ? await jobInvoice(env.ARCADE, q.get('i')) : q.get('a') ? await jobAgreement(env.ARCADE, q.get('a')) : null;
    if (d && q.get('s')) d.review = await reviewState(env.ARCADE, q.get('s'));
    return d ? out(d) : out({ error: 'This link isn\u2019t active. Ask Dismeigh for a new one.' }, 404);
  } catch { return out({ error: 'Something went wrong. Try again.' }, 500); }
}

// POST /api/job { a, name, agree: true }: the client signs their agreement. { review: true, s, rating, text, name, consent: true }: review
export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.ARCADE) return out({ error: 'Offline.' }, 503);
  if (!sameOrigin(request)) return out({ error: 'Not allowed.' }, 403);
  try {
    await clientTables(env.ARCADE);
    const b = await request.json().catch(() => ({}));
    // Review from the status page (once the job is done)
    if (b.review) {
      await reviewTables(env.ARCADE);
      const rv = await submitReview(env.ARCADE, b);
      if (rv.error) return out(rv, 400);
      if (rv.ping) { // one alert per review waiting for approval, not one per edit
        const ping = alert(env, 'quote', { title: rv.edited ? 'A client updated their review' : 'New client review', body: 'Waiting for your OK in the dashboard (Clients tab).', tab: 'clients' });
        if (waitUntil) waitUntil(ping); else await ping;
      }
      return out({ ok: true });
    }
    if (b.agree !== true) return out({ error: 'Tick the box to agree.' }, 400);
    const r = await signAgreement(env.ARCADE, b.a, b.name);
    if (r.error) return out(r, 400);
    const job = alert(env, 'quote', { title: 'Agreement signed', body: `${r.signed.name} signed their project agreement.`, tab: 'clients' });
    if (waitUntil) waitUntil(job); else await job;
    return out({ ok: true, signed: r.signed });
  } catch { return out({ error: 'Something went wrong. Try again.' }, 500); }
}
