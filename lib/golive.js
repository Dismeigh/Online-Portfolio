// Go-live alerts for viewers: anyone can tap "Notify me when Dismeigh goes live" and get a browser/phone notification.
// Stored: only the push address their browser gives us (and its encryption keys), nothing about who they are.
// Sending happens in small batches (Cloudflare limits how many requests one visit can make), carried on by
// later page views and by the dashboard button. Alerts start from the dashboard ("I'm live") or automatically
// when the stream is detected live (checked at most every 5 minutes), once per stream.
import { pushTables, publicKey, cleanSub, sendOne } from './push.js';
import { channelStatus } from './twitch.js';
const BATCH = 30, GAP = 3 * 3600000;
const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
const getJ = async (db, k) => { try { return JSON.parse(await get(db, k) || 'null'); } catch { return null; } };
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

let ready = false;
export async function goliveTables(db) {
  if (ready) return;
  await pushTables(db);
  await db.prepare('CREATE TABLE IF NOT EXISTS viewer_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL)').run();
  ready = true;
}
export const viewerKey = env => publicKey(env);
export async function subscribe(env, raw) {
  const db = env.ARCADE, sub = cleanSub(raw); if (!sub) return { error: 'This browser can’t get notifications from here.' };
  if (((await db.prepare('SELECT COUNT(*) AS n FROM viewer_subs').first())?.n || 0) >= 50000) return { error: 'Alerts are full right now. Follow on Twitch instead!' };
  await db.prepare('INSERT INTO viewer_subs (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth')
    .bind(sub.endpoint, sub.p256dh, sub.auth, Date.now()).run();
  return { ok: true };
}
export async function unsubscribe(env, endpoint) {
  await env.ARCADE.prepare('DELETE FROM viewer_subs WHERE endpoint = ?').bind(String(endpoint ?? '').slice(0, 1000)).run();
  return { ok: true };
}

export async function settings(db) { return { auto: (await get(db, 'golive:auto')) !== '0', message: (await get(db, 'golive:message')) || 'Dismeigh is live! Come hang out on Twitch.' }; }
export async function startAlert(env, { message, force = false } = {}) {
  const db = env.ARCADE, last = await getJ(db, 'golive:job');
  if (last && !force && Date.now() - last.at < GAP) return { skipped: true, job: last };
  const s = await settings(db);
  const job = { at: Date.now(), message: text(message, 120) || s.message, cursor: '', sent: 0, done: false, total: (await db.prepare('SELECT COUNT(*) AS n FROM viewer_subs').first())?.n || 0 };
  await put(db, 'golive:job', JSON.stringify(job));
  await put(db, 'golive:armed', '0');
  return { ok: true, job };
}
// Send the next batch of the current alert (if any). Safe to call from anywhere; returns the job state.
export async function workAlert(env, limit = BATCH) {
  const db = env.ARCADE, job = await getJ(db, 'golive:job');
  if (!job || job.done) return job;
  if (Date.now() - job.at > 2 * 3600000) { job.done = true; await put(db, 'golive:job', JSON.stringify(job)); return job; }  // too late to matter
  // Claim this batch so two visits don't send the same one
  const claim = `${job.at}:${job.cursor}:${Math.floor(Date.now() / 60000)}`;  // a stuck batch can be retried a minute later
  const r = await db.prepare("INSERT INTO site_settings (key, value) VALUES ('golive:claim', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE site_settings.value <> excluded.value").bind(claim).run();
  if (!r.meta?.changes) return job;
  const rows = (await db.prepare('SELECT endpoint, p256dh, auth FROM viewer_subs WHERE endpoint > ? ORDER BY endpoint LIMIT ?').bind(job.cursor, limit).all()).results;
  const msg = { viewer: true, title: 'Dismeigh is live!', body: job.message, url: 'https://twitch.tv/dismeigh' };
  await Promise.all(rows.map(s => sendOne(env, s, msg, 'viewer_subs').catch(() => 0)));
  job.sent += rows.length; job.cursor = rows.length ? rows.at(-1).endpoint : job.cursor; job.done = rows.length < limit;
  await put(db, 'golive:job', JSON.stringify(job));
  return job;
}
// Called from page views: checks Twitch at most every 5 minutes; when it goes live, starts the alert once per stream
export async function maybeAutoAlert(env) {
  try {
    const db = env.ARCADE; await goliveTables(db);
    await workAlert(env);
    if (!(await settings(db)).auto) return;
    const slot = String(Math.floor(Date.now() / 300000));
    const r = await db.prepare("INSERT INTO site_settings (key, value) VALUES ('golive:check', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE site_settings.value <> excluded.value").bind(slot).run();
    if (!r.meta?.changes) return;
    const live = (await channelStatus(env)).live;
    if (!live) { await put(db, 'golive:armed', '1'); return; }
    if ((await get(db, 'golive:armed')) !== '0') { await startAlert(env); await workAlert(env); }
  } catch {}
}
export async function goliveBoard(env) {
  const db = env.ARCADE;
  return { count: (await db.prepare('SELECT COUNT(*) AS n FROM viewer_subs').first())?.n || 0, job: await getJ(db, 'golive:job'), ...(await settings(db)) };
}
