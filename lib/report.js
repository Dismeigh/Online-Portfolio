// Monthly report for the dashboard: one month of the site and the business on one page, compared with the month before.
// Some things are only kept for a while (Ship's Log 60 days, quote requests 90, secrets 60), so older months show less of those.
import { income } from './clients.js';

const dayKey = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
// Midnight Eastern at the start of a month, as a timestamp (handles daylight saving)
function monthStart(y, m) {
  for (const h of [4, 5]) { const t = Date.UTC(y, m, 1, h); if (dayKey(t) === `${y}-${String(m + 1).padStart(2, '0')}-01` && dayKey(t - 1) !== dayKey(t)) return t; }
  return Date.UTC(y, m, 1, 5);
}
const safe = async p => { try { return await p; } catch { return null; } };

async function numbers(db, ym) {
  const [y, m] = ym.split('-').map(Number), from = monthStart(y, m - 1), to = monthStart(m === 12 ? y + 1 : y, m === 12 ? 0 : m), like = `${ym}-%`;
  const one = async (q, ...a) => (await safe(db.prepare(q).bind(...a).first()))?.n || 0;
  const all = async (q, ...a) => (await safe(db.prepare(q).bind(...a).all()))?.results || [];
  const money = (await safe(income(db)))?.find(x => x.month === ym) || { tips: 0, memberships: 0, kofiSales: 0, clients: 0, expenses: 0, total: 0, profit: 0 };
  return {
    views: await one('SELECT SUM(n) AS n FROM page_views WHERE day LIKE ?', like),
    visitors: await one('SELECT COUNT(*) AS n FROM visitors WHERE created_at >= ? AND created_at < ?', from, to),
    topPages: await all('SELECT path, SUM(n) AS n FROM page_views WHERE day LIKE ? GROUP BY path ORDER BY n DESC LIMIT 5', like),
    busiestDay: (await all('SELECT day, SUM(n) AS n FROM page_views WHERE day LIKE ? GROUP BY day ORDER BY n DESC LIMIT 1', like))[0] || null,
    sources: await all('SELECT source, SUM(n) AS n FROM referrers WHERE day LIKE ? GROUP BY source ORDER BY n DESC LIMIT 5', like),
    searches: await all('SELECT term, SUM(n) AS n, SUM(misses) AS misses FROM search_terms WHERE day LIKE ? GROUP BY term ORDER BY n DESC LIMIT 5', like),
    missed: await all('SELECT term, SUM(misses) AS n FROM search_terms WHERE day LIKE ? GROUP BY term HAVING SUM(misses) > 0 ORDER BY n DESC LIMIT 5', like),
    money,
    kofiCount: await one('SELECT COUNT(*) AS n FROM kofi_payments WHERE at >= ? AND at < ?', from, to),
    quotes: await one('SELECT COUNT(*) AS n FROM quote_requests WHERE at >= ? AND at < ?', from, to),
    jobsNew: await one('SELECT COUNT(*) AS n FROM jobs WHERE at >= ? AND at < ?', from, to),
    jobsDone: await all("SELECT client, service FROM jobs WHERE stage = 'done' AND updated >= ? AND updated < ? ORDER BY updated", from, to),
    auditionsSent: await one('SELECT COUNT(*) AS n FROM auditions WHERE sent LIKE ?', like),
    auditionsBooked: await all("SELECT project, role FROM auditions WHERE status = 'booked' AND updated >= ? AND updated < ?", from, to),
    logEntries: await one('SELECT COUNT(*) AS n FROM guestbook WHERE created_at >= ? AND created_at < ?', from, to),
    scores: await one('SELECT COUNT(*) AS n FROM scores WHERE created_at >= ? AND created_at < ?', from, to),
    topScore: (await all("SELECT name, score FROM scores WHERE game = 'bounty' AND created_at >= ? AND created_at < ? ORDER BY score DESC LIMIT 1", from, to))[0] || null,
    secrets: await one('SELECT COUNT(*) AS n FROM secret_events WHERE at >= ? AND at < ?', from, to),
  };
}

export async function monthlyReport(db, ym) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym || '')) {
    const t = new Date(Date.now()); ym = dayKey(t).slice(0, 7);
  }
  const [y, m] = ym.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const [now, before] = await Promise.all([numbers(db, ym), numbers(db, prev)]);
  // Months that have any data, for the picker (last 24)
  const months = new Set((await safe(db.prepare('SELECT DISTINCT substr(day, 1, 7) AS m FROM page_views ORDER BY m DESC LIMIT 24').all()))?.results.map(r => r.m) || []);
  months.add(dayKey(Date.now()).slice(0, 7));
  return { month: ym, prev, now, before, months: [...months].sort().reverse() };
}
