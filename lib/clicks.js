// Link tap counts: which outside links people tap (Twitch, Discord, Ko-fi...). Only a count per link type per day.
// Nothing about the visitor is sent or stored. Shown in the dashboard (Overview).
export const LINKS = { 'twitch.tv': 'Twitch', 'discord.gg': 'Discord', 'discord.com': 'Discord', 'ko-fi.com': 'Ko-fi', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
  'tiktok.com': 'TikTok', 'instagram.com': 'Instagram', 'x.com': 'X', 'twitter.com': 'X', 'dubby.gg': 'Dubby', 'spotify.com': 'Spotify (Xssy)', 'soundcloud.com': 'SoundCloud',
  'calendar.google.com': 'Google Calendar', email: 'Email', calendar: 'Calendar subscribe', other: 'Other sites' };
export const keyOf = raw => {
  const k = String(raw ?? '').toLowerCase();
  if (k === 'email' || k === 'calendar') return k;
  const host = k.replace(/^(www|m|clips|open|music)\./, '');
  return Object.hasOwn(LINKS, host) ? host : 'other';
};
let ready = false;
export async function clickTables(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS link_clicks (day TEXT NOT NULL, link TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, link))').run();
  ready = true;
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(Date.now());
export async function countClick(db, raw) {
  await db.prepare('INSERT INTO link_clicks (day, link, n) VALUES (?, ?, 1) ON CONFLICT(day, link) DO UPDATE SET n = n + 1').bind(today(), keyOf(raw)).run();
  if (Math.random() < 0.01) await db.prepare('DELETE FROM link_clicks WHERE day < ?').bind(new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)).run();
}
export async function clickBoard(db, days) {
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const rows = (await db.prepare('SELECT link, SUM(n) AS n FROM link_clicks WHERE day >= ? GROUP BY link').bind(from).all()).results;
  const merged = {};
  for (const r of rows) { const name = LINKS[r.link] || 'Other sites'; merged[name] = (merged[name] || 0) + r.n; }
  return { days, links: Object.entries(merged).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n) };
}
