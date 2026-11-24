// Site content edited from the dashboard: bounties, pinned clip, quotes, lore, verdicts, crew, the site banner and
// the holiday look. Saved in D1 (site_settings, key "content:<name>"). Until something is saved from the dashboard,
// the original file in dist/ (e.g. /quotes.json) is used. Every save is cleaned and checked here, server side.

const SEASONS = ['newyear', 'mlk', 'valentines', 'presidents', 'stpatricks', 'easter', 'mothers', 'memorial', 'fathers', 'juneteenth',
  'july4', 'labor', 'spooky', 'veterans', 'thanksgiving', 'holiday', 'birthday', 'anniversary'];

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const httpsUrl = (v, hosts) => {
  try {
    const u = new URL(String(v ?? '').trim());
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    if (hosts && !hosts.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) return '';
    return u.href.slice(0, 300);
  } catch { return ''; }
};
const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && !Number.isNaN(Date.parse(v)) ? String(v) : '');
const list = (v, max, fn) => (Array.isArray(v) ? v : []).slice(0, max).map(fn).filter(Boolean);
const CLIP_HOSTS = ['twitch.tv', 'youtube.com', 'youtu.be', 'tiktok.com'];

// name: [wrapper key in the JSON file, cleaner]
export const CONTENT = {
  bounties: ['bounties', v => list(v, 12, b => {
    const title = text(b?.title, 80); if (!title) return null;
    const status = ['open', 'progress', 'claimed'].includes(b?.status) ? b.status : 'open';
    return { title, details: text(b?.details, 240), reward: text(b?.reward, 120), status, ...(status === 'claimed' ? { claimedBy: text(b?.claimedBy, 40) } : {}) };
  })],
  pinned: ['pinned', v => {
    const url = httpsUrl(v?.url, CLIP_HOSTS);
    return url ? { url, by: text(v?.by, 40), title: text(v?.title, 100), reason: text(v?.reason, 120), until: day(v?.until) } : null;
  }],
  quotes: ['quotes', v => list(v, 200, q => {
    const t = text(q?.text, 200); return t ? { text: t, game: text(q?.game, 60), context: text(q?.context, 160) } : null;
  })],
  lore: ['entries', v => list(v, 100, e => {
    const term = text(e?.term, 60), what = text(e?.what, 400); if (!term || !what) return null;
    const links = list(e?.links, 4, l => { const url = httpsUrl(l?.url); return url ? { label: text(l?.label, 30) || 'Watch', url } : null; });
    return { term, game: text(e?.game, 40), what, links };
  })],
  verdicts: ['verdicts', v => list(v, 60, g => {
    const game = text(g?.game, 60), score = Math.round(Number(g?.score));
    return game && score >= 1 && score <= 5 ? { game, score, take: text(g?.take, 160) } : null;
  })],
  events: ['event', v => {
    const title = text(v?.title, 80), start = Date.parse(v?.start), end = Date.parse(v?.end);
    if (!title || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 86400000) return null;
    const g = v?.goal, target = Number(g?.target), cur = Number(g?.current);
    const goal = target > 0 && target <= 1e9 ? { label: text(g?.label, 60), current: Number.isFinite(cur) ? Math.max(0, Math.min(1e9, cur)) : 0, target, unit: text(g?.unit, 12), url: httpsUrl(g?.url) } : null;
    const schedule = list(v?.schedule, 40, x => { const t = Date.parse(x?.time), name = text(x?.title, 80); return name && Number.isFinite(t) ? { time: new Date(t).toISOString(), title: name } : null; });
    return {
      title, type: ['subathon', 'charity', 'special'].includes(v?.type) ? v.type : 'special',
      start: new Date(start).toISOString(), end: new Date(end).toISOString(),
      description: text(v?.description, 500), link: httpsUrl(v?.link), goal, schedule,
    };
  }],
  pricing: ['pricing', v => list(v, 12, p => {
    const name = text(p?.name, 60); if (!name) return null;
    const points = String(p?.points ?? '').split('\n').map(l => text(l, 120)).filter(Boolean).slice(0, 8).join('\n');
    return { group: p?.group === 'web' ? 'web' : 'discord', name, price: text(p?.price, 30), summary: text(p?.summary, 160), points };
  })],
  crew: ['crew', v => list(v, 20, c => {
    const name = text(c?.name, 30), twitch = String(c?.twitch ?? '').trim().toLowerCase();
    return name && /^[a-z0-9_]{3,25}$/.test(twitch) ? { name, twitch, note: text(c?.note, 200) } : null;
  })],
};

