import { guard, json, sameOrigin, visitorKey } from '../../lib/arcade.js';

// POST /api/visits -> { n }  The retro footer counter: "You are visitor #000,042".
// Each visitor (by hashed IP, same as the arcade) gets one number, the first time they show up,
// and keeps it after that. Reloading or coming back doesn't bump the count.
let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS visitors (key TEXT PRIMARY KEY, n INTEGER NOT NULL, created_at INTEGER NOT NULL)').run();
  ready = true;
}

export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await ensureTable(db);
  const key = await visitorKey(request);
  await db.prepare('INSERT OR IGNORE INTO visitors (key, n, created_at) SELECT ?, COALESCE(MAX(n), 0) + 1, ? FROM visitors')
    .bind(key, Date.now()).run();
  const row = await db.prepare('SELECT n FROM visitors WHERE key = ?').bind(key).first();
  return json({ n: row?.n ?? null });
});
