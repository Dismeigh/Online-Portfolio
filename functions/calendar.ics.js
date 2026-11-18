import { calendarFeed } from '../lib/schedule.js';

// GET /calendar.ics -> the stream calendar, served from this domain so viewers can
// subscribe (webcal://www.denizen-dismeigh.com/calendar.ics) without the
// Calendar.online address being baked into the page.
export async function onRequestGet({ env }) {
  const feed = env?.CALENDAR_FEED_URL || calendarFeed;
  try {
    if (!feed) throw new Error('No calendar feed configured');
    const response = await fetch(feed, { signal: AbortSignal.timeout(8000), cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error('Feed unavailable');
    const text = await response.text();
    if (!text.startsWith('BEGIN:VCALENDAR')) throw new Error('Not a calendar');
    return new Response(text, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="dismeigh-streams.ics"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new Response('Calendar temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
