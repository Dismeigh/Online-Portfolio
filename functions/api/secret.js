// Secret found: POST { id }. Adds one to that secret's count for the private stats. Nothing about the visitor is stored.
import { sameOrigin } from '../../lib/arcade.js';
import { statsTables, countSecret } from '../../lib/stats.js';
export async function onRequestPost({ request, env }) {
  if (!env.ARCADE || !sameOrigin(request)) return new Response(null, { status: 204 });
  try {
    let id = ''; try { id = JSON.parse((await request.text()).slice(0, 200)).id; } catch {}
    await statsTables(env.ARCADE); await countSecret(env.ARCADE, id);
  } catch {}
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
