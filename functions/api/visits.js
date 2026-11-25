import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';
import { alert } from '../../lib/push.js';
import { feedCat } from '../../lib/shipcat.js';

// Visitor milestones: the site celebrates for a day (banner + gold odometer), your phone gets an alert, the cat gets a feast
export const MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const DAY = 86400000;
async function milestone(db) {
  try { const m = JSON.parse((await db.prepare("SELECT value FROM site_settings WHERE key = 'visits:milestone'").first())?.value || 'null'); return m && Date.now() - m.at < DAY ? m : null; } catch { return null; }
}

// The retro footer counter: how many people have visited, odometer style.
// POST /api/visits -> { n, total }: counts this visitor once (by scrambled visitor ID, same as the arcade).
// GET /api/visits -> { total }. Reloading or coming back doesn't bump the count.
let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS visitors (key TEXT PRIMARY KEY, n INTEGER NOT NULL, created_at INTEGER NOT NULL)').run();
  ready = true;
}

export const onRequestPost = guard(async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await ensureTable(db);
  const key = await visitorKey(request, env);
  const ins = await db.prepare('INSERT OR IGNORE INTO visitors (key, n, created_at) SELECT ?, COALESCE(MAX(n), 0) + 1, ? FROM visitors')
    .bind(key, Date.now()).run();
  const row = await db.prepare('SELECT n FROM visitors WHERE key = ?').bind(key).first();
  const total = (await db.prepare('SELECT MAX(n) AS t FROM visitors').first())?.t ?? null;
  if (ins.meta?.changes && MILESTONES.includes(row?.n)) {
    await db.prepare("INSERT INTO site_settings (key, value) VALUES ('visits:milestone', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify({ n: row.n, at: Date.now() })).run();
    await feedCat(db, 'feast');
    waitUntil?.(alert(env, 'milestone', { title: `${row.n.toLocaleString('en-US')} visitors!`, body: 'The site just hit a new visitor milestone. It\u2019s celebrating for the next day.', tab: 'overview' }));
  }
  return json({ n: row?.n ?? null, total, milestone: await milestone(db) });
});
export const onRequestGet = guard(async ({ env }) => {
  const db = env.ARCADE; await ensureTable(db);
  const total = (await db.prepare('SELECT MAX(n) AS t FROM visitors').first())?.t ?? null;
  return Response.json({ total, milestone: await milestone(db) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
});