const getRaw = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const putRaw = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();

// The content as the site sees it: { <wrapper>: ... }, from D1 if saved, otherwise the original file
export async function readContent(env, name, origin) {
  const [wrap] = CONTENT[name];
  const saved = env.ARCADE ? await getRaw(env.ARCADE, `content:${name}`).catch(() => null) : null;
  if (saved) { try { return { [wrap]: JSON.parse(saved), saved: true }; } catch {} }
  try {
    const r = await env.ASSETS.fetch(new URL(`/${name}.json`, origin));
    if (r.ok) { const d = await r.json(); return { [wrap]: d?.[wrap] ?? null, saved: false }; }
  } catch {}
  return { [wrap]: name === 'pinned' ? null : [], saved: false };
}
export async function saveContent(env, name, data) {
  const [wrap, clean] = CONTENT[name];
  const value = clean(data);
  await putRaw(env.ARCADE, `content:${name}`, JSON.stringify(value));
  return { [wrap]: value };
}

// Site banner + holiday look (public, small)
export async function siteSettings(db) {
  let banner = null, look = null, commissions = null, now_ = null, liveBar = true;
  try { const lb = JSON.parse(await getRaw(db, 'site:livebar') || 'null'); if (lb && lb.on === false) liveBar = false; } catch {}
  // Scheduled banners: the next one whose start time has come takes over the banner
  try {
    const queue = JSON.parse(await getRaw(db, 'site:banner_queue') || '[]');
    if (Array.isArray(queue) && queue.length) {
      const due = queue.filter(q => q.from <= Date.now());
      if (due.length) {
        const next = due[due.length - 1];
        await putRaw(db, 'site:banner', JSON.stringify({ text: next.text, link: next.link, until: next.until, id: next.id }));
        await putRaw(db, 'site:banner_queue', JSON.stringify(queue.filter(q => q.from > Date.now())));
      }
    }
  } catch {}
  try { now_ = JSON.parse(await getRaw(db, 'site:now') || 'null'); } catch {}
  try { banner = JSON.parse(await getRaw(db, 'site:banner') || 'null'); } catch {}
  try { commissions = JSON.parse(await getRaw(db, 'site:commissions') || 'null'); } catch {}
  try { look = JSON.parse(await getRaw(db, 'site:look') || 'null'); } catch {}
  const now = Date.now();
  if (banner && (!banner.text || (banner.until && now > banner.until))) banner = null;
  if (look && (look.until && now > look.until)) look = null;
  if (now_ && (!now_.text || (now_.until && now > now_.until))) now_ = null;
  return { banner, look: look?.mode && look.mode !== 'auto' ? look : null, commissions, now: now_, liveBar };
}
export async function saveSite(db, b) {
  if (b.what === 'banner') {
    const t = text(b.text, 140);
    const link = String(b.link ?? '').trim().startsWith('/') ? text(b.link, 120).replace(/^\/\/+/, '/') : httpsUrl(b.link);
    const until = Number(b.until) > Date.now() ? Math.min(Number(b.until), Date.now() + 90 * 86400000) : null;
    const value = t ? { text: t, link: link || '', until, id: Date.now() } : null;
    await putRaw(db, 'site:banner', JSON.stringify(value));
    return { banner: value };
  }
  if (b.what === 'look') {
    const mode = b.mode === 'off' || SEASONS.includes(b.mode) ? b.mode : 'auto';
    const until = Number(b.until) > Date.now() ? Math.min(Number(b.until), Date.now() + 60 * 86400000) : null;
    const value = mode === 'auto' ? null : { mode, until };
    await putRaw(db, 'site:look', JSON.stringify(value));
    return { look: value };
  }
  if (b.what === 'now') {
    const t = text(b.text, 100);
    const until = Number(b.until) > Date.now() ? Math.min(Number(b.until), Date.now() + 90 * 86400000) : null;
    const value = t ? { text: t, until, at: Date.now() } : null;
    await putRaw(db, 'site:now', JSON.stringify(value));
    return { now: value };
  }
  if (b.what === 'livebar') {
    await putRaw(db, 'site:livebar', JSON.stringify({ on: b.on !== false }));
    return { liveBar: b.on !== false };
  }
  if (b.what === 'schedule') {
    // Queue a banner to switch on later: { text, link, from, until }
    let queue = []; try { queue = JSON.parse(await getRaw(db, 'site:banner_queue') || '[]') || []; } catch {}
    const from = Number(b.from), t = text(b.text, 140);
    if (!t || !(from > Date.now()) || from > Date.now() + 90 * 86400000) return { error: 'Give it a message and a start time in the next 90 days.' };
    const until = Number(b.until) > from ? Math.min(Number(b.until), from + 90 * 86400000) : null;
    const link = String(b.link ?? '').trim().startsWith('/') ? text(b.link, 120).replace(/^\/\/+/, '/') : httpsUrl(b.link);
    if (queue.length >= 20) return { error: 'That\u2019s 20 scheduled already. Remove one first.' };
    queue.push({ text: t, link: link || '', from, until, id: Date.now() });
    queue.sort((a, b2) => a.from - b2.from);
    await putRaw(db, 'site:banner_queue', JSON.stringify(queue));
    return { queue };
  }
  if (b.what === 'unschedule') {
    let queue = []; try { queue = JSON.parse(await getRaw(db, 'site:banner_queue') || '[]') || []; } catch {}
    queue = queue.filter(q => q.id !== Number(b.id));
    await putRaw(db, 'site:banner_queue', JSON.stringify(queue));
    return { queue };
  }
  if (b.what === 'presets') {
    const value = list(b.presets, 12, p => {
      const t = text(p?.text, 140); if (!t) return null;
      const link = String(p?.link ?? '').trim().startsWith('/') ? text(p.link, 120).replace(/^\/\/+/, '/') : httpsUrl(p?.link);
      const hours = Math.round(Number(p?.hours)); return { text: t, link: link || '', hours: hours > 0 && hours <= 720 ? hours : 0 };
    });
    await putRaw(db, 'site:banner_presets', JSON.stringify(value));
    return { presets: value };
  }
  if (b.what === 'commissions') {
    const state = v => (['open', 'closed'].includes(v) ? v : 'off');
    const value = { voice: state(b.voice), work: state(b.work), note: text(b.note, 120) };
    await putRaw(db, 'site:commissions', JSON.stringify(value));
    return { commissions: value };
  }
  return { error: 'Unknown setting.' };
}
export const SEASON_KEYS = SEASONS;
export const DEFAULT_PRESETS = [
  { text: 'I\u2019m live right now. Come hang out!', link: 'https://twitch.tv/dismeigh', hours: 6 },
  { text: 'No stream tonight. See you next time, space cowboy.', link: '/#schedule', hours: 18 },
  { text: 'New video just dropped!', link: 'https://youtube.com/@dismeigh', hours: 48 },
  { text: 'Running late tonight. Stream starts a little later.', link: '', hours: 4 },
];
export async function bannerQueue(db) {
  try { const v = JSON.parse(await getRaw(db, 'site:banner_queue') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export async function bannerPresets(db) {
  try { const v = JSON.parse(await getRaw(db, 'site:banner_presets') || 'null'); if (Array.isArray(v)) return v; } catch {}
  return DEFAULT_PRESETS;
}
