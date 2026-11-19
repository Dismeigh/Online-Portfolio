import { guard, json, sameOrigin, clientId, newSessionId, sessionExpiry, sessionCookie, addSecrets, userSecrets, publicUser } from '../../../lib/accounts.js';

// POST /api/auth/twitch { token, secrets } : verify a Twitch sign-in and start a session
export async function onRequestPost({ env, request }) {
  const blocked = await guard(env);
  if (blocked) return blocked;
  if (!sameOrigin(request)) return json({ error: 'Bad request' }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const token = String(body?.token || '');
  if (!/^[a-z0-9]{20,64}$/i.test(token)) return json({ error: 'Bad token' }, 400);

  // Confirm the token is real and was issued to this site's Twitch app
  const v = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
  if (!v.ok) return json({ error: 'Sign-in failed' }, 401);
  const info = await v.json();
  if (info.client_id !== clientId(env) || !info.user_id) return json({ error: 'Sign-in failed' }, 401);

  // Fetch display name and avatar, then revoke the token: it is never stored
  let profile = { login: info.login, display_name: info.login, profile_image_url: null };
  try {
    const u = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(info.user_id)}`, { headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId(env) } });
    if (u.ok) profile = (await u.json()).data?.[0] || profile;
  } catch {}
  fetch('https://id.twitch.tv/oauth2/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(clientId(env))}&token=${encodeURIComponent(token)}` }).catch(() => {});

  const now = new Date().toISOString();
  const avatar = /^https:\/\/static-cdn\.jtvnw\.net\//.test(profile.profile_image_url || '') ? profile.profile_image_url : null;
  await env.DB.prepare(`INSERT INTO users (id, login, display_name, avatar, show_in_hall, created_at) VALUES (?, ?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET login = excluded.login, display_name = excluded.display_name, avatar = excluded.avatar`)
    .bind(info.user_id, profile.login || info.login, profile.display_name || info.login, avatar, now).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(info.user_id, now).run();
  const sid = newSessionId();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(sid, info.user_id, sessionExpiry()).run();

  // Bring along anything found on this device before signing in
  if (Array.isArray(body.secrets)) await addSecrets(env, info.user_id, body.secrets.map(String));
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(info.user_id).first();
  return json({ user: publicUser(user, await userSecrets(env, info.user_id)) }, 200, { 'Set-Cookie': sessionCookie(sid) });
}
