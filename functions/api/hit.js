// Page view counter for the private stats: POST { p: '/garage/' }. Counts per page per day, plus (on arrival) the name of the
// site they came from (r: 'twitch.tv' or 'direct'). Stores nothing about the visitor.
import { sameOrigin } from '../../lib/arcade.js';
import { statsTables, countView, countSource, siteStats } from '../../lib/stats.js';
import { maybeWeeklyRecap } from '../../lib/push.js';
export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.ARCADE || !sameOrigin(request)) return new Response(null, { status: 204 });
  try {
    const body = (await request.text()).slice(0, 300);
    let p = '/', r = null; try { ({ p, r } = JSON.parse(body)); } catch {}
    await statsTables(env.ARCADE); await countView(env.ARCADE, p);
    if (r) await countSource(env.ARCADE, r);
    const recap = maybeWeeklyRecap(env, siteStats);
    if (waitUntil) waitUntil(recap); else await recap;
  } catch {}
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
