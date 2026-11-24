// Site feedback box ("Spot a bug or have an idea?" in the footer). Notes land in the dashboard (Overview).
// Stored: the note, its type, which page it was sent from, screen width and browser name (to help reproduce bugs),
// and an optional way to reply. Deleted after 120 days. The scrambled visitor ID (rate limits only) is wiped when handled.
const KEEP_DAYS = 120;
const line = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const para = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
export const TYPES = { bug: 'Bug', idea: 'Idea', other: 'Other' };
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Samsung Internet', 'Opera', 'Other'];

let ready = false;
export async function feedbackTables(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, message TEXT NOT NULL, page TEXT NOT NULL DEFAULT '',
    width INTEGER, browser TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL, visitor TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0)`).run();
  ready = true;
}
export async function submitFeedback(db, b, visitor) {
  if (b?.website) return { ok: true };
  if (!(Number(b?.elapsed) >= 2500)) return { error: 'Take a second, then try again.' };
  const type = Object.hasOwn(TYPES, b?.type) ? b.type : 'other';
  const message = para(b?.message, 1000); if (message.length < 8) return { error: 'Tell me a little more (at least a few words).', field: 'fb-message' };
  const page = /^\/[\w\-/.]{0,100}$/.test(String(b?.page ?? '')) ? String(b.page) : '';
  const width = Math.round(Number(b?.width)); const browser = BROWSERS.includes(b?.browser) ? b.browser : 'Other';
  const contact = line(b?.contact, 100);
  const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS n, MAX(at) AS last FROM feedback WHERE visitor = ? AND at > ?').bind(visitor, now - 86400000).first();
  if (recent?.last && now - recent.last < 60000) return { error: 'Got it! Give it a minute before sending another.' };
  if ((recent?.n || 0) >= 5) return { error: 'That’s 5 notes today. Thanks for all the feedback!' };
  if (((await db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE done = 0').first())?.n || 0) >= 300) return { error: 'The feedback box is full right now. Try again in a few days!' };
  await db.prepare('INSERT INTO feedback (type, message, page, width, browser, contact, at, visitor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(type, message, page, width > 0 && width < 10000 ? width : null, browser, contact, now, visitor).run();
  return { ok: true, sent: true, type };
}
export async function feedbackBoard(db) {
  await db.prepare('DELETE FROM feedback WHERE at < ?').bind(Date.now() - KEEP_DAYS * 86400000).run();
  const rows = (await db.prepare('SELECT id, type, message, page, width, browser, contact, at, done FROM feedback ORDER BY done, at DESC LIMIT 200').all()).results;
  return { feedback: rows.map(r => ({ ...r, done: !!r.done, at: new Date(r.at).toISOString() })) };
}
export async function changeFeedback(db, b) {
  const id = Math.round(Number(b?.id)) || 0;
  if (b?.action === 'done' || b?.action === 'undone') { await db.prepare("UPDATE feedback SET done = ?, visitor = '' WHERE id = ?").bind(b.action === 'done' ? 1 : 0, id).run(); return { ok: true }; }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run(); return { ok: true }; }
  return { error: 'Unknown action.' };
}
