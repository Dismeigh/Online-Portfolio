import { guard, json } from '../../lib/arcade.js';

// GET /api/lastseen -> { live, at, game }
// Twitch doesn't hand out "last streamed" without a secret key, so the site keeps its own note:
// every time this runs (visitors hit it every couple of minutes) it checks the channel itself,
// and while the stream is live it records the time and the game. When offline, it reports the
// last time it saw the stream live. Nothing from the visitor is trusted.
const CHANNEL = 'dismeigh';
const decapi = async path => {
  const r = await fetch(`https://decapi.me/twitch/${path}/${CHANNEL}`, { signal: AbortSignal.timeout(6000), cf: { cacheTtl: 90, cacheEverything: true } });
  const text = (await r.text()).trim();
  return r.ok ? text : '';
};
const looksBad = t => !t || t.length > 80 || /error|not found|offline|not live|not currently|rate limit|invalid/i.test(t);

let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS site_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
  ready = true;
}

export const onRequestGet = guard(async ({ env }) => {
  const db = env.ARCADE; await ensureTable(db);
  const row = await db.prepare("SELECT value, updated_at FROM site_state WHERE key = 'last_live'").first();
  let saved = null; try { saved = row ? JSON.parse(row.value) : null; } catch { saved = null; }

  const [uptime, category] = await Promise.all([decapi('uptime').catch(() => ''), decapi('game').catch(() => '')]);
  const live = !!uptime && !/offline|not live|not currently|error|not found/i.test(uptime);
  const game = looksBad(category) ? '' : category;

  if (live) {
    const now = Date.now();
    // Write at most once a minute
    if (!row || now - row.updated_at > 60000) {
      saved = { at: now, game: game || saved?.game || '' };
      await db.prepare("INSERT INTO site_state (key, value, updated_at) VALUES ('last_live', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
        .bind(JSON.stringify(saved), now).run();
    }
  }
  // Twitch keeps the last category on the channel after a stream ends, so it's a fallback for the game
  const out = { live, at: saved?.at ? new Date(saved.at).toISOString() : null, game: saved?.game || game || null };
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
});
