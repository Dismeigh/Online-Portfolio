// Public, private-link pages for clients: GET /api/job?s=<status code> or ?i=<invoice code>. See lib/clients.js.
import { clientTables, jobStatus, jobInvoice } from '../../lib/clients.js';
const out = (d, s = 200) => Response.json(d, { status: s, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' } });
export async function onRequestGet({ request, env }) {
  if (!env.ARCADE) return out({ error: 'Offline.' }, 503);
  try {
    await clientTables(env.ARCADE);
    const q = new URL(request.url).searchParams;
    const d = q.get('s') ? await jobStatus(env.ARCADE, q.get('s')) : q.get('i') ? await jobInvoice(env.ARCADE, q.get('i')) : null;
    return d ? out(d) : out({ error: 'This link isn\u2019t active. Ask Dismeigh for a new one.' }, 404);
  } catch { return out({ error: 'Something went wrong. Try again.' }, 500); }
}
