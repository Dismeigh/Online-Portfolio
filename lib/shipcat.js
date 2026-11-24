// The ship's cat: one shared pet for the whole site. Everyone feeds it together:
// a visit feeds it a little (once per visitor per day), signing the Ship's Log feeds it more.
// It slowly gets hungry again (about 1% an hour). Only the fullness and a count of today's feeders are kept;
// the scrambled visitor IDs used to stop double feeding are deleted after 2 days.
const KEY = 'cat:state', VISIT = 3, LOG = 8, DECAY_PER_HOUR = 1;
const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
const today = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);

let ready = false;
export async function catTables(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS cat_feeds (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor))'),
  ]);
  ready = true;
}
async function level(db, now) {
  let s = null; try { s = JSON.parse(await get(db, KEY) || 'null'); } catch {}
  if (!s) return 60;                                       // a new cat starts out content
  return Math.max(0, Math.min(100, s.food - (now - s.at) / 3600000 * DECAY_PER_HOUR));
}
async function add(db, amount, now) {
  const food = Math.min(100, (await level(db, now)) + amount);
  await put(db, KEY, JSON.stringify({ food, at: now }));
  return food;
}
export const moodOf = food => (food >= 70 ? 'happy' : food >= 40 ? 'content' : food >= 15 ? 'hungry' : 'sulky');
async function status(db, now, extra = {}) {
  const food = await level(db, now);
  const fedToday = (await db.prepare('SELECT COUNT(*) AS n FROM cat_feeds WHERE day = ?').bind(today(now)).first())?.n || 0;
  return { food: Math.round(food), mood: moodOf(food), fedToday, ...extra };
}
export const catStatus = (db, now = Date.now()) => status(db, now);
export async function feedByVisit(db, visitor, now = Date.now()) {
  const r = await db.prepare('INSERT OR IGNORE INTO cat_feeds (day, visitor) VALUES (?, ?)').bind(today(now), visitor).run();
  const fed = (r.meta?.changes || 0) > 0;
  if (fed) await add(db, VISIT, now);
  if (Math.random() < 0.05) await db.prepare('DELETE FROM cat_feeds WHERE day < ?').bind(today(now - 2 * 86400000)).run();
  return status(db, now, { fed, amount: fed ? VISIT : 0 });
}
export async function feedByLog(db, now = Date.now()) { await catTables(db); await add(db, LOG, now); }
