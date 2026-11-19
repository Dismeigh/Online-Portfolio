import { guard, json, SECRETS } from '../../lib/accounts.js';

// GET /api/hall -> viewers who found every secret and chose to be listed
export async function onRequestGet({ env }) {
  const blocked = await guard(env);
  if (blocked) return blocked;
  const { results } = await env.DB.prepare(
    `SELECT u.login, u.display_name, u.avatar, MAX(s.found_at) AS completed
     FROM users u JOIN secrets s ON s.user_id = u.id
     WHERE u.show_in_hall = 1 AND s.secret IN (${SECRETS.map(() => '?').join(',')})
     GROUP BY u.id HAVING COUNT(DISTINCT s.secret) = ?
     ORDER BY completed ASC LIMIT 200`).bind(...SECRETS, SECRETS.length).all();
  return json({ total: SECRETS.length, hunters: results.map(r => ({ login: r.login, displayName: r.display_name, avatar: r.avatar, completed: r.completed })) },
    200, { 'Cache-Control': 'public, max-age=120' });
}
