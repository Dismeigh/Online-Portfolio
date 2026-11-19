import { rewindStats } from '../../lib/rewind.js';

// GET /api/rewind?year=2026 -> year-in-review stats from the stream calendar
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const nowYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(new Date()));
  const year = Number(url.searchParams.get('year')) || nowYear;
  if (year < 2021 || year > nowYear) return Response.json({ error: 'Year out of range' }, { status: 400 });
  try {
    let feed = env?.CALENDAR_FEED_URL;
    if (!feed) throw new Error('No calendar feed configured');
    // Ask the feed for enough history to cover the whole year
    const months = (new Date().getUTCFullYear() - year) * 12 + new Date().getUTCMonth() + 2;
    const feedUrl = new URL(feed);
    feedUrl.searchParams.set('past_months', String(Math.max(3, months)));
    const response = await fetch(feedUrl, { signal: AbortSignal.timeout(10000), cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!response.ok) throw new Error('Feed unavailable');
    const stats = rewindStats(await response.text(), year);
    return Response.json(stats, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return Response.json({ error: 'Rewind unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
