// The Ko-fi goal bar: { on: false } unless Dismeigh switched a goal on in the dashboard. See lib/kofi.js.
import { kofiTables, publicGoal } from '../../lib/kofi.js';
export async function onRequestGet({ env }) {
  const headers = { 'Cache-Control': 'public, max-age=60' };
  if (!env.ARCADE) return Response.json({ on: false }, { headers });
  try { await kofiTables(env.ARCADE); return Response.json(await publicGoal(env.ARCADE), { headers }); }
  catch { return Response.json({ on: false }, { headers }); }
}
