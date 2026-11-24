// Private dashboard login (only Dismeigh). Two steps: the password in the DASHBOARD_PASSWORD secret in Cloudflare
// (never in the code), then a 6-digit code from an authenticator app (two-step login, set up on the first login).
// Logging in sets a signed, HttpOnly cookie that only the /api/admin endpoints can read, good for 12 hours.
// Changing the password logs out every session AND resets two-step login (its key is locked with the password),
// which is also how to recover if the phone with the authenticator app is lost. Wrong tries are rate limited.
import { sameOrigin, visitorKey } from './arcade.js';
import { logAdmin } from './stats.js';

const COOKIE = 'dm_admin';
const SETUP_COOKIE = 'dm_setup';   // short-lived, only lets you finish two-step setup
const SETUP_MINUTES = 10;
const HOURS = 12;
const MIN_PASSWORD = 12;
const MAX_FAILS = 5;               // wrong passwords or codes, per visitor per 15 minutes
const WINDOW = 15 * 60 * 1000;

export const noStore = (data, status = 200, extra = {}) => {
  const h = new Headers({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  for (const [k, v] of Object.entries(extra)) for (const one of [].concat(v)) h.append(k, one);
  return Response.json(data, { status, headers: h });
};

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

// ---------- Two-step login (TOTP, RFC 6238: 30-second, 6-digit codes; works with any authenticator app) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function toB32(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function fromB32(str) {
  let bits = 0, val = 0; const out = [];
  for (const ch of String(str)) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
async function totpAt(secret, counter) {
  const k = await crypto.subtle.importKey('raw', fromB32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8), v = new DataView(msg);
  v.setUint32(0, Math.floor(counter / 2 ** 32)); v.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg)), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
// The matching time step (allowing one step of clock drift), or null. Steps at or before `after` are refused (no reuse).
async function checkCode(secret, code, after = -1) {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1]) if (step > after && (await totpAt(secret, step)) === code) return step;
  return null;
}
// The authenticator key is stored encrypted (AES-GCM) with a key made from the dashboard password
async function boxKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc(`dismeigh-2fa|${env.DASHBOARD_PASSWORD}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(env, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await boxKey(env), enc(JSON.stringify(obj))));
  return `${toB32(iv)}.${toB32(ct)}`;
}
export async function unseal(env, sealed) {
  try {
    const [iv, ct] = String(sealed || '').split('.');
    if (!iv || !ct) return null;
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB32(iv) }, await boxKey(env), fromB32(ct));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch { return null; }   // none saved, or the password changed (which resets two-step login)
}

let ready = false;
async function tables(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS admin_fails (who TEXT NOT NULL, at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
  ]);
  ready = true;
}
const getSetting = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value || null;
const putSetting = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
const twoStepOf = async env => unseal(env, await getSetting(env.ARCADE, 'admin_totp'));

const cookieOf = (request, name) => (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=(\\d{10,16})\\.([0-9a-f]{64})`));
const cookie = (name, value, seconds) => `${name}=${value}; Path=/api/admin; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Strict`;
async function sessionCookie(env) {
  const exp = Date.now() + HOURS * 3600 * 1000;
  return cookie(COOKIE, `${exp}.${await sign(env, `session|${exp}`)}`, HOURS * 3600);
}
const clearSetup = cookie(SETUP_COOKIE, '', 0);

async function throttle(db, request) {
  const who = await visitorKey(request), since = Date.now() - WINDOW;
  await db.prepare('DELETE FROM admin_fails WHERE at < ?').bind(since).run();
  const fails = (await db.prepare('SELECT COUNT(*) AS n FROM admin_fails WHERE who = ? AND at >= ?').bind(who, since).first())?.n || 0;
  return {
    blocked: fails >= MAX_FAILS,
    fail: () => db.prepare('INSERT INTO admin_fails (who, at) VALUES (?, ?)').bind(who, Date.now()).run(),
    clear: () => db.prepare('DELETE FROM admin_fails WHERE who = ?').bind(who).run(),
  };
}
const tooMany = () => noStore({ error: 'Too many tries. Wait 15 minutes and try again.' }, 429);
const notSetUp = () => noStore({ error: 'The dashboard isn’t set up yet. Add a DASHBOARD_PASSWORD secret (12+ characters) in Cloudflare.' }, 503);

