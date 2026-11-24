// Site health: green/yellow/red lights for the outside services the site leans on, shown on the dashboard.
// A background check (started by a normal site visit, at most every 30 minutes) phones you when one goes down or comes back.
import { loadSchedule } from './schedule.js';
import { fetchFeed } from '../functions/api/youtube.js';
import { maintenanceState } from './maintenance.js';
import { alert, pushTables } from './push.js';

const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
const ago = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };

// The outside services (also used by the background check)
async function outside(env) {
  const run = async (id, name, fn) => { try { return { id, name, ...(await fn()) }; } catch (e) { return { id, name, state: 'down', detail: String(e?.message || 'No answer') }; } };
  return Promise.all([
    run('youtube', 'YouTube feed', async () => { const v = await fetchFeed(3); return v.length ? { state: 'ok', detail: `Newest: ${v[0].title}` } : { state: 'warn', detail: 'Feed answered but had no videos' }; }),
    run('calendar', 'Stream calendar', async () => {
      if (!env.CALENDAR_FEED_URL) return { state: 'warn', detail: 'CALENDAR_FEED_URL isn’t set in Cloudflare' };
      const s = await loadSchedule({ feed: env.CALENDAR_FEED_URL });
      return { state: 'ok', detail: s.next ? `Next: ${s.next.title || 'stream'}` : 'Working, nothing scheduled yet' };
    }),
    run('twitch', 'Twitch live check', async () => {
      const r = await fetch('https://decapi.me/twitch/uptime/dismeigh', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return { state: 'down', detail: `Answered ${r.status}` };
      const t = (await r.text()).trim();
      return { state: 'ok', detail: /offline|not live/i.test(t) ? 'You’re offline right now' : 'You’re live right now' };
    }),
  ]);
}

export async function healthReport(env) {
  const db = env.ARCADE, list = [];
  try { await db.prepare('SELECT 1').first(); list.push({ id: 'db', name: 'Database', state: 'ok', detail: 'Connected' }); }
  catch { list.push({ id: 'db', name: 'Database', state: 'down', detail: 'Not answering' }); }
  list.push(...(await outside(env)));
  let kofi;
  if (!env.KOFI_VERIFICATION_TOKEN) kofi = { state: 'warn', detail: 'KOFI_VERIFICATION_TOKEN isn’t set, so tips won’t count' };
  else {
    const last = (await db.prepare('SELECT MAX(at) AS at FROM kofi_payments').first().catch(() => null))?.at;
    kofi = { state: 'ok', detail: last ? `Connected. Last payment ${ago(Date.now() - last)}` : 'Connected. No payments yet' };
  }
  list.push({ id: 'kofi', name: 'Ko-fi webhook', ...kofi });
  try {
    await pushTables(db);
    const n = (await db.prepare('SELECT COUNT(*) AS n FROM push_subs').first())?.n || 0;
    list.push({ id: 'alerts', name: 'Phone alerts', state: n ? 'ok' : 'warn', detail: n ? `${n} device${n === 1 ? '' : 's'} signed up` : 'No devices yet (Alerts tab)' });
  } catch { list.push({ id: 'alerts', name: 'Phone alerts', state: 'warn', detail: 'Couldn’t check' }); }
  const m = await maintenanceState(db);
  list.push({ id: 'shop', name: 'Public site', state: m.on ? 'warn' : 'ok', detail: m.on ? 'Closed for maintenance' : 'Open' });
  const lastBg = Number(await get(db, 'health:at')) || 0;
  return { checks: list, checkedAt: new Date().toISOString(), lastBackground: lastBg ? new Date(lastBg).toISOString() : null };
}

// Background: at most every 30 minutes, claimed so only one request runs it
export async function maybeHealthCheck(env) {
  try {
    const db = env.ARCADE, now = Date.now();
    await db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('health:at', '0')").run();
    const claim = await db.prepare("UPDATE site_settings SET value = ? WHERE key = 'health:at' AND CAST(value AS INTEGER) < ?").bind(String(now), now - 30 * 60000).run();
    if (!claim.meta?.changes) return;
    const results = await outside(env);
    let before = {}; try { before = JSON.parse((await get(db, 'health:last')) || '{}') || {}; } catch {}
    const after = Object.fromEntries(results.map(r => [r.id, r.state]));
    await put(db, 'health:last', JSON.stringify(after));
    for (const r of results) {
      if (r.state === 'down' && before[r.id] && before[r.id] !== 'down') await alert(env, 'health', { title: `${r.name} is down`, body: `${r.detail}. The site keeps working; that part just won’t update until it’s back.`, tab: 'overview' });
      if (r.state === 'ok' && before[r.id] === 'down') await alert(env, 'health', { title: `${r.name} is back`, body: 'All good again.', tab: 'overview' });
    }
  } catch {}
}
