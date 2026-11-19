import ICAL from 'ical.js';
import { instant } from './schedule.js';

// "Dismeigh Rewind": a year of streams, worked out from the stream calendar.
const ZONE = 'America/New_York';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function etParts(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long' })
    .formatToParts(ms).map(x => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), weekday: p.weekday };
}

// Every non-cancelled, timed stream that started in [startMs, endMs)
export function streamsBetween(ics, startMs, endMs) {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  if (calendar.name !== 'vcalendar') throw new Error('Invalid calendar');
  for (const tz of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(new ICAL.Timezone(tz));
  const components = calendar.getAllSubcomponents('vevent');
  const found = new Map();

  function add(event, start, end, occurrence = null) {
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED' || start.isDate) return;
    const s = instant(start), e = Math.max(s, instant(end));
    if (!Number.isFinite(s) || s < startMs || s >= endMs) return;
    const recurrence = event.recurrenceId || occurrence;
    const id = (event.uid || `${event.summary}|${s}`) + (recurrence ? `::${instant(recurrence)}` : '');
    found.set(id, { title: (event.summary || 'Stream').trim(), start: s, end: e });
  }

  for (const component of components) {
    if (component.hasProperty('recurrence-id')) continue;
    const event = new ICAL.Event(component);
    if (!event.isRecurring()) { add(event, event.startDate, event.endDate); continue; }
    for (const ex of components.filter(c => c.hasProperty('recurrence-id') && c.getFirstPropertyValue('uid') === event.uid)) {
      event.relateException(new ICAL.Event(ex));
    }
    const it = event.iterator();
    for (let i = 0; i < 5000; i++) {
      const occ = it.next();
      if (!occ || instant(occ) >= endMs) break;
      const d = event.getOccurrenceDetails(occ);
      add(d.item, d.startDate, d.endDate, occ);
    }
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}

export function rewindStats(ics, year, now = Date.now()) {
  const startMs = instant({ isDate: true, year, month: 1, day: 1 });
  const endMs = Math.min(instant({ isDate: true, year: year + 1, month: 1, day: 1 }), now);
  const streams = streamsBetween(ics, startMs, endMs).filter(s => s.end <= now);
  const hours = s => (s.end - s.start) / 3600000;
  const totalHours = streams.reduce((n, s) => n + hours(s), 0);

  const byGame = new Map();
  for (const s of streams) {
    const g = byGame.get(s.title) || { title: s.title, streams: 0, hours: 0 };
    g.streams += 1; g.hours += hours(s); byGame.set(s.title, g);
  }
  const games = [...byGame.values()].sort((a, b) => b.hours - a.hours || b.streams - a.streams)
    .map(g => ({ ...g, hours: Math.round(g.hours * 10) / 10 }));

  const months = Array(12).fill(0), weekdays = Object.fromEntries(DAYS.map(d => [d, 0]));
  for (const s of streams) { const p = etParts(s.start); months[p.month - 1] += 1; weekdays[p.weekday] += 1; }
  const busiestMonth = streams.length ? MONTHS[months.indexOf(Math.max(...months))] : null;
  const favoriteDay = streams.length ? Object.entries(weekdays).sort((a, b) => b[1] - a[1])[0][0] : null;
  const longest = streams.reduce((best, s) => (!best || hours(s) > hours(best) ? s : best), null);

  return {
    year,
    streams: streams.length,
    hours: Math.round(totalHours * 10) / 10,
    games,
    months: MONTHS.map((name, i) => ({ name, streams: months[i] })),
    busiestMonth,
    favoriteDay,
    longest: longest ? { title: longest.title, start: new Date(longest.start).toISOString(), hours: Math.round(hours(longest) * 10) / 10 } : null,
    first: streams[0] ? { title: streams[0].title, start: new Date(streams[0].start).toISOString() } : null,
    generatedAt: new Date(now).toISOString(),
  };
}
