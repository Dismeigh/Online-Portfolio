import { ownSchedule } from '../../lib/streams.js';

// GET /api/schedule -> { next, upcoming[], week, checkedAt } from the dashboard's stream calendar
export async function onRequestGet({ env }) {
  try {
    return Response.json(await ownSchedule(env), { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    return Response.json({ error: 'Calendar temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
