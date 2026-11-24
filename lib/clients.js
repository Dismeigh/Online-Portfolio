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
    db.prepare('CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, job_id INTEGER, amount_cents INTEGER NOT NULL, method TEXT NOT NULL, note TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, amount_cents INTEGER NOT NULL, category TEXT NOT NULL, note TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS auditions (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT NOT NULL, role TEXT, sent TEXT, deadline TEXT, status TEXT NOT NULL, link TEXT, notes TEXT, updated INTEGER NOT NULL)'),
  ]);
  // Newer job columns: client status link + note, invoice (added to older tables one at a time)
  for (const col of ['token TEXT', 'client_note TEXT', 'invoice TEXT', 'inv_token TEXT', 'agreement TEXT', 'agr_token TEXT', 'ref_code TEXT']) {
    try { await db.prepare(`ALTER TABLE jobs ADD COLUMN ${col}`).run(); } catch {}
  }
  try { await db.prepare('ALTER TABLE quote_requests ADD COLUMN ref_job INTEGER').run(); } catch {}
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
  const ref = /^[A-Z2-9]{6}$/.test(String(b?.ref || '')) ? (await db.prepare('SELECT id FROM jobs WHERE ref_code = ?').bind(b.ref).first())?.id || null : null;
  const r = await db.prepare('INSERT INTO quote_requests (at, name, contact, service, budget, timeline, links, message, visitor, ref_job) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(now, name, contact, service, budget, timeline, JSON.stringify(links(b?.links)), message, visitor, ref).run();
  if (Math.random() < 0.2) await tidy(db);
  return { ok: true, id: r.meta?.last_row_id, name, service };
}

