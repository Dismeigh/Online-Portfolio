// Client reviews: once a job is marked done, the client's private status page asks for a short review.
// Reviews only show on the Work page after you approve them in the dashboard (Clients tab). Only approved,
// consented reviews are public: the name the client chose to show, their stars, their words and the service.
const line = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const para = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const okToken = t => /^[A-Za-z0-9_-]{16,64}$/.test(String(t ?? ''));

let ready = false;
export async function reviewTables(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL UNIQUE, rating INTEGER NOT NULL,
    text TEXT NOT NULL, name TEXT NOT NULL, service TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new')`).run();
  ready = true;
}
// For the status page: can this client leave a review, and did they already?
export async function reviewState(db, token) {
  if (!okToken(token)) return null;
  const j = await db.prepare('SELECT id, stage FROM jobs WHERE token = ?').bind(token).first(); if (!j) return null;
  const r = await db.prepare('SELECT rating, text, name FROM reviews WHERE job_id = ?').bind(j.id).first();
  return { open: j.stage === 'done', mine: r || null };
}
export async function submitReview(db, b) {
  if (!okToken(b?.s)) return { error: 'This link isn’t active.' };
  const j = await db.prepare('SELECT id, stage, service FROM jobs WHERE token = ?').bind(b.s).first();
  if (!j) return { error: 'This link isn’t active.' };
  if (j.stage !== 'done') return { error: 'Reviews open once the project is done.' };
  if (b?.consent !== true) return { error: 'Tick the box so the review can be shown on the site.' };
  const rating = Math.round(Number(b?.rating)); if (!(rating >= 1 && rating <= 5)) return { error: 'Pick 1 to 5 stars.' };
  const text = para(b?.text, 600); if (text.length < 10) return { error: 'Write a sentence or two.', field: 'rv-text' };
  if (/(https?:|www\.)/i.test(text)) return { error: 'No links in reviews, please.', field: 'rv-text' };
  const name = line(b?.name, 40); if (name.length < 2) return { error: 'Add the name to show with your review.', field: 'rv-name' };
  const prev = await db.prepare('SELECT status, at FROM reviews WHERE job_id = ?').bind(j.id).first();
  if (prev && Date.now() - prev.at < 60000) return { error: 'Saved a moment ago. Give it a minute before changing it again.' };
  // Editing a review sends it back for approval
  await db.prepare(`INSERT INTO reviews (job_id, rating, text, name, service, at, status) VALUES (?, ?, ?, ?, ?, ?, 'new')
    ON CONFLICT(job_id) DO UPDATE SET rating = excluded.rating, text = excluded.text, name = excluded.name, at = excluded.at, status = 'new'`)
    .bind(j.id, rating, text, name, line(j.service, 80), Date.now()).run();
  return { ok: true, edited: !!prev, ping: !prev || prev.status !== 'new' };
}
export async function publicReviews(db) {
  const rows = (await db.prepare("SELECT rating, text, name, service, at FROM reviews WHERE status = 'approved' ORDER BY at DESC LIMIT 30").all()).results;
  return { reviews: rows.map(r => ({ ...r, at: new Date(r.at).toISOString().slice(0, 10) })) };
}
export async function reviewBoard(db) {
  const rows = (await db.prepare("SELECT r.id, r.rating, r.text, r.name, r.service, r.at, r.status, j.client FROM reviews r LEFT JOIN jobs j ON j.id = r.job_id ORDER BY CASE r.status WHEN 'new' THEN 0 ELSE 1 END, r.at DESC LIMIT 200").all()).results;
  return { reviews: rows.map(r => ({ ...r, at: new Date(r.at).toISOString() })) };
}
export async function changeReview(db, b) {
  const id = Math.round(Number(b?.id)) || 0;
  if (['approve', 'hide'].includes(b?.action)) { await db.prepare('UPDATE reviews SET status = ? WHERE id = ?').bind(b.action === 'approve' ? 'approved' : 'hidden', id).run(); return { ok: true }; }
  if (b?.action === 'delete') { await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run(); return { ok: true }; }
  return { error: 'Unknown action.' };
}
