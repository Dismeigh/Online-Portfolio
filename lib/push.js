// Phone alerts for the dashboard app (Web Push, RFC 8030/8291/8292), built on WebCrypto only.
// Each device that turns alerts on is a row in push_subs with its own choices. Alert text is encrypted
// end to end, so the push service (Apple/Google/Mozilla) can't read it.
import { seal, unseal } from './admin.js';

export const KINDS = ['log', 'kofi', 'goal', 'login', 'recap', 'health', 'quote', 'ask', 'collab', 'suggest', 'feedback', 'milestone'];
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const enc = s => new TextEncoder().encode(s);
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(s).length % 4)) % 4)), c => c.charCodeAt(0));
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; };

export async function pushTables(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, kinds TEXT NOT NULL, label TEXT, created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
  ]);
  // One time: phones already set up to get quote requests also get the new "question for the captain" alerts
  // (same for collab requests)
  for (const kind of ['ask', 'collab', 'suggest', 'feedback', 'milestone']) {
    if (await db.prepare('SELECT 1 FROM site_settings WHERE key = ?').bind(`push_${kind}_added`).first()) continue;
    for (const r of (await db.prepare('SELECT endpoint, kinds FROM push_subs').all()).results) {
      const k = JSON.parse(r.kinds || '[]') || [];
      if (k.includes(kind === 'milestone' ? 'recap' : 'quote') && !k.includes(kind)) await db.prepare('UPDATE push_subs SET kinds = ? WHERE endpoint = ?').bind(JSON.stringify([...k, kind]), r.endpoint).run();
    }
    await db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)').bind(`push_${kind}_added`, '1').run();
  }
}
const getS = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value || null;
const putS = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();

// The site's push identity (VAPID key pair). Made once and stored encrypted with the dashboard password.
async function vapid(env) {
  const db = env.ARCADE;
  let v = await unseal(env, await getS(db, 'push_vapid'));
  if (!v?.priv || !v?.pub) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    v = { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)) };
    await putS(db, 'push_vapid', await seal(env, v));
    await db.prepare('DELETE FROM push_subs').run(); // old devices were tied to the old key
  }
  return v;
}
export const publicKey = async env => { await pushTables(env.ARCADE); return (await vapid(env)).pub; };

export function cleanSub(s) {
  const endpoint = String(s?.endpoint || '');
  let u; try { u = new URL(endpoint); } catch { return null; }
  if (u.protocol !== 'https:' || endpoint.length > 1000 || !PUSH_HOSTS.some(r => r.test(u.hostname))) return null;
  const p256dh = String(s?.keys?.p256dh || ''), auth = String(s?.keys?.auth || '');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}
export const cleanKinds = k => KINDS.filter(x => Array.isArray(k) && k.includes(x));

