// Collab requests: the form on the press kit page (only while "Open to collabs" is on in the dashboard).
// They land in the dashboard (Clients tab) and are deleted after 120 days.
import { collabSetting } from './content.js';
const KEEP_DAYS = 120;
const line = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const para = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const httpsUrl = v => { try { const u = new URL(String(v ?? '').trim()); return u.protocol === 'https:' && u.href.length <= 300 ? u.href : ''; } catch { return ''; } };
export const OTHER = 'Something else';

let ready = false;
export async function collabTables(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS collab_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL,
    kind TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, replied INTEGER NOT NULL DEFAULT 0, visitor TEXT NOT NULL DEFAULT '')`).run();
  ready = true;
}
export async function submitCollab(db, b, visitor) {
  if (b?.website) return { ok: true };
  if (!(Number(b?.elapsed) >= 4000)) return { error: 'Take a second, then try again.' };
  const set = await collabSetting(db); if (!set.on) return { error: 'Collab requests are closed right now.' };
  const name = line(b?.name, 60); if (name.length < 2) return { error: 'Add your name or channel.', field: 'cr-name' };
  const contact = line(b?.contact, 120); if (contact.length < 3) return { error: 'Add an email or Discord username so I can reply.', field: 'cr-contact' };
  const kind = [...set.kinds, OTHER].includes(b?.kind) ? b.kind : null; if (!kind) return { error: 'Pick what kind of collab.', field: 'cr-kind' };
  const link = httpsUrl(b?.link); if (String(b?.link ?? '').trim() && !link) return { error: 'The link should start with https://', field: 'cr-link' };
  const message = para(b?.message, 1000); if (message.length < 10) return { error: 'Tell me a little about the idea.', field: 'cr-message' };
  const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS n, MAX(at) AS last FROM collab_requests WHERE visitor = ? AND at > ?').bind(visitor, now - 86400000).first();
  if (recent?.last && now - recent.last < 120000) return { error: 'Got your last one! Give it a couple of minutes before sending another.' };
  if ((recent?.n || 0) >= 3) return { error: 'That’s 3 requests today. I’ll get back to you soon!' };
  const r = await db.prepare('INSERT INTO collab_requests (at, name, contact, kind, link, message, visitor) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(now, name, contact, kind, link, message, visitor).run();
  return { ok: true, id: r.meta?.last_row_id, name, kind };
}
export async function collabBoard(db) {
  await db.prepare('DELETE FROM collab_requests WHERE at < ?').bind(Date.now() - KEEP_DAYS * 86400000).run();
  const rows = (await db.prepare('SELECT id, at, name, contact, kind, link, message, replied FROM collab_requests ORDER BY replied, at DESC LIMIT 200').all()).results;
  return { collabs: rows.map(r => ({ ...r, replied: !!r.replied, at: new Date(r.at).toISOString(), expires: new Date(r.at + KEEP_DAYS * 86400000).toISOString() })) };
}
export async function changeCollab(db, b) {
  const id = Math.round(Number(b?.id)) || 0;
  if (b?.action === 'replied' || b?.action === 'unreplied') { await db.prepare("UPDATE collab_requests SET replied = ?, visitor = '' WHERE id = ?").bind(b.action === 'replied' ? 1 : 0, id).run(); return { ok: true }; }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM collab_requests WHERE id = ?').bind(id).run(); return { ok: true }; }
  return { error: 'Unknown action.' };
}
