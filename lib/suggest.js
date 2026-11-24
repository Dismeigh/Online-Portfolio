// Viewer suggestions: quotes for the Quote Board (Lore page) and clips for the home page.
// They wait privately in the dashboard (Content tab) until you approve or delete them.
// Waiting ones are deleted after 90 days; the scrambled visitor ID (only used for rate limits) is wiped once handled.
import { readContent, saveContent } from './content.js';
const KEEP_DAYS = 90;
const line = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const LINKY = /(https?:|www\.|discord\.gg|\b[a-z0-9-]+\.(com|net|org|gg|tv|io|co|me|xyz|ly|app|link|site|info|biz|ru)\b)/i;

// Only clip links from Twitch, YouTube or TikTok
export function clipUrl(raw) {
  let u; try { u = new URL(String(raw ?? '').trim()); } catch { return ''; }
  if (u.protocol !== 'https:' || u.href.length > 300) return '';
  const h = u.hostname.replace(/^(www|m)\./, ''), p = u.pathname;
  const ok = (h === 'clips.twitch.tv' && /^\/[\w-]{4,}\/?$/.test(p)) || (h === 'twitch.tv' && /^\/[\w]{2,30}\/clip\/[\w-]{4,}\/?$/.test(p))
    || (h === 'youtube.com' && (/^\/shorts\/[\w-]{6,}\/?$/.test(p) || (p === '/watch' && /^[\w-]{11}$/.test(u.searchParams.get('v') || ''))))
    || (h === 'youtu.be' && /^\/[\w-]{11}\/?$/.test(p)) || (h === 'tiktok.com' && /^\/@[\w.]{2,30}\/video\/\d{6,}\/?$/.test(p));
  if (!ok) return '';
  u.hash = ''; if (h !== 'youtube.com') u.search = ''; else { const v = u.searchParams.get('v'); u.search = v ? `?v=${v}` : ''; }
  return u.href;
}

let ready = false;
export async function suggestTables(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, text TEXT NOT NULL DEFAULT '',
    game TEXT NOT NULL DEFAULT '', context TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL, visitor TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new')`).run();
  ready = true;
}

export async function submitSuggestion(db, b, visitor) {
  if (b?.website) return { ok: true };
  if (!(Number(b?.elapsed) >= 3000)) return { error: 'Take a second, then try again.' };
  const kind = b?.kind === 'clip' ? 'clip' : 'quote';
  const name = line(b?.name, 20);
  let row;
  if (kind === 'quote') {
    const text = line(b?.text, 200); if (text.length < 4) return { error: 'Type the quote first.', field: 'sq-text' };
    if (LINKY.test(text)) return { error: 'No links in quotes, please.', field: 'sq-text' };
    row = { text, game: line(b?.game, 60), context: line(b?.context, 160), link: '' };
    if (LINKY.test(row.context)) return { error: 'No links here, please.', field: 'sq-context' };
  } else {
    const link = clipUrl(b?.link); if (!link) return { error: 'Paste a Twitch clip, YouTube or TikTok link.', field: 'sc-link' };
    row = { text: line(b?.note, 160), game: '', context: '', link };
    if (LINKY.test(row.text)) return { error: 'Put the link in the link box, not the note.', field: 'sc-note' };
    if (await db.prepare("SELECT 1 FROM suggestions WHERE kind = 'clip' AND link = ?").bind(link).first()) return { error: 'Someone already suggested that clip. Thanks!' };
  }
  const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS n, MAX(at) AS last FROM suggestions WHERE visitor = ? AND at > ?').bind(visitor, now - 86400000).first();
  if (recent?.last && now - recent.last < 120000) return { error: 'Got it! Give it a couple of minutes before sending another.' };
  if ((recent?.n || 0) >= 5) return { error: 'That’s 5 suggestions today. Come back tomorrow!' };
  if (((await db.prepare("SELECT COUNT(*) AS n FROM suggestions WHERE status = 'new'").first())?.n || 0) >= 300) return { error: 'The suggestion box is full right now. Try again in a few days!' };
  await db.prepare('INSERT INTO suggestions (kind, text, game, context, link, name, at, visitor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(kind, row.text, row.game, row.context, row.link, name, now, visitor).run();
  return { ok: true, kind, sent: true };
}

export async function suggestBoard(db) {
  await db.prepare("DELETE FROM suggestions WHERE status = 'new' AND at < ?").bind(Date.now() - KEEP_DAYS * 86400000).run();
  const rows = (await db.prepare("SELECT id, kind, text, game, context, link, name, at, status FROM suggestions WHERE status = 'new' ORDER BY at DESC LIMIT 300").all()).results;
  return { suggestions: rows.map(r => ({ ...r, at: new Date(r.at).toISOString() })) };
}
export async function changeSuggestion(env, b, origin) {
  const db = env.ARCADE, id = Math.round(Number(b?.id)) || 0;
  const r = await db.prepare('SELECT * FROM suggestions WHERE id = ?').bind(id).first(); if (!r) return { error: 'That suggestion is gone.' };
  if (b?.action === 'approve') {
    if (r.kind === 'quote') {
      const cur = (await readContent(env, 'quotes', origin)).quotes || [];
      const text = line(b?.text ?? r.text, 200); if (!text) return { error: 'The quote is empty.' };
      await saveContent(env, 'quotes', [{ text, game: line(b?.game ?? r.game, 60), context: line(b?.context ?? r.context, 160) }, ...cur]);
    }
    await db.prepare("UPDATE suggestions SET status = 'done', visitor = '' WHERE id = ?").bind(id).run();
    return { ok: true, msg: r.kind === 'quote' ? 'Added to the Quote Board.' : 'Marked as done.' };
  }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM suggestions WHERE id = ?').bind(id).run(); return { ok: true, msg: 'Deleted.' }; }
  return { error: 'Unknown action.' };
}
