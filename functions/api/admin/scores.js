// Dashboard: leaderboard cleanup. GET ?game=bounty|drag lists the top scores (with ids); POST { action: 'delete', id }
// removes one score, { action: 'deleteName', game, name } removes every score under that name in that game,
// { action: 'target', game, value } sets the Arcade master target, { action: 'resetWeek', game } starts this week's board over.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { GAMES, gameOf, tuning, boardWeekStart, TARGET_DEFAULTS, TARGET_LIMITS } from '../../../lib/arcade.js';
import { statsTables } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env, request }) => {
  const game = gameOf(new URL(request.url).searchParams.get('game'));
  if (!game) return noStore({ error: 'Unknown game.' }, 400);
  await statsTables(env.ARCADE);
  const order = GAMES[game].better === 'high' ? 'DESC' : 'ASC';
  const { targets, resets } = await tuning(env.ARCADE);
  const since = boardWeekStart(resets[game]);
  const q = since => env.ARCADE.prepare(`SELECT id, name, score, created_at FROM scores WHERE game = ? AND created_at >= ? ORDER BY score ${order}, created_at ASC LIMIT 30`).bind(game, since).all().catch(() => ({ results: [] }));
  const [all, week] = await Promise.all([q(0), q(since)]);
  const tidy = r => r.results.map(x => ({ id: x.id, name: x.name, score: x.score, at: new Date(x.created_at).toISOString() }));
  return noStore({ game, better: GAMES[game].better, all: tidy(all), week: tidy(week), weekStart: new Date(since).toISOString(), early: since > 0 && since === resets[game], master: targets[game], masterDefault: TARGET_DEFAULTS[game], limits: TARGET_LIMITS[game] });
});
export const onRequestPost = adminOnly(async ({ env, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action === 'delete' && Number.isInteger(Number(b.id)) && Number(b.id) > 0) {
    await env.ARCADE.prepare('DELETE FROM scores WHERE id = ?').bind(Number(b.id)).run();
    return noStore({ ok: true });
  }
  const game = gameOf(b.game), name = String(b.name ?? '').slice(0, 30);
  if (b.action === 'deleteName' && game && name) {
    const r = await env.ARCADE.prepare('DELETE FROM scores WHERE game = ? AND lower(name) = lower(?)').bind(game, name).run();
    return noStore({ ok: true, removed: r.meta?.changes ?? null });
  }
  const put = (k, v) => env.ARCADE.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, String(v)).run();
  if (b.action === 'target' && game) {
    await statsTables(env.ARCADE);
    const [lo, hi] = TARGET_LIMITS[game], v = Math.round(Number(b.value));
    if (!Number.isFinite(v) || v < lo || v > hi) return noStore({ error: `Pick a number from ${lo} to ${hi}.` }, 400);
    const { targets } = await tuning(env.ARCADE);
    await put('arcade:targets', JSON.stringify({ ...targets, [game]: v }));
    return noStore({ ok: true, master: v });
  }
  if (b.action === 'resetWeek' && game) {
    await statsTables(env.ARCADE);
    await put(`arcade:reset:${game}`, Date.now());
    return noStore({ ok: true });
  }
  return noStore({ error: 'Unknown action.' }, 400);
});
