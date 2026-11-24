// Public: the site-wide banner and holiday look override set in the dashboard ({ banner: null, look: null } when unset).
import { siteSettings } from '../../lib/content.js';
import { statsTables } from '../../lib/stats.js';
export async function onRequestGet({ env }) {
  const headers = { 'Cache-Control': 'public, max-age=60' };
  if (!env.ARCADE) return Response.json({ banner: null, look: null }, { headers });
  try { await statsTables(env.ARCADE); return Response.json(await siteSettings(env.ARCADE), { headers }); }
  catch { return Response.json({ banner: null, look: null }, { headers }); }
}
