import { loadSchedule } from '../../lib/schedule.js';

// GET /api/schedule -> { next, upcoming[], checkedAt }
export async function onRequestGet({ env }) {
  try {
    const schedule = await loadSchedule({ feed: env?.CALENDAR_FEED_URL || undefined });
    return Response.json(schedule, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch {
    return Response.json({ error: 'Calendar temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
