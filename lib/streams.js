// Stream calendar kept in the dashboard (Streams tab). Replaces the old Calendar.online feed.
// Streams are stored in D1 (table "streams"); everything that used the old feed (home page schedule,
// /calendar.ics subscriptions, Rewind, the Clients calendar, site health) now reads an iCalendar file
// built from this table, so the existing parsing in lib/schedule.js and lib/rewind.js keeps working.
// Past streams imported from Calendar.online live in site_settings "streams:past" (title + times only).
import ICAL from 'ical.js';
import { streamSchedule, instant } from './schedule.js';

const ZONE = 'America/New_York';
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const DAY_NAMES = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const httpsUrl = v => { try { const u = new URL(String(v ?? '').trim()); return u.protocol === 'https:' && u.href.length <= 300 ? u.href : ''; } catch { return ''; } };
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();

let ready = false;
export async function streamTables(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS streams (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, start TEXT NOT NULL,
    minutes INTEGER NOT NULL, repeat TEXT NOT NULL DEFAULT 'none', days TEXT NOT NULL DEFAULT '', until TEXT NOT NULL DEFAULT '',
    skips TEXT NOT NULL DEFAULT '[]', link TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL)`).run();
  ready = true;
}

const row = r => ({ ...r, skips: JSON.parse(r.skips || '[]'), days: r.days ? r.days.split(',') : [] });
export async function listStreams(db) {
  return (await db.prepare('SELECT * FROM streams ORDER BY repeat DESC, start').all()).results.map(row);
}
async function pastStreams(db) { try { const v = JSON.parse(await get(db, 'streams:past') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }

// Weekday (0 = Sunday) of a YYYY-MM-DD date
const weekday = d => new Date(`${d}T12:00:00Z`).getUTCDay();
const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function cleanStream(b) {
  const title = text(b?.title, 80); if (!title) return { error: 'Give the stream a title.' };
  const date = String(b?.date ?? ''); if (!isDate(date)) return { error: 'Pick a date.' };
  const time = String(b?.time ?? ''); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Pick a start time.' };
  const minutes = Math.round(Number(b?.minutes)); if (!(minutes >= 15 && minutes <= 1440)) return { error: 'Streams can be 15 minutes to 24 hours long.' };
  const repeat = b?.repeat === 'weekly' ? 'weekly' : 'none';
  let days = [], start = date;
  if (repeat === 'weekly') {
    days = DAYS.filter(d => Array.isArray(b?.days) && b.days.includes(d));
    if (!days.length) return { error: 'Pick at least one day of the week.' };
    // Start on the first chosen weekday on or after the picked date
    for (let i = 0; i < 7 && !days.includes(DAYS[weekday(start)]); i++) start = addDays(start, 1);
  }
  const until = repeat === 'weekly' && isDate(b?.until) ? String(b.until) : '';
  if (until && until < start) return { error: 'The end date is before the first stream.' };
  const skips = [...new Set((Array.isArray(b?.skips) ? b.skips : []).filter(isDate))].sort().slice(-200);
  return { title, start: `${start}T${time}`, minutes, repeat, days: days.join(','), until, skips: JSON.stringify(skips), link: httpsUrl(b?.link), note: text(b?.note, 400) };
}

export async function changeStreams(db, b) {
  if (b?.action === 'save') {
    const s = cleanStream(b); if (s.error) return s;
    const id = Math.round(Number(b.id)) || 0;
    if (id) {
      s.skips = (await db.prepare('SELECT skips FROM streams WHERE id = ?').bind(id).first())?.skips ?? '[]';  // skipped dates stay
      await db.prepare('UPDATE streams SET title = ?, start = ?, minutes = ?, repeat = ?, days = ?, until = ?, skips = ?, link = ?, note = ? WHERE id = ?')
        .bind(s.title, s.start, s.minutes, s.repeat, s.days, s.until, s.skips, s.link, s.note, id).run();
    } else {
      const n = (await db.prepare('SELECT COUNT(*) AS n FROM streams').first())?.n || 0;
      if (n >= 200) return { error: 'That\u2019s 200 streams. Delete some old one-time streams first.' };
      await db.prepare('INSERT INTO streams (title, start, minutes, repeat, days, until, skips, link, note, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(s.title, s.start, s.minutes, s.repeat, s.days, s.until, s.skips, s.link, s.note, Date.now()).run();
    }
    return { ok: true };
  }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM streams WHERE id = ?').bind(Math.round(Number(b.id)) || 0).run(); return { ok: true }; }
  if (b?.action === 'skip' || b?.action === 'unskip') {
    const r = await db.prepare('SELECT skips FROM streams WHERE id = ?').bind(Math.round(Number(b.id)) || 0).first();
    if (!r || !isDate(b.date)) return { error: 'Pick a date.' };
    let skips = JSON.parse(r.skips || '[]');
    skips = b.action === 'skip' ? [...new Set([...skips, b.date])].sort().slice(-200) : skips.filter(d => d !== b.date);
    await db.prepare('UPDATE streams SET skips = ? WHERE id = ?').bind(JSON.stringify(skips), Math.round(Number(b.id))).run();
    return { ok: true };
  }
  if (b?.action === 'clearPast') { await put(db, 'streams:past', '[]'); return { ok: true }; }
  return { error: 'Unknown action.' };
}

// ---- iCalendar output ----
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = line => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
const local = (d, t) => `${d.replace(/-/g, '')}T${t.replace(':', '')}00`;
const utc = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const VTIMEZONE = ['BEGIN:VTIMEZONE', 'TZID:America/New_York',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE'];

export function buildIcs(streams, past = [], now = Date.now()) {
  const stamp = utc(now), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dismeigh//Stream calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Dismeigh streams', `X-WR-TIMEZONE:${ZONE}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', ...VTIMEZONE];
  for (const s of streams) {
    const [d, t] = s.start.split('T');
    L.push('BEGIN:VEVENT', `UID:stream-${s.id}@denizen-dismeigh.com`, `DTSTAMP:${stamp}`, `DTSTART;TZID=${ZONE}:${local(d, t)}`, `DURATION:PT${s.minutes}M`, `SUMMARY:${esc(s.title)}`);
    if (s.note) L.push(`DESCRIPTION:${esc(s.note)}`);
    if (s.link) L.push(`URL:${s.link}`);
    if (s.repeat === 'weekly') {
      // UNTIL is in UTC: 5 AM the next morning covers the whole end date in Eastern time
      L.push(`RRULE:FREQ=WEEKLY;BYDAY=${s.days.join(',')}${s.until ? `;UNTIL=${addDays(s.until, 1).replace(/-/g, '')}T045959Z` : ''}`);
      for (const x of s.skips) L.push(`EXDATE;TZID=${ZONE}:${local(x, t)}`);
    }
    L.push('END:VEVENT');
  }
  past.forEach((p, i) => {
    L.push('BEGIN:VEVENT', `UID:past-${i}-${p.s}@denizen-dismeigh.com`, `DTSTAMP:${stamp}`, `DTSTART:${utc(p.s)}`, `DTEND:${utc(Math.max(p.e, p.s))}`, `SUMMARY:${esc(p.t || 'Stream')}`, 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

export async function calendarIcs(env, now = Date.now()) {
  const db = env.ARCADE; await streamTables(db);
  // A one-time stream whose day passed more than a year ago is no longer needed; tidy now and then
  if (Math.random() < 0.05) await db.prepare("DELETE FROM streams WHERE repeat = 'none' AND start < ?").bind(new Date(now - 400 * 86400000).toISOString().slice(0, 16)).run();
  return buildIcs(await listStreams(db), await pastStreams(db), now);
}
export async function ownSchedule(env, { now = Date.now(), max } = {}) {
  return { ...streamSchedule(await calendarIcs(env, now), now, max), checkedAt: new Date(now).toISOString() };
}

// One-time move from Calendar.online: keep the streams that already happened (title and times only).
// Upcoming ones are left for you to add in the dashboard, since repeats there can be set up properly.
export async function importOld(env, now = Date.now()) {
  const feed = env.CALENDAR_FEED_URL; if (!feed) return { error: 'There\u2019s no Calendar.online link set in Cloudflare (CALENDAR_FEED_URL), so there\u2019s nothing to bring over.' };
  let ics;
  try {
    const u = new URL(feed); u.searchParams.set('past_months', '72');
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(); ics = await r.text();
    if (!ics.startsWith('BEGIN:VCALENDAR') || ics.length > 3000000) throw new Error();
  } catch { return { error: 'Couldn\u2019t reach Calendar.online. Try again in a minute.' }; }
  const cal = new ICAL.Component(ICAL.parse(ics));
  for (const tz of cal.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(new ICAL.Timezone(tz));
  const from = Date.UTC(2021, 0, 1), found = new Map(), comps = cal.getAllSubcomponents('vevent');
  const add = (ev, s, e) => {
    if (ev.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    const a = instant(s), z = Math.max(a, instant(e));
    if (!Number.isFinite(a) || a < from || z > now) return;
    found.set(`${a}|${ev.summary}`, { t: text(ev.summary || 'Stream', 80), s: a, e: z });
  };
  for (const c of comps) {
    if (c.hasProperty('recurrence-id')) continue;
    const ev = new ICAL.Event(c);
    if (!ev.isRecurring()) { add(ev, ev.startDate, ev.endDate); continue; }
    for (const x of comps.filter(y => y.hasProperty('recurrence-id') && y.getFirstPropertyValue('uid') === ev.uid)) ev.relateException(new ICAL.Event(x));
    const it = ev.iterator();
    for (let i = 0; i < 5000; i++) { const o = it.next(); if (!o || instant(o) > now) break; const d = ev.getOccurrenceDetails(o); add(d.item, d.startDate, d.endDate); }
  }
  const past = [...found.values()].sort((a, b) => a.s - b.s).slice(-3000);
  await put(env.ARCADE, 'streams:past', JSON.stringify(past));
  return { ok: true, imported: past.length };
}

export async function streamBoard(env, now = Date.now()) {
  const db = env.ARCADE; await streamTables(db);
  const ics = await calendarIcs(env, now), sched = streamSchedule(ics, now, 60);
  const horizon = now + 45 * 86400000;
  return {
    streams: await listStreams(db),
    upcoming: sched.upcoming.filter(e => Date.parse(e.start) < horizon),
    pastCount: (await pastStreams(db)).length,
    canImport: !!env.CALENDAR_FEED_URL,
    weeks: { this: sched.week, next: streamSchedule(ics, now + 7 * 86400000).week },
    days: DAYS,
  };
}
