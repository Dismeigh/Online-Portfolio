// GET /api/youtube -> { videos: [{ id, title, published, url, thumb, short }] }
// Newest uploads from the Dismeigh YouTube channel's public feed, arranged by the dashboard's clip settings (lib/clips.js).
import { clipSettings, arrange } from '../../lib/clips.js';
const CHANNEL_ID = 'UCx0VYoE6vgo8oOLU44XCJMw';
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function parseFeed(xml, limit = 3) {
  const entries = xml.split('<entry>').slice(1);
  return entries.slice(0, limit).map(entry => {
    const pick = tag => decode((entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '').trim();
    const id = pick('yt:videoId');
    const link = (entry.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || `https://www.youtube.com/watch?v=${id}`;
    const title = pick('title').replace(/\s*#\S+/g, '').trim() || pick('title');
    return {
      id,
      title,
      published: pick('published'),
      url: link,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      short: link.includes('/shorts/'),
    };
  }).filter(v => /^[\w-]{11}$/.test(v.id));
}

export async function fetchFeed(limit = 15) {
  const response = await fetch(FEED, { signal: AbortSignal.timeout(8000), cf: { cacheTtl: 900, cacheEverything: true } });
  if (!response.ok) throw new Error('Feed unavailable');
  return parseFeed(await response.text(), limit);
}

export async function onRequestGet({ env }) {
  try {
    let settings = { count: 3, pinned: [], hidden: [] };
    try { if (env?.ARCADE) settings = await clipSettings(env.ARCADE); } catch {}
    let feed = [];
    try { feed = await fetchFeed(); } catch { if (!settings.pinned.length) throw new Error('Feed unavailable'); }
    const videos = arrange(feed, settings);
    return Response.json({ videos }, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch {
    return Response.json({ error: 'YouTube feed unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
