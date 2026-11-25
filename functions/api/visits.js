import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';

// The retro footer counter: how many people have visited, odometer style.
// POST /api/visits -> { n, total }: counts this visitor once (by scrambled visitor ID, same as the arcade).
// GET /api/visits -> { total }. Reloading or coming back doesn't bump the count.
let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS visitors (key TEXT PRIMARY KEY, n INTEGER NOT NULL, created_at INTEGER NOT NULL)').run();
  ready = true;
}

export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await ensureTable(db);
  const key = await visitorKey(request, env);
  await db.prepare('INSERT OR IGNORE INTO visitors (key, n, created_at) SELECT ?, COALESCE(MAX(n), 0) + 1, ? FROM visitors')
    .bind(key, Date.now()).run();
  const row = await db.prepare('SELECT n FROM visitors WHERE key = ?').bind(key).first();
  const total = (await db.prepare('SELECT MAX(n) AS t FROM visitors').first())?.t ?? null;
  return json({ n: row?.n ?? null, total });
});
export const onRequestGet = guard(async ({ env }) => {
  const db = env.ARCADE; await ensureTable(db);
  const total = (await db.prepare('SELECT MAX(n) AS t FROM visitors').first())?.t ?? null;
  return Response.json({ total }, { headers: { 'Cache-Control': 'public, max-age=300' } });
});
