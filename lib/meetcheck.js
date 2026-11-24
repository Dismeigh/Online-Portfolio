// "I'm here too" at car meets: on the day of a meet (Eastern time), visitors can tap once to say they're there.
// Only a count is ever shown. The scrambled visitor ID (for one tap each) is deleted 3 days later.
import { readContent } from './content.js';
import { feedCat } from './shipcat.js';
const today = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
const keyOf = m => `${m.date}|${m.name}`.slice(0, 120);

let ready = false;
export async function checkTables(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS meet_checkins (meet TEXT NOT NULL, visitor TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (meet, visitor))').run();
  ready = true;
}
async function todaysMeets(env, origin) {
  const d = today();
  return ((await readContent(env, 'meets', origin)).meets || []).filter(m => m?.date === d).map(keyOf);
}
export async function meetCounts(env, origin, visitor) {
  const db = env.ARCADE, keys = await todaysMeets(env, origin);
  if (Math.random() < 0.2) await db.prepare('DELETE FROM meet_checkins WHERE at < ?').bind(Date.now() - 3 * 86400000).run();
  const out = [];
  for (const k of keys) {
    const n = (await db.prepare('SELECT COUNT(*) AS n FROM meet_checkins WHERE meet = ?').bind(k).first())?.n || 0;
    const mine = !!(await db.prepare('SELECT 1 FROM meet_checkins WHERE meet = ? AND visitor = ?').bind(k, visitor).first());
    out.push({ key: k, n, mine });
  }
  return { meets: out };
}
export async function checkIn(env, origin, visitor, key) {
  const keys = await todaysMeets(env, origin);
  if (!keys.includes(String(key ?? ''))) return { error: 'Check-ins open on the day of the meet.' };
  const r = await env.ARCADE.prepare('INSERT OR IGNORE INTO meet_checkins (meet, visitor, at) VALUES (?, ?, ?)').bind(key, visitor, Date.now()).run();
  if (r.meta?.changes) await feedCat(env.ARCADE, 'checkin');
  return meetCounts(env, origin, visitor);
}
