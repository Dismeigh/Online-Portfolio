// POST /api/searchlog { t, n }: counts a site-search term (see lib/stats.js countSearch). Stores the words only.
import { statsTables, countSearch } from '../../lib/stats.js';
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.text();
    if (body.length > 300 || !env.ARCADE) return new Response(null, { status: 204 });
    let b = {}; try { b = JSON.parse(body); } catch {}
    await statsTables(env.ARCADE); await countSearch(env.ARCADE, b.t, b.n);
  } catch {}
  return new Response(null, { status: 204 });
}
