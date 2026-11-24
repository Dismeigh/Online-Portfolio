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
    db.prepare('CREATE TABLE IF NOT EXISTS secret_events (at INTEGER NOT NULL, id TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS referrers (day TEXT NOT NULL, source TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, source))'),
  ]);
  ready = true;
}

export async function countView(db, rawPath) {
  let path = String(rawPath || '/').split(/[?#]/)[0].replace(/index\.html$/, '');
  if (!path.endsWith('/')) path += '/';
  if (!PAGES.includes(path)) path = 'other';
  await db.prepare('INSERT INTO page_views (day, path, n) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET n = n + 1').bind(dayKey(Date.now()), path).run();
}

// Where visitors come from: the other site's name only (no full link, nothing about the visitor), counted per day.
const SOURCES = [
  [/(^|\.)twitch\.tv$/, 'Twitch'], [/(^|\.)(discord\.com|discordapp\.com|discord\.gg)$/, 'Discord'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'X / Twitter'], [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(facebook\.com|fb\.com|m\.facebook\.com|l\.facebook\.com)$/, 'Facebook'], [/(^|\.)reddit\.com$/, 'Reddit'], [/(^|\.)bsky\.app$/, 'Bluesky'],
  [/(^|\.)ko-fi\.com$/, 'Ko-fi'], [/(^|\.)(linktr\.ee|beacons\.ai|carrd\.co)$/, 'Link in bio'], [/(^|\.)757animeclub\.com$/, '757 Anime Club'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)(search\.yahoo\.com|yahoo\.com)$/, 'Yahoo'],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai)$/, 'AI chat'],
];
export function sourceOf(raw) {
  if (raw === 'direct') return 'Direct / app';
  if (raw === 'qr-card') return 'Business card QR';
  const host = String(raw || '').toLowerCase().replace(/^www\./, '').slice(0, 80);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /(^|\.)denizen-dismeigh\.com$/.test(host)) return null;
  for (const [re, name] of SOURCES) if (re.test(host)) return name;
  return host.slice(0, 60);
}
export async function countSource(db, raw) {
  let s = sourceOf(raw); if (!s) return;
  const day = dayKey(Date.now());
  if (!SOURCES.some(([, n]) => n === s) && s !== 'Direct / app') {
    // Unknown sites: keep the name, but only up to 40 different ones a day (stops junk filling the table)
    const known = await db.prepare('SELECT n FROM referrers WHERE day = ? AND source = ?').bind(day, s).first();
    if (!known && ((await db.prepare('SELECT COUNT(*) AS n FROM referrers WHERE day = ?').bind(day).first())?.n || 0) >= 40) s = 'Other sites';
  }
  await db.prepare('INSERT INTO referrers (day, source, n) VALUES (?, ?, 1) ON CONFLICT(day, source) DO UPDATE SET n = n + 1').bind(day, s).run();
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
    sources: (await safe(db.prepare('SELECT source, SUM(n) AS n FROM referrers WHERE day >= ? GROUP BY source ORDER BY n DESC LIMIT 12').bind(dayKey(d30)).all()))?.results || [],
  };
}

// ---------- Secrets found (counts only) ----------
export const SECRET_NAMES = { bang: 'BANG!', redline: 'Redline', bounty: 'Bounty claimed', realone: 'For the real ones', swordfish: 'Swordfish', explorer: 'Explorer',
  spotted: 'Spotted in the wild', konami: 'Cheat code', nightowl: 'Night owl', arcade: 'Arcade master', lorebuff: 'Lore buff', tourgrad: 'Tour graduate', license: 'Bounty Hunter license (all secrets)' };
export async function countSecret(db, id) {
  if (!Object.hasOwn(SECRET_NAMES, String(id))) return;
  await db.prepare('INSERT INTO secret_counts (id, n) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1').bind(String(id)).run();
  await db.prepare('INSERT INTO secret_events (at, id) VALUES (?, ?)').bind(Date.now(), String(id)).run();
  if (Math.random() < 0.05) await db.prepare('DELETE FROM secret_events WHERE at < ?').bind(Date.now() - 60 * DAY).run();
}

// Dashboard activity feed: the newest happenings across the site, last 30 days (only what's already stored)
export async function activity(db) {
  const since = Date.now() - 30 * DAY, rows = async (q, ...a) => ((await safe(db.prepare(q).bind(...a).all()))?.results || []);
  const usd = c => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  const items = [
    ...(await rows('SELECT name, message, created_at AS at, hidden FROM guestbook WHERE created_at >= ? ORDER BY created_at DESC LIMIT 40', since))
      .map(r => ({ at: r.at, kind: 'log', text: `${r.name} signed the Ship\u2019s Log`, detail: r.message, hidden: !!r.hidden })),
    ...(await rows('SELECT type, amount_cents, currency, at FROM kofi_payments WHERE at >= ? ORDER BY at DESC LIMIT 40', since))
      .map(r => ({ at: r.at, kind: 'kofi', text: `${r.currency === 'USD' ? usd(r.amount_cents) : `${(r.amount_cents / 100).toFixed(2)} ${r.currency}`} Ko-fi ${({ Donation: 'tip', Subscription: 'membership', 'Shop Order': 'shop order', Commission: 'commission' })[r.type] || 'payment'}` })),
    ...(await rows('SELECT name, score, game, created_at AS at FROM scores WHERE created_at >= ? ORDER BY created_at DESC LIMIT 40', since))
      .map(r => ({ at: r.at, kind: 'arcade', text: `${r.name} posted ${r.game === 'drag' ? `${r.score} ms in Launch Control` : `${Number(r.score).toLocaleString('en-US')} in Bounty Run`}` })),
    ...(await rows('SELECT at, id FROM secret_events WHERE at >= ? ORDER BY at DESC LIMIT 40', since))
      .map(r => ({ at: r.at, kind: 'secret', text: r.id === 'license' ? 'Someone found all the secrets (Bounty Hunter license)' : `Someone found a secret: ${SECRET_NAMES[r.id] || r.id}` })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, 50).map(x => ({ ...x, at: new Date(x.at).toISOString() }));
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
