// "Ask the captain": viewers send a question, it waits privately in the dashboard (Ship's Log tab),
// and only shows on /ask/ after you answer it. Unanswered questions are deleted after 90 days.
// The visitor key (a scrambled ID, used only for rate limits) is wiped once a question is answered.
import { cleanName, cleanMessage } from './guestbook.js';

export const Q_MAX = 280, A_MAX = 1200, NAME_MAX = 20;
const KEEP_DAYS = 90;
const para = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

let ready = false;
export async function askTables(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, q TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL, answer TEXT NOT NULL DEFAULT '', answered_at INTEGER, hidden INTEGER NOT NULL DEFAULT 0, visitor TEXT NOT NULL DEFAULT '')`).run();
  ready = true;
}

export async function publicAnswers(db) {
  return (await db.prepare('SELECT id, q, name, answer, answered_at FROM questions WHERE answered_at IS NOT NULL AND hidden = 0 ORDER BY answered_at DESC LIMIT 100').all()).results
    .map(r => ({ id: r.id, q: r.q, name: r.name || 'Anonymous', answer: r.answer, at: new Date(r.answered_at).toISOString() }));
}

export async function submitQuestion(db, b, visitor) {
  if (b?.website) return { ok: true };                               // bot trap
  if (!(Number(b?.elapsed) >= 3000)) return { error: 'Take a second, then try again.' };
  const m = cleanMessage(b?.q, Q_MAX, 'questions'); if (m.error) return { error: m.error.replace('Messages', 'Questions').replace('Write a message first.', 'Type your question first.'), field: 'ask-q' };
  if (m.message.length < 5) return { error: 'Type your question first.', field: 'ask-q' };
  let name = '';
  if (String(b?.name ?? '').trim()) { const n = cleanName(b.name, NAME_MAX); if (n.error) return { error: n.error, field: 'ask-name' }; name = n.name; }
  const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS n, MAX(at) AS last FROM questions WHERE visitor = ? AND at > ?').bind(visitor, now - 86400000).first();
  if (recent?.last && now - recent.last < 120000) return { error: 'Got it! Give it a couple of minutes before asking another.' };
  if ((recent?.n || 0) >= 5) return { error: 'That’s 5 questions today. Come back tomorrow!' };
  const waiting = (await db.prepare('SELECT COUNT(*) AS n FROM questions WHERE answered_at IS NULL').first())?.n || 0;
  if (waiting >= 300) return { error: 'The inbox is full right now. Try again in a few days!' };
  const r = await db.prepare('INSERT INTO questions (q, name, at, visitor) VALUES (?, ?, ?, ?)').bind(m.message, name, now, visitor).run();
  if (Math.random() < 0.1) await db.prepare('DELETE FROM questions WHERE answered_at IS NULL AND at < ?').bind(now - KEEP_DAYS * 86400000).run();
  return { ok: true, id: r.meta?.last_row_id, q: m.message, name: name || 'Anonymous' };
}

export async function askBoard(db) {
  await db.prepare('DELETE FROM questions WHERE answered_at IS NULL AND at < ?').bind(Date.now() - KEEP_DAYS * 86400000).run();
  const rows = (await db.prepare('SELECT id, q, name, at, answer, answered_at, hidden FROM questions ORDER BY CASE WHEN answered_at IS NULL THEN 0 ELSE 1 END, COALESCE(answered_at, at) DESC LIMIT 300').all()).results;
  return { questions: rows.map(r => ({ ...r, name: r.name || 'Anonymous', hidden: !!r.hidden, at: new Date(r.at).toISOString(), answered_at: r.answered_at ? new Date(r.answered_at).toISOString() : null })) };
}

export async function changeAsk(db, b) {
  const id = Math.round(Number(b?.id)) || 0;
  if (b?.action === 'answer') {
    const a = para(b.answer, A_MAX); if (a.length < 1) return { error: 'Type an answer first.' };
    const r = await db.prepare('SELECT answered_at FROM questions WHERE id = ?').bind(id).first(); if (!r) return { error: 'That question is gone.' };
    await db.prepare("UPDATE questions SET answer = ?, answered_at = ?, visitor = '' WHERE id = ?").bind(a, r.answered_at || Date.now(), id).run();
    return { ok: true };
  }
  if (b?.action === 'hide' || b?.action === 'unhide') { await db.prepare('UPDATE questions SET hidden = ? WHERE id = ?').bind(b.action === 'hide' ? 1 : 0, id).run(); return { ok: true }; }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM questions WHERE id = ?').bind(id).run(); return { ok: true }; }
  return { error: 'Unknown action.' };
}
