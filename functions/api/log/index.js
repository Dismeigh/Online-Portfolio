import { guard, json, sameOrigin, visitorKey } from '../../../lib/arcade.js';
import { cleanName, cleanMessage, LOG_NAME_MAX } from '../../../lib/guestbook.js';

let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS guestbook (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, message TEXT NOT NULL, ip TEXT NOT NULL, created_at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS guestbook_recent ON guestbook (hidden, created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS guestbook_ip ON guestbook (ip, created_at)'),
  ]);
  ready = true;
}
// Entries expire after 60 days unless pinned (pinned = 1 keeps one forever and puts it on top).
export const KEEP_DAYS = 60;
const cutoff = () => Date.now() - KEEP_DAYS * 86400000;
const latest = async db => (await db.prepare(
  'SELECT id, name, message, created_at, pinned FROM guestbook WHERE hidden = 0 AND (pinned = 1 OR created_at > ?) ORDER BY pinned DESC, created_at DESC LIMIT 50').bind(cutoff()).all())
  .results.map(r => ({ id: r.id, name: r.name, message: r.message, at: new Date(r.created_at).toISOString(), pinned: !!r.pinned }));

// GET /api/log -> { entries: [{ id, name, message, at, pinned }] } (pinned first, then newest, up to 50)
export const onRequestGet = guard(async ({ env }) => { await ensureTable(env.ARCADE); return json({ entries: await latest(env.ARCADE) }); });

// POST /api/log { name, message, elapsed, website } -> { ok, entries }
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await ensureTable(db);
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  // Bot traps: a hidden field people never fill in, and a minimum time on the form
  if (body?.website) return json({ ok: true, entries: await latest(db) });
  if (!(Number(body?.elapsed) >= 3000)) return json({ error: 'Take a second, then try again.' }, 400);
  const n = cleanName(body?.name, LOG_NAME_MAX); if (n.error) return json({ error: n.error, field: 'name' }, 400);
  const m = cleanMessage(body?.message); if (m.error) return json({ error: m.error, field: 'message' }, 400);
  const ip = await visitorKey(request); const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS day, MAX(created_at) AS last FROM guestbook WHERE ip = ? AND created_at > ?').bind(ip, now - 86400000).first();
  if (recent?.last && now - recent.last < 60000) return json({ error: 'One entry a minute, captain. Try again shortly.' }, 429);
  if ((recent?.day || 0) >= 5) return json({ error: 'That’s plenty of log entries for today. Come back tomorrow!' }, 429);
  await db.prepare('INSERT INTO guestbook (name, message, ip, created_at) VALUES (?, ?, ?, ?)').bind(n.name, m.message, ip, now).run();
  // Now and then, clear out expired entries for good (pinned ones stay)
  if (Math.random() < 0.1) await db.prepare('DELETE FROM guestbook WHERE pinned = 0 AND created_at < ?').bind(cutoff()).run();
  return json({ ok: true, entries: await latest(db) });
});
