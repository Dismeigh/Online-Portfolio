// GET /api/reviews -> { reviews } (approved client reviews for the Work page). See lib/reviews.js.
import { reviewTables, publicReviews } from '../../lib/reviews.js';
import { clientTables } from '../../lib/clients.js';
export async function onRequestGet({ env }) {
  if (!env.ARCADE) return Response.json({ reviews: [] });
  try { await clientTables(env.ARCADE); await reviewTables(env.ARCADE); return Response.json(await publicReviews(env.ARCADE), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
  catch { return Response.json({ reviews: [] }, { status: 503 }); }
}
