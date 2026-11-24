import { guard, json, sameOrigin, visitorKey, gameOf } from '../../../lib/arcade.js';

// POST /api/arcade/start { game } -> { run } : a ticket for one run, so the server can time it
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const body = await request.json().catch(() => ({}));
  const game = gameOf(body?.game);
  if (!game) return json({ error: 'Unknown game.' }, 400);
  const db = env.ARCADE;
  const ip = await visitorKey(request, env);
  const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM runs WHERE ip = ? AND started_at > ?').bind(ip, now - 3600000).first();
  if ((recent?.n || 0) >= 300) return json({ error: 'Slow down, pilot. Try again in a bit.' }, 429);
  if (Math.random() < 0.05) await db.prepare('DELETE FROM runs WHERE started_at < ?').bind(now - 86400000).run();
  const run = crypto.randomUUID();
  await db.prepare('INSERT INTO runs (id, ip, started_at, game) VALUES (?, ?, ?, ?)').bind(run, ip, now, game).run();
  return json({ run });
});
