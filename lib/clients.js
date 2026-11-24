// Quote requests from the Work page, and the client board in the dashboard (Clients tab).
// Requests delete themselves after 90 days unless kept or turned into a job. Nothing about the visitor is stored
// except a scrambled key used for the "3 a day" limit, and that's cleared after a day.
export const SERVICES = ['Discord server setup', 'Mod team setup & training', 'Monthly server care', 'One-page website', 'Multi-page website', 'Monthly site care', 'Voice acting', 'Something else'];
export const BUDGETS = ['Under $100', '$100 to $300', '$300 to $750', '$750 to $1,500', '$1,500+', 'Not sure yet'];
export const TIMELINES = ['As soon as possible', 'Within a month', '1 to 3 months', 'No rush'];
export const STAGES = ['quote', 'booked', 'deposit', 'progress', 'done'];
const KEEP_DAYS = 90;
const line = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const para = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const links = v => String(v ?? '').split(/[\s,]+/).map(s => s.trim()).filter(s => /^https:\/\/[^\s<>"]{3,290}$/.test(s)).slice(0, 3);

let ready = false;
export async function clientTables(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS quote_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, service TEXT NOT NULL, budget TEXT, timeline TEXT, links TEXT, message TEXT NOT NULL, visitor TEXT, status TEXT NOT NULL DEFAULT \'new\', keep INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, updated INTEGER NOT NULL, client TEXT NOT NULL, contact TEXT, service TEXT, price TEXT, stage TEXT NOT NULL, due TEXT, notes TEXT, request_id INTEGER)'),
  ]);
  ready = true;
}

export async function tidy(db) {
  const now = Date.now();
  await db.prepare('DELETE FROM quote_requests WHERE keep = 0 AND at < ?').bind(now - KEEP_DAYS * 86400000).run();
  await db.prepare('UPDATE quote_requests SET visitor = NULL WHERE visitor IS NOT NULL AND at < ?').bind(now - 86400000).run();
}

// Public form. Returns { ok } or { error, field }
export async function submitQuote(db, b, visitor) {
  if (b?.website) return { ok: true };                                   // bot trap
  if (!(Number(b?.elapsed) >= 4000)) return { error: 'Take a second, then try again.' };
  const name = line(b?.name, 60); if (name.length < 2) return { error: 'Add your name (or your server or business name).', field: 'q-name' };
  const contact = line(b?.contact, 120); if (contact.length < 3) return { error: 'Add an email or Discord username so I can reply.', field: 'q-contact' };
  const service = SERVICES.includes(b?.service) ? b.service : null; if (!service) return { error: 'Pick what you need.', field: 'q-service' };
  const budget = BUDGETS.includes(b?.budget) ? b.budget : 'Not sure yet';
  const timeline = TIMELINES.includes(b?.timeline) ? b.timeline : 'No rush';
  const message = para(b?.message, 1500); if (message.length < 10) return { error: 'Tell me a little about the project.', field: 'q-message' };
  const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS n, MAX(at) AS last FROM quote_requests WHERE visitor = ? AND at > ?').bind(visitor, now - 86400000).first();
  if (recent?.last && now - recent.last < 120000) return { error: 'Got your last one! Give it a couple of minutes before sending another.' };
  if ((recent?.n || 0) >= 3) return { error: 'That’s 3 requests today. I’ll get back to you soon!' };
  const r = await db.prepare('INSERT INTO quote_requests (at, name, contact, service, budget, timeline, links, message, visitor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(now, name, contact, service, budget, timeline, JSON.stringify(links(b?.links)), message, visitor).run();
  if (Math.random() < 0.2) await tidy(db);
  return { ok: true, id: r.meta?.last_row_id, name, service };
}

// Dashboard
export async function clientBoard(db) {
  await tidy(db);
  const reqs = (await db.prepare('SELECT id, at, name, contact, service, budget, timeline, links, message, status, keep FROM quote_requests ORDER BY at DESC LIMIT 200').all()).results
    .map(r => ({ ...r, links: JSON.parse(r.links || '[]'), keep: !!r.keep, at: new Date(r.at).toISOString(), expires: r.keep ? null : new Date(r.at + KEEP_DAYS * 86400000).toISOString() }));
  const jobs = (await db.prepare('SELECT * FROM jobs ORDER BY CASE stage WHEN \'done\' THEN 1 ELSE 0 END, COALESCE(due, \'9999\'), updated DESC LIMIT 300').all()).results
    .map(j => ({ ...j, at: new Date(j.at).toISOString(), updated: new Date(j.updated).toISOString() }));
  return { requests: reqs, jobs, services: SERVICES, stages: STAGES };
}
const cleanJob = b => ({
  client: line(b?.client, 80), contact: line(b?.contact, 120), service: line(b?.service, 60), price: line(b?.price, 40),
  stage: STAGES.includes(b?.stage) ? b.stage : 'quote', due: /^\d{4}-\d{2}-\d{2}$/.test(b?.due || '') ? b.due : null, notes: para(b?.notes, 3000),
});
export async function changeClients(db, b) {
  const id = Number(b?.id), now = Date.now();
  switch (b?.action) {
    case 'reqStatus': await db.prepare('UPDATE quote_requests SET status = ? WHERE id = ?').bind(['new', 'replied', 'archived'].includes(b.status) ? b.status : 'new', id).run(); break;
    case 'reqKeep': await db.prepare('UPDATE quote_requests SET keep = ? WHERE id = ?').bind(b.keep ? 1 : 0, id).run(); break;
    case 'reqDelete': await db.prepare('DELETE FROM quote_requests WHERE id = ?').bind(id).run(); break;
    case 'toJob': {
      const r = await db.prepare('SELECT * FROM quote_requests WHERE id = ?').bind(id).first(); if (!r) return { error: 'That request is gone.' };
      const notes = [r.message, r.budget && `Budget: ${r.budget}`, r.timeline && `Timeline: ${r.timeline}`, ...JSON.parse(r.links || '[]')].filter(Boolean).join('\n');
      await db.prepare('INSERT INTO jobs (at, updated, client, contact, service, price, stage, due, notes, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(now, now, r.name, r.contact, r.service, '', 'quote', null, notes, id).run();
      await db.prepare("UPDATE quote_requests SET status = 'archived', keep = 1 WHERE id = ?").bind(id).run();
      break;
    }
    case 'jobSave': {
      const j = cleanJob(b); if (!j.client) return { error: 'Give the job a client name.' };
      if (id) await db.prepare('UPDATE jobs SET updated = ?, client = ?, contact = ?, service = ?, price = ?, stage = ?, due = ?, notes = ? WHERE id = ?').bind(now, j.client, j.contact, j.service, j.price, j.stage, j.due, j.notes, id).run();
      else {
        const n = (await db.prepare('SELECT COUNT(*) AS n FROM jobs').first())?.n || 0; if (n >= 300) return { error: 'That’s 300 jobs. Delete some finished ones first.' };
        await db.prepare('INSERT INTO jobs (at, updated, client, contact, service, price, stage, due, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(now, now, j.client, j.contact, j.service, j.price, j.stage, j.due, j.notes).run();
      }
      break;
    }
    case 'jobStage': await db.prepare('UPDATE jobs SET stage = ?, updated = ? WHERE id = ?').bind(STAGES.includes(b.stage) ? b.stage : 'quote', now, id).run(); break;
    case 'jobDelete': await db.prepare('DELETE FROM jobs WHERE id = ?').bind(id).run(); break;
    default: return { error: 'Unknown action.' };
  }
  return { ok: true, ...(await clientBoard(db)) };
}
