import { calendarIcs } from '../lib/streams.js';

// GET /calendar.ics -> the stream calendar (from the dashboard's Streams tab), so viewers can
// subscribe with webcal://www.denizen-dismeigh.com/calendar.ics
export async function onRequestGet({ env }) {
  try {
    return new Response(await calendarIcs(env), {
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
