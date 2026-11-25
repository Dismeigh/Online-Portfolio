// Clip reactions: one-tap 😂 🔥 💀 under each home page clip. Each visitor can toggle each emoji once per clip.
// Only the counts are ever shown. Visitors are remembered by a scrambled key (not the IP).
export const CLIPS = [1, 2, 3, 4, 5];
export const KINDS = ['laugh', 'fire', 'skull'];
let ready = false;
export async function reactTables(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS clip_reacts (clip INTEGER NOT NULL, kind TEXT NOT NULL, visitor TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (clip, kind, visitor))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS clip_react_rate (visitor TEXT NOT NULL, hour INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (visitor, hour))').run();
  ready = true;
}
export async function reactState(db, who) {
  const counts = Object.fromEntries(CLIPS.map(c => [c, Object.fromEntries(KINDS.map(k => [k, 0]))]));
  for (const r of (await db.prepare('SELECT clip, kind, COUNT(*) AS n FROM clip_reacts GROUP BY clip, kind').all()).results) if (counts[r.clip] && r.kind in counts[r.clip]) counts[r.clip][r.kind] = r.n;
  const mine = who ? (await db.prepare('SELECT clip, kind FROM clip_reacts WHERE visitor = ?').bind(who).all()).results.map(r => `${r.clip}:${r.kind}`) : [];
  return { counts, mine };
}
// Toggle one reaction. Returns { ok, on } or { error, status }.
export async function toggleReact(db, who, b, now = Date.now()) {
  const clip = Number(b?.clip), kind = String(b?.kind || '');
  if (!CLIPS.includes(clip) || !KINDS.includes(kind)) return { error: 'Bad request.', status: 400 };
  const hour = Math.floor(now / 3600000);
  const used = (await db.prepare('SELECT n FROM clip_react_rate WHERE visitor = ? AND hour = ?').bind(who, hour).first())?.n || 0;
  if (used >= 60) return { error: 'Easy there! Try again in a bit.', status: 429 };
  await db.prepare('INSERT INTO clip_react_rate (visitor, hour, n) VALUES (?, ?, 1) ON CONFLICT(visitor, hour) DO UPDATE SET n = n + 1').bind(who, hour).run();
  if (Math.random() < 0.05) await db.prepare('DELETE FROM clip_react_rate WHERE hour < ?').bind(hour - 2).run();
  const del = await db.prepare('DELETE FROM clip_reacts WHERE clip = ? AND kind = ? AND visitor = ?').bind(clip, kind, who).run();
  if (del.meta?.changes) return { ok: true, on: false };
  await db.prepare('INSERT OR IGNORE INTO clip_reacts (clip, kind, visitor, at) VALUES (?, ?, ?, ?)').bind(clip, kind, who, now).run();
  return { ok: true, on: true };
}