// Dashboard
export async function clientBoard(db) {
  await tidy(db);
  const reqs = (await db.prepare('SELECT q.id, q.at, q.name, q.contact, q.service, q.budget, q.timeline, q.links, q.message, q.status, q.keep, j.client AS referred_by FROM quote_requests q LEFT JOIN jobs j ON j.id = q.ref_job ORDER BY q.at DESC LIMIT 200').all()).results
    .map(r => ({ ...r, links: JSON.parse(r.links || '[]'), keep: !!r.keep, at: new Date(r.at).toISOString(), expires: r.keep ? null : new Date(r.at + KEEP_DAYS * 86400000).toISOString() }));
  const payments = (await db.prepare('SELECT * FROM payments ORDER BY day DESC, id DESC LIMIT 500').all()).results;
  const jobs = (await db.prepare('SELECT * FROM jobs ORDER BY CASE stage WHEN \'done\' THEN 1 ELSE 0 END, COALESCE(due, \'9999\'), updated DESC LIMIT 300').all()).results
    .map(j => ({ ...j, agreement: j.agreement ? JSON.parse(j.agreement) : null, invoice: j.invoice ? JSON.parse(j.invoice) : null, at: new Date(j.at).toISOString(), updated: new Date(j.updated).toISOString() }));
  const expenses = (await db.prepare('SELECT * FROM expenses ORDER BY day DESC, id DESC LIMIT 500').all()).results;
  const auditions = (await db.prepare("SELECT * FROM auditions ORDER BY CASE status WHEN 'sent' THEN 0 WHEN 'callback' THEN 0 ELSE 1 END, COALESCE(deadline, sent, '9999') DESC LIMIT 300").all()).results;
  return { requests: reqs, jobs, payments, expenses, auditions, services: SERVICES, stages: STAGES, methods: METHODS, categories: CATEGORIES, auditionStatus: AUD_STATUS };
}
const cleanJob = b => ({
  client: line(b?.client, 80), contact: line(b?.contact, 120), service: line(b?.service, 60), price: line(b?.price, 40),
  stage: STAGES.includes(b?.stage) ? b.stage : 'quote', due: /^\d{4}-\d{2}-\d{2}$/.test(b?.due || '') ? b.due : null, notes: para(b?.notes, 3000),
});
// Private links: long random codes, so they can't be guessed
export const newToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const okToken = t => /^[A-Za-z0-9_-]{20,40}$/.test(String(t || ''));
export const CATEGORIES = ['Software & subscriptions', 'Domains & hosting', 'Hardware & gear', 'Car', 'Marketing', 'Contractors', 'Other'];
export const AUD_STATUS = ['sent', 'callback', 'booked', 'passed'];
const newRef = () => [...crypto.getRandomValues(new Uint8Array(6))].map(x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
// Project agreement: what's included, price, rounds and payment terms. The client signs on a private link.
export function cleanAgreement(v) {
  return {
    scope: para(v?.scope, 2000), price: line(v?.price, 40), rounds: line(v?.rounds, 60), payment: para(v?.payment, 600), timeline: line(v?.timeline, 120),
    extra: para(v?.extra, 1500), made: /^\d{4}-\d{2}-\d{2}$/.test(v?.made || '') ? v.made : new Date().toISOString().slice(0, 10), signed: null,
  };
}
export async function jobAgreement(db, token) {
  if (!okToken(token)) return null;
  const j = await db.prepare('SELECT client, service, agreement FROM jobs WHERE agr_token = ?').bind(token).first();
  return j?.agreement ? { client: j.client, service: j.service, ...JSON.parse(j.agreement) } : null;
}
export async function signAgreement(db, token, name) {
  if (!okToken(token)) return { error: 'This link isn\u2019t active.' };
  const j = await db.prepare('SELECT id, agreement FROM jobs WHERE agr_token = ?').bind(token).first();
  if (!j?.agreement) return { error: 'This link isn\u2019t active.' };
  const a = JSON.parse(j.agreement);
  if (a.signed) return { error: 'This agreement is already signed.' };
  const n = line(name, 80); if (n.length < 2) return { error: 'Type your full name to sign.' };
  a.signed = { name: n, at: new Date().toISOString() };
  await db.prepare('UPDATE jobs SET agreement = ?, updated = ? WHERE id = ?').bind(JSON.stringify(a), Date.now(), j.id).run();
  return { ok: true, signed: a.signed, jobId: j.id };
}
export const METHODS = ['Ko-fi', 'PayPal', 'Cash App', 'Venmo', 'Zelle', 'Stripe', 'Cash', 'Other'];
const cents = v => { const n = Math.round(Number(String(v ?? '').replace(/[$,\s]/g, '')) * 100); return Number.isFinite(n) && n > 0 && n < 1e9 ? n : 0; };
const payLink = v => (/^https:\/\/[^\s<>"]{3,300}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');
export function cleanInvoice(v) {
  const items = (Array.isArray(v?.items) ? v.items : []).slice(0, 20).map(i => ({ desc: line(i?.desc, 120), cents: cents(i?.amount ?? (i?.cents / 100)) })).filter(i => i.desc && i.cents);
  return {
    number: line(v?.number, 20), issued: /^\d{4}-\d{2}-\d{2}$/.test(v?.issued || '') ? v.issued : new Date().toISOString().slice(0, 10),
    items, deposit: Math.max(0, Math.min(100, Math.round(Number(v?.deposit) || 0))), payLink: payLink(v?.payLink), payLabel: line(v?.payLabel, 40) || 'Pay now',
    terms: para(v?.terms, 600), status: ['unpaid', 'deposit', 'paid'].includes(v?.status) ? v.status : 'unpaid',
  };
}

// What a client sees on their status link: no contact info, price or private notes
export async function jobStatus(db, token) {
  if (!okToken(token)) return null;
  const j = await db.prepare('SELECT client, service, stage, due, client_note, updated FROM jobs WHERE token = ?').bind(token).first();
  return j && { client: j.client, service: j.service, stage: j.stage, due: j.due, note: j.client_note || '', updated: new Date(j.updated).toISOString() };
}
export async function jobInvoice(db, token) {
  if (!okToken(token)) return null;
  const j = await db.prepare('SELECT client, service, invoice FROM jobs WHERE inv_token = ?').bind(token).first();
  return j?.invoice ? { client: j.client, service: j.service, ...JSON.parse(j.invoice) } : null;
}

// Money in per month: Ko-fi (all kinds) plus payments you record. Ko-fi payments you record are skipped in totals,
// since the Ko-fi webhook already counted them.
export async function income(db) {
  const months = new Map(), key = d => d.slice(0, 7);
  const add = (m, k, c) => { if (!months.has(m)) months.set(m, { month: m, tips: 0, memberships: 0, kofiSales: 0, clients: 0, expenses: 0 }); months.get(m)[k] += c; };
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  const kofi = (await db.prepare("SELECT type, amount_cents, at FROM kofi_payments WHERE currency = 'USD'").all().catch(() => ({ results: [] }))).results;
  for (const k of kofi) add(key(fmt.format(new Date(k.at))), k.type === 'Donation' ? 'tips' : k.type === 'Subscription' ? 'memberships' : 'kofiSales', k.amount_cents);
  const pays = (await db.prepare('SELECT day, amount_cents, method FROM payments').all()).results;
  for (const p of pays) if (p.method !== 'Ko-fi') add(key(p.day), 'clients', p.amount_cents);
  for (const e of (await db.prepare('SELECT day, amount_cents FROM expenses').all()).results) add(key(e.day), 'expenses', e.amount_cents);
  return [...months.values()].map(m => { const total = m.tips + m.memberships + m.kofiSales + m.clients; return { ...m, total, profit: total - m.expenses }; }).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 24);
}

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
    case 'jobShare': await db.prepare('UPDATE jobs SET token = ? WHERE id = ?').bind(b.on ? newToken() : null, id).run(); break;
    case 'jobClientNote': await db.prepare('UPDATE jobs SET client_note = ?, updated = ? WHERE id = ?').bind(para(b.note, 600), now, id).run(); break;
    case 'invoiceSave': {
      const inv = cleanInvoice(b.invoice); if (!inv.items.length) return { error: 'Add at least one line with an amount.' };
      const j = await db.prepare('SELECT inv_token FROM jobs WHERE id = ?').bind(id).first(); if (!j) return { error: 'That job is gone.' };
      if (!inv.number) inv.number = `DT-${String(id).padStart(4, '0')}`;
      await db.prepare('UPDATE jobs SET invoice = ?, inv_token = ? WHERE id = ?').bind(JSON.stringify(inv), j.inv_token || newToken(), id).run();
      break;
    }
    case 'invoiceOff': await db.prepare('UPDATE jobs SET inv_token = NULL WHERE id = ?').bind(id).run(); break;
    case 'invoiceNewLink': await db.prepare('UPDATE jobs SET inv_token = ? WHERE id = ? AND invoice IS NOT NULL').bind(newToken(), id).run(); break;
    case 'payAdd': {
      const c = cents(b.amount); if (!c) return { error: 'Enter an amount, like 150 or 150.00.' };
      const day = /^\d{4}-\d{2}-\d{2}$/.test(b.day || '') ? b.day : new Date().toISOString().slice(0, 10);
      const n = (await db.prepare('SELECT COUNT(*) AS n FROM payments').first())?.n || 0; if (n >= 2000) return { error: 'That\u2019s 2,000 payments. Download your income file and delete old ones first.' };
      await db.prepare('INSERT INTO payments (day, job_id, amount_cents, method, note) VALUES (?, ?, ?, ?, ?)').bind(day, Number(b.job_id) || null, c, METHODS.includes(b.method) ? b.method : 'Other', line(b.note, 120)).run();
      break;
    }
    case 'payDelete': await db.prepare('DELETE FROM payments WHERE id = ?').bind(id).run(); break;
    case 'agreementSave': {
      const a = cleanAgreement(b.agreement); if (!a.scope) return { error: 'Write what\u2019s included first.' };
      const j = await db.prepare('SELECT agr_token, agreement FROM jobs WHERE id = ?').bind(id).first(); if (!j) return { error: 'That job is gone.' };
      const old = j.agreement ? JSON.parse(j.agreement) : null;
      // Editing a signed agreement makes a new version: the old signature is cleared and a fresh link is made
      const token = old?.signed ? newToken() : (j.agr_token || newToken());
      await db.prepare('UPDATE jobs SET agreement = ?, agr_token = ?, updated = ? WHERE id = ?').bind(JSON.stringify(a), token, now, id).run();
      break;
    }
    case 'agreementOff': await db.prepare('UPDATE jobs SET agr_token = NULL WHERE id = ?').bind(id).run(); break;
    case 'agreementOn': await db.prepare('UPDATE jobs SET agr_token = ? WHERE id = ? AND agreement IS NOT NULL').bind(newToken(), id).run(); break;
    case 'refOn': await db.prepare('UPDATE jobs SET ref_code = ? WHERE id = ? AND ref_code IS NULL').bind(newRef(), id).run(); break;
    case 'refOff': await db.prepare('UPDATE jobs SET ref_code = NULL WHERE id = ?').bind(id).run(); break;
    case 'expAdd': {
      const c = cents(b.amount); if (!c) return { error: 'Enter an amount, like 12.99.' };
      const n = (await db.prepare('SELECT COUNT(*) AS n FROM expenses').first())?.n || 0; if (n >= 2000) return { error: 'That\u2019s 2,000 expenses. Download the spreadsheet and delete old ones first.' };
      await db.prepare('INSERT INTO expenses (day, amount_cents, category, note) VALUES (?, ?, ?, ?)').bind(/^\d{4}-\d{2}-\d{2}$/.test(b.day || '') ? b.day : new Date().toISOString().slice(0, 10), c, CATEGORIES.includes(b.category) ? b.category : 'Other', line(b.note, 120)).run();
      break;
    }
    case 'expDelete': await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run(); break;
    case 'audSave': {
      const project = line(b.project, 80); if (!project) return { error: 'Add the project name.' };
      const d = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
      const vals = [project, line(b.role, 80), d(b.sent), d(b.deadline), AUD_STATUS.includes(b.status) ? b.status : 'sent', payLink(b.link), para(b.notes, 1500), now];
      if (id) await db.prepare('UPDATE auditions SET project = ?, role = ?, sent = ?, deadline = ?, status = ?, link = ?, notes = ?, updated = ? WHERE id = ?').bind(...vals, id).run();
      else {
        const n = (await db.prepare('SELECT COUNT(*) AS n FROM auditions').first())?.n || 0; if (n >= 300) return { error: 'That\u2019s 300 auditions. Delete some old ones first.' };
        await db.prepare('INSERT INTO auditions (project, role, sent, deadline, status, link, notes, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(...vals).run();
      }
      break;
    }
    case 'audStatus': await db.prepare('UPDATE auditions SET status = ?, updated = ? WHERE id = ?').bind(AUD_STATUS.includes(b.status) ? b.status : 'sent', now, id).run(); break;
    case 'audDelete': await db.prepare('DELETE FROM auditions WHERE id = ?').bind(id).run(); break;
    default: return { error: 'Unknown action.' };
  }
  return { ok: true, ...(await clientBoard(db)) };
}
