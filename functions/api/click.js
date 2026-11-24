// POST /api/click { h } -> 204. Counts one tap on an outside link type (see lib/clicks.js). Nothing about the visitor is stored.
import { sameOrigin } from '../../lib/arcade.js';
import { clickTables, countClick } from '../../lib/clicks.js';
export async function onRequestPost({ request, env }) {
  if (!env.ARCADE || !sameOrigin(request)) return new Response(null, { status: 204 });
  try { let h = ''; try { h = JSON.parse((await request.text()).slice(0, 200)).h; } catch {} await clickTables(env.ARCADE); await countClick(env.ARCADE, h); } catch {}
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
