// "Fresh off YouTube" row on the home page, managed from the dashboard (Content tab): pin videos to the front (in your
// order), hide ones you don't want, and pick how many show. Stored in D1 site_settings, key "content:clips".
const KEY = 'content:clips';
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const vid = v => (/^[\w-]{11}$/.test(String(v ?? '')) ? String(v) : null);
export const COUNTS = [3, 6];

export async function clipSettings(db) {
  try {
    const v = JSON.parse((await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(KEY).first())?.value || 'null');
    if (v) return { count: COUNTS.includes(v.count) ? v.count : 3, pinned: Array.isArray(v.pinned) ? v.pinned : [], hidden: Array.isArray(v.hidden) ? v.hidden : [] };
  } catch {}
  return { count: 3, pinned: [], hidden: [] };
}
export function cleanClips(b) {
  const seen = new Set();
  const pinned = (Array.isArray(b?.pinned) ? b.pinned : []).slice(0, 6).map(p => {
    const id = vid(p?.id); if (!id || seen.has(id)) return null; seen.add(id);
    const published = Number.isFinite(Date.parse(p?.published)) ? new Date(p.published).toISOString() : '';
    return { id, title: text(p?.title, 120) || 'Video', published, short: p?.short === true };
  }).filter(Boolean);
  const hidden = [...new Set((Array.isArray(b?.hidden) ? b.hidden : []).map(vid).filter(Boolean))].filter(id => !seen.has(id)).slice(0, 100);
  return { count: COUNTS.includes(Number(b?.count)) ? Number(b.count) : 3, pinned, hidden };
}
export async function saveClips(db, b) {
  const v = cleanClips(b);
  await db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(KEY, JSON.stringify(v)).run();
  return v;
}
// Pinned first (in order), then the newest that aren't hidden or already pinned
export function arrange(feed, s) {
  const full = p => ({ ...p, url: p.short ? `https://www.youtube.com/shorts/${p.id}` : `https://www.youtube.com/watch?v=${p.id}`, thumb: `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg`, pinned: true });
  const pins = s.pinned.map(p => { const live = feed.find(v => v.id === p.id); return live ? { ...live, pinned: true } : full(p); });
  const ids = new Set([...pins.map(p => p.id), ...s.hidden]);
  return [...pins, ...feed.filter(v => !ids.has(v.id))].slice(0, s.count);
}