// POST { password, code? }
//  - two-step set up: needs the password AND a current 6-digit code ({ need: 'code' } until a code is sent)
//  - not set up yet: a correct password starts two-step setup ({ setup: true, secret, uri }); nothing else unlocks
// Backup codes: 10 one-time codes, stored only as signatures (so the database never holds the codes themselves).
// Changing DASHBOARD_PASSWORD makes old codes stop working, same as everything else.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normCode = c => String(c).toUpperCase().replace(/[^A-Z2-9]/g, '');
export async function makeBackupCodes(env) {
  const codes = Array.from({ length: 10 }, () => {
    const b = crypto.getRandomValues(new Uint8Array(8)), s = [...b].map(x => CODE_CHARS[x % 32]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  const hashes = await Promise.all(codes.map(c => sign(env, `backup|${normCode(c)}`)));
  await putSetting(env.ARCADE, 'admin_backup', JSON.stringify({ hashes, made: Date.now() }));
  return codes;
}
export async function backupInfo(env) {
  try { const v = JSON.parse(await getSetting(env.ARCADE, 'admin_backup') || 'null'); return v ? { left: v.hashes.length, made: new Date(v.made).toISOString() } : { left: 0, made: null }; } catch { return { left: 0, made: null }; }
}
async function useBackupCode(env, code) {
  let v; try { v = JSON.parse(await getSetting(env.ARCADE, 'admin_backup') || 'null'); } catch {}
  if (!v?.hashes?.length) return false;
  const h = await sign(env, `backup|${normCode(code)}`);
  let hit = -1;
  for (let i = 0; i < v.hashes.length; i++) if (await equal(env, v.hashes[i], h)) hit = i;
  if (hit < 0) return false;
  v.hashes.splice(hit, 1);
  await putSetting(env.ARCADE, 'admin_backup', JSON.stringify(v));
  return true;
}

export async function login(env, request) {
  if (!configured(env)) return notSetUp();
  if (!sameOrigin(request)) return noStore({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await tables(db);
  const t = await throttle(db, request);
  if (t.blocked) { await logAdmin(db, request, 'Blocked: too many tries'); return tooMany(); }
  const body = await request.json().catch(() => ({}));
  const pw = String(body.password ?? '').slice(0, 200);
  const code = String(body.code ?? '').replace(/\s/g, '').slice(0, 10);
  if (!pw || !(await equal(env, pw, env.DASHBOARD_PASSWORD))) { await t.fail(); await logAdmin(db, request, 'Wrong password'); return noStore({ error: 'Wrong password.' }, 401); }

  const two = await twoStepOf(env);
  if (two?.secret) {
    if (!code) return noStore({ need: 'code' });
    // Lost phone: a one-time backup code (XXXX-XXXX) works in place of the 6-digit code, once
    if (/^[A-Za-z2-9]{4}-?[A-Za-z2-9]{4}$/.test(code)) {
      if (await useBackupCode(env, code)) {
        await t.clear();
        await logAdmin(db, request, 'Logged in with a backup code');
        return noStore({ ok: true, usedBackup: true, backupLeft: (await backupInfo(env)).left }, 200, { 'Set-Cookie': await sessionCookie(env) });
      }
      await t.fail(); await logAdmin(db, request, 'Right password, wrong backup code');
      return noStore({ error: 'That backup code didn\u2019t work. Each one only works once.', need: 'code' }, 401);
    }
    const step = await checkCode(two.secret, code, two.last ?? -1);
    if (step == null) { await t.fail(); await logAdmin(db, request, 'Right password, wrong code'); return noStore({ error: 'That code didn’t work. Use the newest code from your authenticator app.', need: 'code' }, 401); }
    await putSetting(db, 'admin_totp', await seal(env, { ...two, last: step }));   // each code works only once
    await t.clear();
    await logAdmin(db, request, 'Logged in');
    return noStore({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(env) });
  }

  // First login: start two-step setup with a fresh key (kept encrypted, only saved for good once confirmed)
  await logAdmin(db, request, 'Started two-step setup');
  const secret = toB32(crypto.getRandomValues(new Uint8Array(20)));
  await putSetting(db, 'admin_totp_pending', await seal(env, { secret, made: Date.now() }));
  const exp = Date.now() + SETUP_MINUTES * 60000;
  const uri = `otpauth://totp/Dismeigh:Dashboard?secret=${secret}&issuer=Dismeigh&algorithm=SHA1&digits=6&period=30`;
  return noStore({ setup: true, secret, uri }, 200, { 'Set-Cookie': cookie(SETUP_COOKIE, `${exp}.${await sign(env, `setup|${exp}`)}`, SETUP_MINUTES * 60) });
}

// Finish two-step setup: POST { code } with the setup cookie from login
export async function finishSetup(env, request) {
  if (!configured(env)) return notSetUp();
  if (!sameOrigin(request)) return noStore({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await tables(db);
  const t = await throttle(db, request);
  if (t.blocked) return tooMany();
  const timedOut = () => noStore({ error: 'Setup timed out. Log in again to start over.' }, 401, { 'Set-Cookie': clearSetup });
  const m = cookieOf(request, SETUP_COOKIE), exp = Number(m?.[1]);
  if (!m || !(exp > Date.now()) || !(await equal(env, m[2], await sign(env, `setup|${exp}`)))) return timedOut();
  if (await twoStepOf(env)) return noStore({ error: 'Two-step login is already set up. Log in again.' }, 409, { 'Set-Cookie': clearSetup });
  const pending = await unseal(env, await getSetting(db, 'admin_totp_pending'));
  if (!pending?.secret || Date.now() - pending.made > SETUP_MINUTES * 60000) return timedOut();
  const body = await request.json().catch(() => ({}));
  const step = await checkCode(pending.secret, String(body.code ?? '').replace(/\s/g, '').slice(0, 10));
  if (step == null) { await t.fail(); return noStore({ error: 'That code didn’t match. Check the app and try the newest code.' }, 401); }
  await putSetting(db, 'admin_totp', await seal(env, { secret: pending.secret, last: step, since: Date.now() }));
  await db.prepare("DELETE FROM site_settings WHERE key = 'admin_totp_pending'").run();
  await t.clear();
  await logAdmin(db, request, 'Turned on two-step login');
  return noStore({ ok: true }, 200, { 'Set-Cookie': [await sessionCookie(env), clearSetup] });
}

export const logout = () => noStore({ ok: true }, 200, { 'Set-Cookie': [cookie(COOKIE, '', 0), clearSetup] });

// True if the request carries a valid, unexpired session cookie (and two-step login is set up)
export async function signedIn(env, request) {
  if (!configured(env)) return false;
  const m = cookieOf(request, COOKIE);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > Date.now()) || exp > Date.now() + HOURS * 3600 * 1000 + 60000) return false;
  if (!(await equal(env, m[2], await sign(env, `session|${exp}`)))) return false;
  await tables(env.ARCADE);
  return Boolean(await twoStepOf(env));
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
