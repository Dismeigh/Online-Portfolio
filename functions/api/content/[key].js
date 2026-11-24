// Public site content (bounties, pinned, quotes, lore, verdicts, crew): what the dashboard saved, or the original file.
import { CONTENT, readContent } from '../../../lib/content.js';
import { statsTables } from '../../../lib/stats.js';
export async function onRequestGet({ request, env, params }) {
  const name = String(params.key || '');
  if (!Object.hasOwn(CONTENT, name)) return new Response('Not found', { status: 404 });
  try { if (env.ARCADE) await statsTables(env.ARCADE); } catch {}
  const { saved, ...data } = await readContent(env, name, new URL(request.url).origin);
  return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
