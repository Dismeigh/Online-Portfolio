// Broken link checker for the dashboard. collectLinks() finds every outside link on the public pages and in the content
// saved from the dashboard; checkLinks() tests up to 10 at a time (the dashboard sends them in small batches).
import { CONTENT, readContent, siteSettings, bannerPresets } from './content.js';
import { PAGES } from './stats.js';

const SKIP = /^https:\/\/(fonts\.(googleapis|gstatic)\.com|decapi\.me|discord\.com\/api|www\.youtube-nocookie\.com\/embed|i\.ytimg\.com)/;
function okUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' || x.username || x.password || x.port) return null;
    const h = x.hostname;
    if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|test)$/.test(h) || /(^|\.)denizen-dismeigh\.com$/.test(h)) return null;
    return x.href;
  } catch { return null; }
}

export async function collectLinks(env, origin) {
  const found = new Map();
  const add = (url, where) => { const u = okUrl(url); if (!u || SKIP.test(u)) return; if (!found.has(u)) found.set(u, new Set()); found.get(u).add(where); };
  for (const p of PAGES) {
    try {
      const r = await env.ASSETS.fetch(new URL(p, origin));
      if (!r.ok) continue;
      const html = await r.text();
      const name = p === '/' ? 'Home page' : p.replace(/\//g, ' ').trim().replace(/^\w/, c => c.toUpperCase()) + ' page';
      for (const m of html.matchAll(/href="(https:\/\/[^"#]+)"/g)) add(m[1].replace(/&amp;/g, '&'), name);
    } catch {}
  }
  const label = { bounties: 'Bounties', pinned: 'Pinned clip', quotes: 'Quotes', lore: 'Lore', verdicts: 'Verdicts', events: 'Special event', crew: 'Crew', pricing: 'Rates', faq: 'Work FAQ', builder: 'Price builder', garage: 'Garage build', captions: 'Clip captions', collabs: 'Past collabs' };
  for (const name of Object.keys(CONTENT)) {
    const v = (await readContent(env, name, origin))[CONTENT[name][0]];
    const walk = x => { if (typeof x === 'string') { if (x.startsWith('https://')) add(x, label[name] || name); } else if (x && typeof x === 'object') Object.values(x).forEach(walk); };
    walk(v);
    if (name === 'crew' && Array.isArray(v)) v.forEach(c => c?.twitch && add(`https://www.twitch.tv/${c.twitch}`, 'Crew'));
  }
  try { const s = await siteSettings(env.ARCADE); if (s.banner?.link) add(s.banner.link, 'Site banner'); } catch {}
  try { (await bannerPresets(env.ARCADE)).forEach(p => p.link && add(p.link, 'One-tap banners')); } catch {}
  return [...found].map(([url, where]) => ({ url, where: [...where] })).slice(0, 200);
}

// Sites that block robots (403/429) are "couldn't check", not broken
export async function checkLinks(urls) {
  const list = [...new Set((Array.isArray(urls) ? urls : []).map(okUrl).filter(Boolean))].slice(0, 10);
  return Promise.all(list.map(async url => {
    const go = method => fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (DismeighLinkCheck; +https://www.denizen-dismeigh.com)' } });
    try {
      let r = await go('HEAD');
      if (r.status === 405 || r.status === 403 || r.status === 400) r = await go('GET');
      const s = r.status;
      return { url, status: s, result: s < 400 ? 'ok' : s === 404 || s === 410 ? 'broken' : 'unknown' };
    } catch { return { url, status: 0, result: 'unknown' }; }
  }));
}