// RFC 8291 "aes128gcm" encryption of the alert for one device
export async function encryptFor(sub, payload) {
  const uaPublic = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const hkdf = async (salt, ikm, info, bytes) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info },
    await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));
  const ikm = await hkdf(authSecret, ecdh, cat(enc('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return { body: cat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct), asPublic };
}

async function vapidHeader(env, endpoint) {
  const v = await vapid(env);
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://www.denizen-dismeigh.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${v.pub}`;
}

export async function sendOne(env, sub, msg, table = 'push_subs') {
  const { body } = await encryptFor(sub, JSON.stringify(msg));
  const r = await fetch(sub.endpoint, {
    method: 'POST', body,
    headers: { Authorization: await vapidHeader(env, sub.endpoint), TTL: '86400', Urgency: 'normal', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' },
  });
  if (r.status === 404 || r.status === 410) await env.ARCADE.prepare(`DELETE FROM ${table === 'viewer_subs' ? 'viewer_subs' : 'push_subs'} WHERE endpoint = ?`).bind(sub.endpoint).run();
  return r.status;
}

// Send an alert of one kind to every device that asked for it. Never throws.
// msg: { title, body, tab, focus } — tab is the dashboard tab to open when the alert is tapped; focus (like "ask-12") is the item to jump to.
export async function alert(env, kind, msg, onlyEndpoint) {
  try {
    if (!env.ARCADE || !env.DASHBOARD_PASSWORD) return [];
    await pushTables(env.ARCADE);
    const rows = (await env.ARCADE.prepare('SELECT endpoint, p256dh, auth, kinds FROM push_subs').all()).results
      .filter(s => (onlyEndpoint ? s.endpoint === onlyEndpoint : (JSON.parse(s.kinds || '[]') || []).includes(kind)));
    return await Promise.all(rows.map(s => sendOne(env, s, { title: String(msg.title).slice(0, 80), body: String(msg.body || '').slice(0, 180), tab: msg.tab || 'overview', focus: /^[a-z]+-\d+$/.test(msg.focus || '') ? msg.focus : '' }).catch(() => 0)));
  } catch { return []; }
}

// Failed-login alerts at most once every 10 minutes, so a bot can't flood the phone
export async function loginAlert(env, what) {
  try {
    await pushTables(env.ARCADE);
    const last = Number(await getS(env.ARCADE, 'push_last_login')) || 0;
    if (Date.now() - last < 10 * 60000) return;
    await putS(env.ARCADE, 'push_last_login', String(Date.now()));
    await alert(env, 'login', { title: 'Dashboard login attempt', body: `${what}. If that wasn’t you, check the Security & backups tab.`, tab: 'security' });
  } catch {}
}

// Weekly recap: sent once, the first time the site is visited after 9 AM Eastern on a Monday (Pages has no timer,
// so a visit is the alarm clock). The UPDATE only succeeds for one request, so it can't go out twice.
export async function maybeWeeklyRecap(env, stats) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    if (p.weekday !== 'Mon' || Number(p.hour) < 9) return;
    const week = `${p.year}-${p.month}-${p.day}`, db = env.ARCADE;
    await pushTables(db);
    const subs = (await db.prepare("SELECT COUNT(*) AS n FROM push_subs WHERE kinds LIKE '%recap%'").first())?.n || 0;
    if (!subs) return;
    await db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('push_recap_week', '')").run();
    const claim = await db.prepare("UPDATE site_settings SET value = ? WHERE key = 'push_recap_week' AND value != ?").bind(week, week).run();
    if (!claim.meta?.changes) return;
    const s = await stats(db), d7 = Date.now() - 7 * 86400000;
    const tips = (await db.prepare('SELECT COUNT(*) AS n FROM kofi_payments WHERE at >= ?').bind(d7).first().catch(() => null))?.n || 0;
    const plays = s.arcade.bounty.week + s.arcade.drag.week, top = (s.sources || [])[0];
    const bits = [`${s.views.week} views`, `${s.visitors.week} new visitors`, `${s.guestbook.week} log sign${s.guestbook.week === 1 ? '' : 's'}`, `${tips} Ko-fi tip${tips === 1 ? '' : 's'}`, `${plays} arcade plays`];
    await alert(env, 'recap', { title: 'Your week on the site', body: `${bits.join(' \u00b7 ')}${top ? `. Most came from ${top.source}.` : '.'}`, tab: 'overview' });
  } catch {}
}

// Monthly report reminder: the first visit after 9 AM Eastern on the 1st sends one alert (same "recap" switch)
export async function maybeMonthlyReport(env) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    if (p.day !== '01' || Number(p.hour) < 9) return;
    const db = env.ARCADE, key = `${p.year}-${p.month}`;
    await pushTables(db);
    if (!((await db.prepare("SELECT COUNT(*) AS n FROM push_subs WHERE kinds LIKE '%recap%'").first())?.n)) return;
    await db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('push_report_month', '')").run();
    const claim = await db.prepare("UPDATE site_settings SET value = ? WHERE key = 'push_report_month' AND value != ?").bind(key, key).run();
    if (!claim.meta?.changes) return;
    const last = new Date(Date.UTC(Number(p.year), Number(p.month) - 2, 15)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    await alert(env, 'recap', { title: `Your ${last} report is ready`, body: 'Visits, money, jobs and auditions for the month, on one page in the dashboard.', tab: 'overview' });
  } catch {}
}

// Dashboard API
export async function devices(env) {
  await pushTables(env.ARCADE);
  const rows = (await env.ARCADE.prepare('SELECT endpoint, kinds, label, created_at FROM push_subs ORDER BY created_at').all()).results;
  return rows.map(r => ({ id: r.endpoint.slice(-12), endpoint: r.endpoint, kinds: JSON.parse(r.kinds || '[]'), label: r.label || 'Device', at: new Date(r.created_at).toISOString() }));
}
export async function changePush(env, b) {
  const db = env.ARCADE; await pushTables(db);
  if (b.action === 'subscribe') {
    const s = cleanSub(b.sub); if (!s) return { error: 'This device’s alert address wasn’t accepted.' };
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM push_subs').first())?.n || 0;
    if (count >= 10) return { error: 'That’s 10 devices already. Turn one off first.' };
    const label = String(b.label || 'Device').replace(/[^\w .'()-]/g, '').slice(0, 40) || 'Device';
    await db.prepare('INSERT INTO push_subs (endpoint, p256dh, auth, kinds, label, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, kinds = excluded.kinds')
      .bind(s.endpoint, s.p256dh, s.auth, JSON.stringify(cleanKinds(b.kinds ?? KINDS)), label, Date.now()).run();
    return { ok: true };
  }
  const endpoint = String(b.endpoint || '');
  if (b.action === 'kinds') { await db.prepare('UPDATE push_subs SET kinds = ? WHERE endpoint = ?').bind(JSON.stringify(cleanKinds(b.kinds)), endpoint).run(); return { ok: true }; }
  if (b.action === 'remove') { await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run(); return { ok: true }; }
  if (b.action === 'test') {
    const sent = await alert(env, 'test', { title: 'Test alert', body: 'Alerts are working on this device. See you, space cowboy.', tab: 'alerts' }, endpoint);
    if (!sent.length) return { error: 'That device isn’t set up for alerts.' };
    return sent[0] >= 200 && sent[0] < 300 ? { ok: true } : { error: `The alert service said no (${sent[0] || 'no answer'}). Try turning alerts off and on again.` };
  }
  return { error: 'Unknown action.' };
}
