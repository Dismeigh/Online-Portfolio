import ICAL from 'ical.js';

// Stream schedule from the public Calendar.online feed.
// Adapted from the 757 Anime Club event system (lib/next-meetup.js there).

// Set CALENDAR_FEED_URL in the Cloudflare Pages project to override this.
export const calendarFeed = '';

const ZONE = 'America/New_York';
const MAX_UPCOMING = 6;
const HORIZON_DAYS = 90;

// Floating times and all-day dates are treated as Eastern time.
function instant(time) {
  if (!time.isDate && time.zone && time.zone.tzid !== 'floating') return time.toJSDate().getTime();
  const wall = Date.UTC(time.year, time.month - 1, time.day, time.hour || 0, time.minute || 0, time.second || 0);
  let result = wall;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
    }).formatToParts(result).map(p => [p.type, p.value]));
    result += wall - Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  }
  return result;
}

export function streamSchedule(ics, now = Date.now()) {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  if (calendar.name !== 'vcalendar') throw new Error('Invalid calendar');
  for (const tz of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(new ICAL.Timezone(tz));

  const horizon = now + HORIZON_DAYS * 86400000;
  const found = new Map();
  const components = calendar.getAllSubcomponents('vevent');

  function add(event, start, end, occurrence = null) {
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    const startsAt = instant(start);
    const endsAt = Math.max(startsAt, instant(end));
    if (!Number.isFinite(startsAt) || endsAt <= now || startsAt > horizon) return;
    const title = (event.summary || 'Stream').trim();
    const recurrence = event.recurrenceId || occurrence;
    const id = (event.uid || `${title.toLowerCase()}|${startsAt}`) +
      (recurrence ? `::${new Date(instant(recurrence)).toISOString()}` : '');
    found.set(id, {
      id, title,
      description: (event.description || '').trim(),
      start: new Date(startsAt).toISOString(),
      end: new Date(endsAt).toISOString(),
      allDay: start.isDate,
      live: startsAt <= now && now < endsAt,
    });
  }

  for (const component of components) {
    if (component.hasProperty('recurrence-id')) continue;
    const event = new ICAL.Event(component);
    if (!event.isRecurring()) { add(event, event.startDate, event.endDate); continue; }
    for (const exception of components.filter(c => c.hasProperty('recurrence-id') && c.getFirstPropertyValue('uid') === event.uid)) {
      const e = new ICAL.Event(exception);
      event.relateException(e);
    }
    const iterator = event.iterator();
    for (let i = 0; i < 5000; i++) {
      const occurrence = iterator.next();
      if (!occurrence || instant(occurrence) > horizon) break;
      const details = event.getOccurrenceDetails(occurrence);
      add(details.item, details.startDate, details.endDate, occurrence);
    }
  }

  const upcoming = [...found.values()].sort((a, b) => a.start.localeCompare(b.start)).slice(0, MAX_UPCOMING);
  return { next: upcoming[0] || null, upcoming };
}

export async function loadSchedule({ feed = calendarFeed, timeout = 8000, now = Date.now() } = {}) {
  if (!feed) throw new Error('No calendar feed configured');
  const response = await fetch(feed, { signal: AbortSignal.timeout(timeout), cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error('Feed unavailable');
  const text = await response.text();
  if (text.length > 2000000) throw new Error('Feed too large');
  return { ...streamSchedule(text, now), checkedAt: new Date(now).toISOString() };
}
