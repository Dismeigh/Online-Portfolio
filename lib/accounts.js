// Viewer accounts: "Sign in with Twitch" (no client secret needed), secret achievements
// saved across devices. Data lives in a Cloudflare D1
// database bound to the Pages project as DB.
export const SECRETS = ['bang', 'redline', 'bounty', 'realone'];
// Public Twitch application ID (not a secret). Can also be set as TWITCH_CLIENT_ID on the Pages project.
export const TWITCH_CLIENT_ID = '';
const SITE_ORIGINS = ['https://www.denizen-dismeigh.com', 'https://denizen-dismeigh.com'];
const SESSION_DAYS = 90;

export const clientId = env => env?.TWITCH_CLIENT_ID || TWITCH_CLIENT_ID;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}

export async function ensureSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, login TEXT NOT NULL, display_name TEXT NOT NULL, avatar TEXT,
      show_in_hall INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS secrets (
      user_id TEXT NOT NULL, secret TEXT NOT NULL, found_at TEXT NOT NULL, PRIMARY KEY (user_id, secret))`),
  ]);
}

// Reject cross-site writes: same-origin JSON only
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  const ok = origin && (SITE_ORIGINS.includes(origin) || origin === new URL(request.url).origin);
  return ok && (request.headers.get('Content-Type') || '').includes('application/json');
}

function readCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function sessionCookie(id, maxAge = SESSION_DAYS * 86400) {
  return `dsess=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function currentUser(env, request) {
  const sid = readCookie(request, 'dsess');
  if (!sid || !/^[a-f0-9]{64}$/.test(sid)) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.login, u.display_name, u.avatar, u.show_in_hall, s.id AS sid FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`).bind(sid, new Date().toISOString()).first();
  return row || null;
}

export async function userSecrets(env, userId) {
  const { results } = await env.DB.prepare('SELECT secret FROM secrets WHERE user_id = ? ORDER BY found_at').bind(userId).all();
  return results.map(r => r.secret);
}

export async function addSecrets(env, userId, ids) {
  const valid = [...new Set(ids)].filter(id => SECRETS.includes(id));
  if (!valid.length) return;
  const now = new Date().toISOString();
  await env.DB.batch(valid.map(id => env.DB.prepare('INSERT OR IGNORE INTO secrets (user_id, secret, found_at) VALUES (?, ?, ?)').bind(userId, id, now)));
}

export function publicUser(u, secrets) {
  return { login: u.login, displayName: u.display_name, avatar: u.avatar, showInHall: !!u.show_in_hall, secrets };
}

export function newSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const sessionExpiry = () => new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();

export async function guard(env) {
  if (!env?.DB || !clientId(env)) return json({ error: 'Accounts are not set up' }, 503);
  await ensureSchema(env.DB);
  return null;
}
