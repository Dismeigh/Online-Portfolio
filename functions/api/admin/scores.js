// Dashboard: leaderboard cleanup. GET ?game=bounty|drag lists the top scores (with ids); POST { action: 'delete', id }
// removes one score, or { action: 'deleteName', game, name } removes every score under that name in that game.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { GAMES, gameOf, weekStart } from '../../../lib/arcade.js';
export const onRequestGet = adminOnly(async ({ env, request }) => {
  const game = gameOf(new URL(request.url).searchParams.get('game'));
  if (!game) return noStore({ error: 'Unknown game.' }, 400);
  const order = GAMES[game].better === 'high' ? 'DESC' : 'ASC';
  const q = since => env.ARCADE.prepare(`SELECT id, name, score, created_at FROM scores WHERE game = ? AND created_at >= ? ORDER BY score ${order}, created_at ASC LIMIT 30`).bind(game, since).all().catch(() => ({ results: [] }));
  const [all, week] = await Promise.all([q(0), q(weekStart())]);
  const tidy = r => r.results.map(x => ({ id: x.id, name: x.name, score: x.score, at: new Date(x.created_at).toISOString() }));
  return noStore({ game, better: GAMES[game].better, all: tidy(all), week: tidy(week) });
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
  return noStore({ error: 'Unknown action.' }, 400);
});
