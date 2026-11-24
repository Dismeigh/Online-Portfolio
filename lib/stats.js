// Private site stats for the dashboard. Page views are counted per page per day, nothing else:
// no IP address, no cookie, no browser details, nothing that can tell one visitor from another.
// Everything else (visitors, arcade plays, guestbook signs, Ko-fi payments) comes from tables the site already keeps.

export const PAGES = ['/', '/garage/', '/work/', '/voice/', '/crew/', '/shelf/', '/guide/', '/log/', '/lore/', '/rewind/', '/event/', '/install/', '/wallpapers/'];
const DAY = 86400000;
const dayKey = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));   // Eastern days

let ready = false;
export async function statsTables(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS page_views (day TEXT NOT NULL, path TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, path))'),
    db.prepare('CREATE TABLE IF NOT EXISTS admin_log (at INTEGER NOT NULL, event TEXT NOT NULL, place TEXT NOT NULL, device TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS secret_counts (id TEXT PRIMARY KEY, n INTEGER NOT NULL)'),
  ]);
  ready = true;
}

export async function countView(db, rawPath) {
  let path = String(rawPath || '/').split(/[?#]/)[0].replace(/index\.html$/, '');
  if (!path.endsWith('/')) path += '/';
  if (!PAGES.includes(path)) path = 'other';
  await db.prepare('INSERT INTO page_views (day, path, n) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET n = n + 1').bind(dayKey(Date.now()), path).run();
}

const safe = async p => { try { return await p; } catch { return null; } };   // a table may not exist yet
export async function siteStats(db) {
  const now = Date.now(), d7 = now - 7 * DAY, d30 = now - 30 * DAY;
  const n = async (q, ...a) => (await safe(db.prepare(q).bind(...a).first()))?.n || 0;
  const days = [...Array(14)].map((_, i) => dayKey(now - (13 - i) * DAY));
  const views = (await safe(db.prepare('SELECT day, SUM(n) AS n FROM page_views WHERE day >= ? GROUP BY day').bind(days[0]).all()))?.results || [];
  const byDay = Object.fromEntries(views.map(r => [r.day, r.n]));
  const top = (await safe(db.prepare('SELECT path, SUM(n) AS n FROM page_views WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 8').bind(dayKey(d30)).all()))?.results || [];
  return {
    views: { today: byDay[dayKey(now)] || 0, week: await n('SELECT SUM(n) AS n FROM page_views WHERE day >= ?', dayKey(d7)), month: await n('SELECT SUM(n) AS n FROM page_views WHERE day >= ?', dayKey(d30)) },
    daily: days.map(d => ({ day: d, n: byDay[d] || 0 })),
    topPages: top,
    visitors: { total: await n('SELECT COUNT(*) AS n FROM visitors'), week: await n('SELECT COUNT(*) AS n FROM visitors WHERE created_at >= ?', d7), month: await n('SELECT COUNT(*) AS n FROM visitors WHERE created_at >= ?', d30) },
    arcade: {
      bounty: { week: await n("SELECT COUNT(*) AS n FROM runs WHERE game = 'bounty' AND started_at >= ?", d7), month: await n("SELECT COUNT(*) AS n FROM runs WHERE game = 'bounty' AND started_at >= ?", d30) },
      drag: { week: await n("SELECT COUNT(*) AS n FROM runs WHERE game = 'drag' AND started_at >= ?", d7), month: await n("SELECT COUNT(*) AS n FROM runs WHERE game = 'drag' AND started_at >= ?", d30) },
    },
    guestbook: { week: await n('SELECT COUNT(*) AS n FROM guestbook WHERE created_at >= ?', d7), month: await n('SELECT COUNT(*) AS n FROM guestbook WHERE created_at >= ?', d30) },
    kofi: { month: await n('SELECT COUNT(*) AS n FROM kofi_payments WHERE at >= ?', d30) },
    since: (await safe(db.prepare('SELECT MIN(day) AS d FROM page_views').first()))?.d || null,
    secrets: (await safe(secretStats(db))) || [],
  };
}

// ---------- Secrets found (counts only) ----------
export const SECRET_NAMES = { bang: 'BANG!', redline: 'Redline', bounty: 'Bounty claimed', realone: 'For the real ones', swordfish: 'Swordfish', explorer: 'Explorer',
  spotted: 'Spotted in the wild', konami: 'Cheat code', nightowl: 'Night owl', arcade: 'Arcade master', lorebuff: 'Lore buff', tourgrad: 'Tour graduate', license: 'Bounty Hunter license (all secrets)' };
export async function countSecret(db, id) {
  if (!Object.hasOwn(SECRET_NAMES, String(id))) return;
  await db.prepare('INSERT INTO secret_counts (id, n) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1').bind(String(id)).run();
}
export async function secretStats(db) {
  const rows = Object.fromEntries(((await db.prepare('SELECT id, n FROM secret_counts').all()).results || []).map(r => [r.id, r.n]));
  return Object.entries(SECRET_NAMES).map(([id, name]) => ({ id, name, n: rows[id] || 0 }));
}

// ---------- Dashboard login history ----------
function device(ua) {
  ua = String(ua || '');
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${br} on ${os}`;
}
export async function logAdmin(db, request, event) {
  try {
    await statsTables(db);
    const cf = request.cf || {};
    const place = [cf.city, cf.region, request.headers.get('CF-IPCountry') || cf.country].filter(Boolean).join(', ').slice(0, 80) || 'Unknown';
    await db.prepare('INSERT INTO admin_log (at, event, place, device) VALUES (?, ?, ?, ?)').bind(Date.now(), event, place, device(request.headers.get('User-Agent'))).run();
    await db.prepare('DELETE FROM admin_log WHERE at < ?').bind(Date.now() - 90 * DAY).run();
  } catch {}
}
export async function adminHistory(db) {
  await statsTables(db);
  return (await db.prepare('SELECT at, event, place, device FROM admin_log ORDER BY at DESC LIMIT 40').all()).results.map(r => ({ ...r, at: new Date(r.at).toISOString() }));
}
