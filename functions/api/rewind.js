import { rewindStats } from '../../lib/rewind.js';
import { calendarIcs } from '../../lib/streams.js';

// GET /api/rewind?year=2026 -> year-in-review stats from the stream calendar
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const nowYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(new Date()));
  const year = Number(url.searchParams.get('year')) || nowYear;
  if (year < 2021 || year > nowYear) return Response.json({ error: 'Year out of range' }, { status: 400 });
  try {
    const stats = rewindStats(await calendarIcs(env), year);
    return Response.json(stats, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return Response.json({ error: 'Rewind unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
