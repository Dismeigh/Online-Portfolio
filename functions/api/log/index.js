import { guard, json, sameOrigin, visitorKey } from '../../../lib/arcade.js';
import { cleanName, cleanMessage, LOG_NAME_MAX } from '../../../lib/guestbook.js';
import { alert } from '../../../lib/push.js';

let ready = false;
export async function ensureTable(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS guestbook (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, message TEXT NOT NULL, ip TEXT NOT NULL, created_at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS guestbook_recent ON guestbook (hidden, created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS guestbook_ip ON guestbook (ip, created_at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS log_reactions (entry_id INTEGER NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (entry_id, kind))'),
    db.prepare('CREATE TABLE IF NOT EXISTS log_reacted (entry_id INTEGER NOT NULL, visitor TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (entry_id, visitor))'),
  ]);
  try { await db.prepare("ALTER TABLE guestbook ADD COLUMN stamp TEXT NOT NULL DEFAULT ''").run(); } catch {}  // already there
  try { await db.prepare('ALTER TABLE guestbook ADD COLUMN bday INTEGER NOT NULL DEFAULT 0').run(); } catch {}  // birthday wishes: the year, kept forever
  ready = true;
}
// Base stamps, plus holiday ones the log page only offers during that holiday look (they stay on the entry afterwards)
export const STAMPS = ['rocket', 'cowboy', 'wrench', 'car', 'controller', 'moon', 'star', 'alien', 'mic', 'coffee',
  'party', 'heart', 'clover', 'chick', 'firework', 'pumpkin', 'ghost', 'turkey', 'snowflake', 'gift', 'cake'];
// Entries expire after 60 days unless pinned (pinned = 1 keeps one forever and puts it on top).
export const KEEP_DAYS = 60;
const cutoff = () => Date.now() - KEEP_DAYS * 86400000;
export const REACTIONS = ['fire', 'lol', 'rocket', 'cowboy'];
export const latest = async db => {
  const rows = (await db.prepare(
    'SELECT id, name, message, created_at, pinned, stamp FROM guestbook WHERE hidden = 0 AND (pinned = 1 OR created_at > ?) ORDER BY pinned DESC, created_at DESC LIMIT 50').bind(cutoff()).all()).results;
  const counts = {};
  if (rows.length) {
    const r = await db.prepare(`SELECT entry_id, kind, n FROM log_reactions WHERE entry_id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map(x => x.id)).all();
    for (const x of r.results) (counts[x.entry_id] ||= {})[x.kind] = x.n;
  }
  return rows.map(r => ({ id: r.id, name: r.name, message: r.message, at: new Date(r.created_at).toISOString(), pinned: !!r.pinned, stamp: STAMPS.includes(r.stamp) ? r.stamp : '', reactions: counts[r.id] || {} }));
};

// Birthday wall: entries signed on April 12 (Eastern time) are kept forever and shown on /birthday/, grouped by year
const bdayYear = (now = Date.now()) => { const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now); return d.slice(5) === '04-12' ? Number(d.slice(0, 4)) : 0; };
export const birthdayWall = async db => {
  const rows = (await db.prepare('SELECT name, message, created_at, stamp, bday FROM guestbook WHERE hidden = 0 AND bday > 0 ORDER BY bday DESC, created_at ASC LIMIT 2000').all()).results;
  const years = {};
  for (const r of rows) (years[r.bday] ||= []).push({ name: r.name, message: r.message, at: new Date(r.created_at).toISOString(), stamp: STAMPS.includes(r.stamp) ? r.stamp : '' });
  return { years, today: bdayYear() > 0 };
};

// GET /api/log -> { entries: [{ id, name, message, at, pinned }] } (pinned first, then newest, up to 50). ?birthday=1 -> the birthday wall
export const onRequestGet = guard(async ({ env, request }) => {
  await ensureTable(env.ARCADE);
  if (new URL(request.url).searchParams.get('birthday')) return json(await birthdayWall(env.ARCADE));
  return json({ entries: await latest(env.ARCADE), birthday: bdayYear() > 0 });
});

// POST /api/log { name, message, stamp, elapsed, website } -> { ok, entries }
export const onRequestPost = guard(async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await ensureTable(db);
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  // Bot traps: a hidden field people never fill in, and a minimum time on the form
  if (body?.website) return json({ ok: true, entries: await latest(db) });
  if (!(Number(body?.elapsed) >= 3000)) return json({ error: 'Take a second, then try again.' }, 400);
  const n = cleanName(body?.name, LOG_NAME_MAX); if (n.error) return json({ error: n.error, field: 'name' }, 400);
  const m = cleanMessage(body?.message); if (m.error) return json({ error: m.error, field: 'message' }, 400);
  const ip = await visitorKey(request, env); const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS day, MAX(created_at) AS last FROM guestbook WHERE ip = ? AND created_at > ?').bind(ip, now - 86400000).first();
  if (recent?.last && now - recent.last < 60000) return json({ error: 'One entry a minute, captain. Try again shortly.' }, 429);
  if ((recent?.day || 0) >= 5) return json({ error: 'That’s plenty of log entries for today. Come back tomorrow!' }, 429);
  await db.prepare('INSERT INTO guestbook (name, message, ip, created_at, stamp, bday) VALUES (?, ?, ?, ?, ?, ?)').bind(n.name, m.message, ip, now, STAMPS.includes(body?.stamp) ? body.stamp : '', bdayYear(now)).run();
  const job = alert(env, 'log', { title: 'New Ship\u2019s Log entry', body: `${n.name}: ${m.message.slice(0, 120)}`, tab: 'guestbook' });
  if (waitUntil) waitUntil(job); else await job;
  // Now and then, clear out expired entries for good (pinned ones stay)
  if (Math.random() < 0.1) {
    await db.prepare('DELETE FROM guestbook WHERE pinned = 0 AND bday = 0 AND created_at < ?').bind(cutoff()).run();
    await db.prepare('DELETE FROM log_reactions WHERE entry_id NOT IN (SELECT id FROM guestbook)').run();
    await db.prepare('DELETE FROM log_reacted WHERE entry_id NOT IN (SELECT id FROM guestbook) OR at < ?').bind(Date.now() - 90 * 86400000).run();
  }
  return json({ ok: true, entries: await latest(db) });
});
