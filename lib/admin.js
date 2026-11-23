// Private dashboard login (only Dismeigh). The password lives in the DASHBOARD_PASSWORD secret in Cloudflare
// (never in the code). Logging in sets a signed, HttpOnly cookie that only the /api/admin endpoints can read,
// good for 12 hours. Changing the password logs out every session. Wrong passwords are rate limited.
import { sameOrigin, visitorKey } from './arcade.js';

const COOKIE = 'dm_admin';
const HOURS = 12;
const MIN_PASSWORD = 12;
const MAX_FAILS = 5;            // per visitor per 15 minutes
const WINDOW = 15 * 60 * 1000;

export const noStore = (data, status = 200, extra = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...extra } });

const enc = s => new TextEncoder().encode(s);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function key(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc(`dismeigh-dashboard|${env.DASHBOARD_PASSWORD}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
const sign = async (env, msg) => hex(await crypto.subtle.sign('HMAC', await key(env), enc(msg)));
// Compare two strings without leaking where they differ (HMAC both, then compare)
async function equal(env, a, b) {
  const [x, y] = await Promise.all([sign(env, `cmp|${a}`), sign(env, `cmp|${b}`)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0 && x.length === y.length;
}

export const configured = env => typeof env.DASHBOARD_PASSWORD === 'string' && env.DASHBOARD_PASSWORD.length >= MIN_PASSWORD;

let ready = false;
async function tables(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS admin_fails (who TEXT NOT NULL, at INTEGER NOT NULL)').run();
  ready = true;
}

export async function login(env, request) {
  if (!configured(env)) return noStore({ error: 'The dashboard isn’t set up yet. Add a DASHBOARD_PASSWORD secret (12+ characters) in Cloudflare.' }, 503);
  if (!sameOrigin(request)) return noStore({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await tables(db);
  const who = await visitorKey(request), since = Date.now() - WINDOW;
  await db.prepare('DELETE FROM admin_fails WHERE at < ?').bind(since).run();
  const fails = (await db.prepare('SELECT COUNT(*) AS n FROM admin_fails WHERE who = ? AND at >= ?').bind(who, since).first())?.n || 0;
  if (fails >= MAX_FAILS) return noStore({ error: 'Too many tries. Wait 15 minutes and try again.' }, 429);
  const body = await request.json().catch(() => ({}));
  const pw = String(body.password ?? '').slice(0, 200);
  if (!pw || !(await equal(env, pw, env.DASHBOARD_PASSWORD))) {
    await db.prepare('INSERT INTO admin_fails (who, at) VALUES (?, ?)').bind(who, Date.now()).run();
    return noStore({ error: 'Wrong password.' }, 401);
  }
  await db.prepare('DELETE FROM admin_fails WHERE who = ?').bind(who).run();
  const exp = Date.now() + HOURS * 3600 * 1000;
  const token = `${exp}.${await sign(env, `session|${exp}`)}`;
  return noStore({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=${token}; Path=/api/admin; Max-Age=${HOURS * 3600}; HttpOnly; Secure; SameSite=Strict` });
}

export const logout = () =>
  noStore({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });

// True if the request carries a valid, unexpired session cookie
export async function signedIn(env, request) {
  if (!configured(env)) return false;
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d{10,16})\\.([0-9a-f]{64})`));
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > Date.now()) || exp > Date.now() + HOURS * 3600 * 1000 + 60000) return false;
  return equal(env, m[2], await sign(env, `session|${exp}`));
}

// Wrap an admin endpoint: must be signed in, and changes must come from this site
export function adminOnly(handler) {
  return async ctx => {
    const { env, request } = ctx;
    if (!env?.ARCADE) return noStore({ error: 'Database is offline.' }, 503);
    try {
      if (!(await signedIn(env, request))) return noStore({ error: 'Signed out.' }, 401);
      if (request.method !== 'GET' && !sameOrigin(request)) return noStore({ error: 'Not allowed.' }, 403);
      return await handler(ctx);
    } catch { return noStore({ error: 'Something went wrong. Try again.' }, 500); }
  };
}
