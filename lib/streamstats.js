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
      await db.prepare('INSERT INTO stream_stats (day, title, minutes, avg, peak, follows, chatters, views, note, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(...vals, Date.now()).run();
    }
    return { ok: true };
  }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM stream_stats WHERE id = ?').bind(Math.round(Number(b.id)) || 0).run(); return { ok: true }; }
  return { error: 'Unknown action.' };
}
