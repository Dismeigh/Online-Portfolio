// Page view counter for the private stats: POST { p: '/garage/' }. Counts per page per day only; stores nothing about the visitor.
import { sameOrigin } from '../../lib/arcade.js';
import { statsTables, countView } from '../../lib/stats.js';
export async function onRequestPost({ request, env }) {
  if (!env.ARCADE || !sameOrigin(request)) return new Response(null, { status: 204 });
  try {
    const body = (await request.text()).slice(0, 300);
    let p = '/'; try { p = JSON.parse(body).p; } catch {}
    await statsTables(env.ARCADE); await countView(env.ARCADE, p);
  } catch {}
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
