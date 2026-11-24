// The ship's cat: one shared pet for the whole site. Everyone feeds it together:
// a treat from the cat's bubble (once per visitor per day), signing the Ship's Log, Ko-fi tips, arcade runs,
// asking the Captain, Clip of the Month votes, meet check-ins, and each stream logged in the dashboard.
// It slowly gets hungry again (about 1% an hour). Only the fullness and a count of today's treat-givers are kept;
// the scrambled visitor IDs used to stop double treats are deleted after 2 days.
const KEY = 'cat:state', TREAT = 3, DECAY_PER_HOUR = 1;
export const FOOD = { log: 8, kofi: 20, run: 2, master: 6, ask: 2, vote: 1, checkin: 2, stream: 5 };
const SPOT = 4;  // catching the cat peeking out (bonus treat, once per visitor per day)
const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
const today = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);

let ready = false;
export async function catTables(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS cat_feeds (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor))'),
    db.prepare('CREATE TABLE IF NOT EXISTS cat_spots (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor))'),
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
export async function giveTreat(db, visitor, now = Date.now()) {
  const r = await db.prepare('INSERT OR IGNORE INTO cat_feeds (day, visitor) VALUES (?, ?)').bind(today(now), visitor).run();
  const fed = (r.meta?.changes || 0) > 0;
  if (fed) { await add(db, TREAT, now); await note(db, 'treat', now); }
  if (Math.random() < 0.05) await db.prepare('DELETE FROM cat_feeds WHERE day < ?').bind(today(now - 2 * 86400000)).run();
  return status(db, now, { fed, amount: fed ? TREAT : 0 });
}
// Fed by something happening on the site. Never throws: feeding the cat must not break the real action.
export async function feedCat(db, what, now = Date.now()) { try { if (!db || !FOOD[what]) return; await catTables(db); await add(db, FOOD[what], now); await note(db, what, now); } catch {} }
export const feedByLog = (db, now) => feedCat(db, 'log', now);
export async function catSpotted(db, visitor, now = Date.now()) {
  const r = await db.prepare('INSERT OR IGNORE INTO cat_spots (day, visitor) VALUES (?, ?)').bind(today(now), visitor).run();
  const fed = (r.meta?.changes || 0) > 0;
  if (fed) { await add(db, SPOT, now); await note(db, 'spot', now); }
  if (Math.random() < 0.05) await db.prepare('DELETE FROM cat_spots WHERE day < ?').bind(today(now - 2 * 86400000)).run();
  return status(db, now, { fed, amount: fed ? SPOT : 0, spotted: true });
}

// ---- The cat's diary: one line a day, written from what happened (counts only, never who) ----
const born = async (db, now) => {
  let b = await get(db, 'cat:born');
  if (!b) { b = today(now); await put(db, 'cat:born', b); }
  return b;
};
async function note(db, what, now) {
  const k = `cat:day:${today(now)}`;
  let c = {}; try { c = JSON.parse(await get(db, k) || '{}') || {}; } catch {}
  c[what] = (c[what] || 0) + 1;
  c._food = Math.round(await level(db, now));
  await put(db, k, JSON.stringify(c));
  await born(db, now);
}
const n = (x, one, many) => (x === 1 ? one : many.replace('#', x));
export function diaryLine(c = {}, food = null) {
  const bits = [];
  if (c.kofi) bits.push(n(c.kofi, 'got a whole fish from a Ko-fi tip', 'got # whole fish from Ko-fi tips'));
  if (c.master) bits.push(n(c.master, 'watched someone beat the master score in the arcade', 'watched the master score get beaten # times'));
  else if (c.run) bits.push(n(c.run, 'watched an arcade run', 'watched # arcade runs'));
  if (c.stream) bits.push(n(c.stream, 'kept the captain company on stream', 'kept the captain company for # streams'));
  if (c.log) bits.push(n(c.log, 'got a snack when someone signed the Ship\u2019s Log', 'got snacks from # Ship\u2019s Log signatures'));
  if (c.treat) bits.push(n(c.treat, 'got a treat from one crew member', 'got treats from # crew members'));
  if (c.ask) bits.push(n(c.ask, 'heard someone ask the captain a question', 'heard # questions for the captain'));
  if (c.checkin) bits.push(n(c.checkin, 'heard the crew checked in at a car meet', 'heard # crew checked in at a car meet'));
  if (c.spot) bits.push(n(c.spot, 'got caught peeking out from behind the furniture', 'got caught peeking out # times'));
  if (c.vote) bits.push(n(c.vote, 'saw a Clip of the Month vote come in', 'saw # Clip of the Month votes come in'));
  const list = bits.slice(0, 3);
  let line = !list.length ? 'Quiet day. Nobody came by. Sulked under the console.'
    : list.length === 1 ? `${list[0][0].toUpperCase()}${list[0].slice(1)}.`
    : `${list.slice(0, -1).join(', ').replace(/^./, m => m.toUpperCase())} and ${list.at(-1)}.`;
  if (food != null && list.length) line += food >= 70 ? ' Went to bed purring.' : food >= 40 ? ' Went to bed content.' : food >= 15 ? ' Went to bed a little hungry.' : ' Went to bed hungry and grumpy.';
  return line;
}
export async function catDiary(db, now = Date.now()) {
  const b = await born(db, now), dayNum = d => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000) + 1;
  const rows = (await db.prepare("SELECT key, value FROM site_settings WHERE key LIKE 'cat:day:%' ORDER BY key DESC LIMIT 61").all()).results;
  const t = today(now), entries = [];
  let todayLine = diaryLine({});
  for (const r of rows) {
    const d = r.key.slice(8); let c = {}; try { c = JSON.parse(r.value) || {}; } catch {}
    if (d === t) { todayLine = diaryLine(c); continue; }
    entries.push({ day: d, n: dayNum(d), text: diaryLine(c, c._food ?? null) });
  }
  // Fill quiet days in between, so the diary has no gaps (back to the cat's first day, up to 60 days)
  const have = new Set(entries.map(e => e.day));
  for (let i = 1; i <= 60; i++) { const d = today(now - i * 86400000); if (d < b) break; if (!have.has(d)) entries.push({ day: d, n: dayNum(d), text: diaryLine({}) }); }
  entries.sort((x, y) => y.day.localeCompare(x.day));
  if (Math.random() < 0.05) await db.prepare("DELETE FROM site_settings WHERE key LIKE 'cat:day:%' AND key < ?").bind(`cat:day:${today(now - 62 * 86400000)}`).run();
  return { today: { day: t, n: dayNum(t), text: todayLine }, entries: entries.slice(0, 60) };
}
export async function catToday(db, now = Date.now()) {
  const b = await born(db, now), t = today(now);
  let c = {}; try { c = JSON.parse(await get(db, `cat:day:${t}`) || '{}') || {}; } catch {}
  return { day: t, n: Math.round((Date.parse(`${t}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000) + 1, text: diaryLine(c) };
}
