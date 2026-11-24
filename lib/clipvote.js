import { feedCat } from './shipcat.js';
// Clip of the Month: visitors vote for one of the five home page clips (one vote per visitor per month,
// changeable). Counts are private (dashboard, Content tab). When a month ends, its winner is saved and that
// month's individual votes are deleted, so only the totals are kept.
const ZONE = 'America/New_York';
export const CLIPS = [1, 2, 3, 4, 5];
const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
export const monthKey = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);

let ready = false;
export async function voteTables(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS clip_votes (month TEXT NOT NULL, visitor TEXT NOT NULL, clip INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (month, visitor))').run();
  ready = true;
}
export async function winners(db) { try { const v = JSON.parse(await get(db, 'clipvote:winners') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
const tallyOf = async (db, month) => (await db.prepare('SELECT clip, COUNT(*) AS n FROM clip_votes WHERE month = ? GROUP BY clip').bind(month).all()).results;

// Close out any finished months (ties go to the lower clip number)
export async function settle(db, now = Date.now()) {
  const cur = monthKey(now);
  const old = (await db.prepare('SELECT DISTINCT month FROM clip_votes WHERE month < ? ORDER BY month').bind(cur).all()).results.map(r => r.month);
  if (!old.length) return;
  const list = await winners(db);
  for (const month of old) {
    const t = (await tallyOf(db, month)).sort((a, b) => b.n - a.n || a.clip - b.clip);
    if (t.length && !list.some(w => w.month === month)) list.push({ month, clip: t[0].clip, votes: t[0].n, total: t.reduce((s, x) => s + x.n, 0) });
    await db.prepare('DELETE FROM clip_votes WHERE month = ?').bind(month).run();
  }
  list.sort((a, b) => a.month.localeCompare(b.month));
  await put(db, 'clipvote:winners', JSON.stringify(list.slice(-24)));
}

export async function publicVote(db, visitor, now = Date.now()) {
  await settle(db, now);
  const month = monthKey(now);
  const mine = (await db.prepare('SELECT clip FROM clip_votes WHERE month = ? AND visitor = ?').bind(month, visitor).first())?.clip ?? null;
  const w = (await winners(db)).at(-1) || null;
  return { month, mine, winner: w ? { month: w.month, clip: w.clip } : null };
}
export async function castVote(db, visitor, clip, now = Date.now()) {
  const c = Number(clip); if (!CLIPS.includes(c)) return { error: 'Pick a clip.' };
  await settle(db, now);
  const first = !(await db.prepare('SELECT 1 FROM clip_votes WHERE month = ? AND visitor = ?').bind(monthKey(now), visitor).first());
  await db.prepare('INSERT INTO clip_votes (month, visitor, clip, at) VALUES (?, ?, ?, ?) ON CONFLICT(month, visitor) DO UPDATE SET clip = excluded.clip, at = excluded.at')
    .bind(monthKey(now), visitor, c, now).run();
  if (first) await feedCat(db, 'vote', now);  // a first vote of the month feeds the ship's cat (switching doesn't)
  return { ok: true, mine: c };
}
export async function voteBoard(db, now = Date.now()) {
  await settle(db, now);
  const month = monthKey(now), t = await tallyOf(db, month);
  return { month, tally: CLIPS.map(clip => ({ clip, n: t.find(x => x.clip === clip)?.n || 0 })), total: t.reduce((s, x) => s + x.n, 0), winners: (await winners(db)).slice().reverse() };
}
