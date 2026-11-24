import { feedCat } from './shipcat.js';
// Stream stats log (dashboard, Streams tab): numbers from Twitch's stream summary, typed or pasted in after a stream.
// Private: only the dashboard reads this.
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const n = (v, max) => { if (v === '' || v == null) return null; const x = Number(String(v).replace(/,/g, '')); return Number.isFinite(x) && x >= 0 ? Math.min(max, Math.round(x * 10) / 10) : null; };
export const FIELDS = ['avg', 'peak', 'follows', 'chatters', 'views'];

let ready = false;
export async function statTables(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS stream_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
    minutes INTEGER, avg REAL, peak INTEGER, follows INTEGER, chatters INTEGER, views INTEGER, note TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL)`).run();
  ready = true;
}
export async function statBoard(db) {
  return { stats: (await db.prepare('SELECT * FROM stream_stats ORDER BY day DESC, id DESC LIMIT 400').all()).results };
}
export async function changeStats(db, b) {
  if (b?.action === 'save') {
    if (!isDate(b.day)) return { error: 'Pick the stream date.' };
    const row = { avg: n(b.avg, 1e6), peak: n(b.peak, 1e7), follows: n(b.follows, 1e6), chatters: n(b.chatters, 1e6), views: n(b.views, 1e8), minutes: n(b.minutes, 2880) };
    if (FIELDS.every(k => row[k] === null)) return { error: 'Add at least one number (like average viewers).' };
    const id = Math.round(Number(b.id)) || 0;
    const vals = [b.day, text(b.title, 80), row.minutes, row.avg, row.peak, row.follows, row.chatters, row.views, text(b.note, 300)];
    if (id) await db.prepare('UPDATE stream_stats SET day = ?, title = ?, minutes = ?, avg = ?, peak = ?, follows = ?, chatters = ?, views = ?, note = ? WHERE id = ?').bind(...vals, id).run();
    else {
      if (((await db.prepare('SELECT COUNT(*) AS c FROM stream_stats').first())?.c || 0) >= 2000) return { error: 'The log is full (2,000 streams). Delete some old ones.' };
      // New records: beats every earlier logged stream (needs at least one earlier stream to compare with)
      const prev = await db.prepare('SELECT COUNT(*) AS c, MAX(peak) AS peak, MAX(avg) AS avg, MAX(follows) AS follows FROM stream_stats').first();
      await db.prepare('INSERT INTO stream_stats (day, title, minutes, avg, peak, follows, chatters, views, note, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(...vals, Date.now()).run();
      await feedCat(db, 'stream', Date.now());  // each logged stream feeds the ship's cat
      const records = prev?.c ? ['peak', 'avg', 'follows'].filter(k => row[k] != null && row[k] > (prev[k] ?? -1)).map(k => ({ kind: k, value: row[k], before: prev[k] ?? 0 })) : [];
      return { ok: true, records };
    }
    return { ok: true };
  }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM stream_stats WHERE id = ?').bind(Math.round(Number(b.id)) || 0).run(); return { ok: true }; }
  return { error: 'Unknown action.' };
}

// Best time to stream: average viewers by weekday and by start time. Start times come from the stream calendar
// (the scheduled stream on that day), so this only counts logged streams that were on the schedule.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function bestTimes(rows, sched = []) {
  const et = ms => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23' }).formatToParts(ms).map(p => [p.type, p.value]));
  const startOn = new Map();
  for (const st of sched) { const p = et(st.start), d = `${p.year}-${p.month}-${p.day}`; if (!startOn.has(d)) startOn.set(d, Number(p.hour)); }
  const byDay = new Map(), byHour = new Map();
  const add = (m, k, v) => { const x = m.get(k) || { n: 0, sum: 0 }; x.n++; x.sum += v; m.set(k, x); };
  for (const r of rows) {
    if (r.avg == null) continue;
    add(byDay, new Date(`${r.day}T12:00:00Z`).getUTCDay(), r.avg);
    const h = startOn.get(r.day); if (h != null) add(byHour, h, r.avg);
  }
  const hourName = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
  const out = (m, name) => [...m].map(([k, x]) => ({ key: k, label: name(k), n: x.n, avg: Math.round(x.sum / x.n * 10) / 10 })).sort((a, b) => b.avg - a.avg);
  const days = out(byDay, k => DAYS[k]), hours = out(byHour, hourName);
  const pick = list => list.find(x => x.n >= 2) || null;
  return { days, hours, bestDay: pick(days), bestHour: pick(hours), counted: rows.filter(r => r.avg != null).length };
}
