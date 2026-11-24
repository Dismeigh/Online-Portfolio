// Backup and restore of everything typed into the dashboard: content sections, site settings, the Ko-fi goal and past
// goals, arcade targets, notes and Ship's Log entries. Never included: passwords, two-step keys, the alert key, visitor
// data or IP addresses. Every restored value goes through the same cleaning as a normal dashboard save.
import { CONTENT, readContent, saveContent, saveSite, siteSettings, bannerPresets } from './content.js';
import { goalSettings, kofiTables } from './kofi.js';
import { listNotes } from './notes.js';
import { clientTables, changeClients, cleanInvoice, cleanAgreement } from './clients.js';
import { clipSettings, saveClips } from './clips.js';
import { cleanName, cleanMessage, LOG_NAME_MAX } from './guestbook.js';
import { TARGET_DEFAULTS, TARGET_LIMITS, tuning } from './arcade.js';
import { streamTables, listStreams, cleanStream } from './streams.js';
import { askTables, A_MAX } from './ask.js';
import { collabSetting } from './content.js';
import { checklist, changeChecklist } from './checklist.js';

export const SECTIONS = ['content', 'site', 'goal', 'arcade', 'notes', 'guestbook', 'jobs', 'streams', 'ask'];
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const longText = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const num = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;

export async function makeBackup(env, origin) {
  const db = env.ARCADE;
  await kofiTables(db);
  const content = {};
  for (const name of Object.keys(CONTENT)) content[name] = (await readContent(env, name, origin))[CONTENT[name][0]];
  const s = await siteSettings(db);
  let past = []; try { past = JSON.parse((await get(db, 'kofi_past')) || '[]'); } catch {}
  const presets = await bannerPresets(db);
  const clips = await clipSettings(db);
  await clientTables(db);
  const expenses = (await db.prepare('SELECT day, amount_cents, category, note FROM expenses ORDER BY day').all().catch(() => ({ results: [] }))).results;
  const auditions = (await db.prepare('SELECT project, role, sent, deadline, status, link, notes FROM auditions ORDER BY id').all().catch(() => ({ results: [] }))).results;
  const jobs = (await db.prepare('SELECT client, contact, service, price, stage, due, notes, client_note, invoice, agreement, at FROM jobs ORDER BY at').all().catch(() => ({ results: [] }))).results.map(j => ({ ...j, invoice: j.invoice ? JSON.parse(j.invoice) : null, agreement: j.agreement ? JSON.parse(j.agreement) : null }));
  const payments = (await db.prepare('SELECT p.day, p.amount_cents, p.method, p.note, j.client, j.at AS job_at FROM payments p LEFT JOIN jobs j ON j.id = p.job_id ORDER BY p.day').all().catch(() => ({ results: [] }))).results;
  const guestbook = (await db.prepare('SELECT name, message, created_at, hidden, pinned FROM guestbook ORDER BY created_at').all().catch(() => ({ results: [] }))).results;
  await streamTables(db); await askTables(db);
  const streams = (await listStreams(db)).map(x => ({ title: x.title, date: x.start.slice(0, 10), time: x.start.slice(11, 16), minutes: x.minutes, repeat: x.repeat, days: x.days, until: x.until, skips: x.skips, link: x.link, note: x.note }));
  let pastStreams = []; try { pastStreams = JSON.parse((await get(db, 'streams:past')) || '[]'); } catch {}
  const ask = (await db.prepare('SELECT q, name, at, answer, answered_at, hidden FROM questions WHERE answered_at IS NOT NULL ORDER BY answered_at').all()).results;
  return {
    app: 'dismeigh-dashboard-backup', version: 1, at: new Date().toISOString(),
    content,
    site: { banner: s.banner, look: s.look, now: s.now, commissions: s.commissions, presets, clips, collab: await collabSetting(db) },
    goal: { current: await goalSettings(db), past },
    arcade: { targets: (await tuning(db)).targets },
    notes: (await listNotes(db)).notes,
    guestbook,
    jobs,
    payments,
    expenses,
    auditions,
    streams, pastStreams, checklist: (await checklist(db)).items.map(x => x.text),
    ask,
  };
}

export async function restoreBackup(env, b, only) {
  if (b?.app !== 'dismeigh-dashboard-backup' || b?.version !== 1) return { error: 'That isn’t a dashboard backup file.' };
  const db = env.ARCADE, want = new Set((Array.isArray(only) && only.length ? only : SECTIONS).filter(x => SECTIONS.includes(x)));
  const done = [];
  await kofiTables(db);
  if (want.has('content') && b.content && typeof b.content === 'object') {
    for (const name of Object.keys(CONTENT)) if (Object.hasOwn(b.content, name)) await saveContent(env, name, b.content[name]);
    done.push('content');
  }
  if (want.has('site') && b.site) {
    const s = b.site;
    await saveSite(db, s.banner ? { what: 'banner', ...s.banner } : { what: 'banner', text: '' });
    await saveSite(db, { what: 'look', mode: s.look?.mode || 'auto', until: s.look?.until });
    await saveSite(db, s.now ? { what: 'now', ...s.now } : { what: 'now', text: '' });
    if (s.commissions) await saveSite(db, { what: 'commissions', ...s.commissions });
    if (Array.isArray(s.presets)) await saveSite(db, { what: 'presets', presets: s.presets });
    if (s.clips) await saveClips(db, s.clips);
    if (s.collab) await saveSite(db, { what: 'collab', ...s.collab });
    done.push('site settings');
  }
  if (want.has('goal') && b.goal) {
    const g = b.goal.current || {};
    await put(db, 'kofi_goal', JSON.stringify({
      on: g.on === true, title: text(g.title, 80), blurb: text(g.blurb, 200), target: num(g.target, 0, 10000000), start: num(g.start, 0, 10000000),
      since: Number(g.since) > 0 ? num(g.since, 0, Date.now()) : null, memberships: g.memberships !== false, garage: g.garage === true,
    }));
    const past = (Array.isArray(b.goal.past) ? b.goal.past : []).slice(0, 30).map(p => ({
      id: num(p?.id, 0, Number.MAX_SAFE_INTEGER), title: text(p?.title, 80), raised: num(p?.raised, 0, 10000000), target: num(p?.target, 0, 10000000),
      ended: num(p?.ended, 0, Date.now()), place: ['home', 'garage', 'none'].includes(p?.place) ? p.place : 'none',
    })).filter(p => p.title);
    await put(db, 'kofi_past', JSON.stringify(past));
    done.push('Ko-fi goal');
  }
  if (want.has('arcade') && b.arcade?.targets) {
    const t = {};
    for (const g of Object.keys(TARGET_DEFAULTS)) { const [lo, hi] = TARGET_LIMITS[g]; t[g] = num(b.arcade.targets[g] ?? TARGET_DEFAULTS[g], lo, hi); }
    await put(db, 'arcade:targets', JSON.stringify(t));
    done.push('arcade targets');
  }
  if (want.has('notes') && Array.isArray(b.notes)) {
    const notes = b.notes.slice(0, 300).map(n => ({
      id: num(n?.id, 1, Number.MAX_SAFE_INTEGER), cat: ['stream', 'bounty', 'quote', 'other'].includes(n?.cat) ? n.cat : 'other',
      text: longText(n?.text, 1000), done: n?.done === true, at: num(n?.at, 0, Date.now()), ...(n?.edited ? { edited: num(n.edited, 0, Date.now()) } : {}),
    })).filter(n => n.text);
    await put(db, 'admin_notes', JSON.stringify(notes));
    done.push('notes');
  }
  if (want.has('guestbook') && Array.isArray(b.guestbook)) {
    // Adds entries that aren't already there (same name, message and time); never deletes any
    let added = 0;
    for (const e of b.guestbook.slice(0, 2000)) {
      const n = cleanName(e?.name, LOG_NAME_MAX), m = cleanMessage(e?.message), at = num(e?.created_at, 0, Date.now());
      if (n.error || m.error || !at) continue;
      const name = n.name, message = m.message;
      const exists = await db.prepare('SELECT 1 FROM guestbook WHERE name = ? AND message = ? AND created_at = ?').bind(name, message, at).first();
      if (exists) continue;
      await db.prepare('INSERT INTO guestbook (name, message, ip, created_at, hidden, pinned) VALUES (?, ?, ?, ?, ?, ?)').bind(name, message, 'restored', at, e?.hidden ? 1 : 0, e?.pinned ? 1 : 0).run();
      added++;
    }
    done.push(`Ship’s Log (${added} added)`);
  }
  if (want.has('jobs') && Array.isArray(b.jobs)) {
    // Adds jobs that aren't already on the board (same client and start time); never deletes any
    await clientTables(db); let added = 0;
    for (const j of b.jobs.slice(0, 300)) {
      const at = num(j?.at, 0, Date.now());
      if (!at || await db.prepare('SELECT 1 FROM jobs WHERE client = ? AND at = ?').bind(String(j?.client ?? '').slice(0, 80), at).first()) continue;
      const r = await changeClients(db, { action: 'jobSave', ...j });
      if (r.ok) {
        const inv = j.invoice ? JSON.stringify(cleanInvoice(j.invoice)) : null;
        const agr = j.agreement ? JSON.stringify({ ...cleanAgreement(j.agreement), made: j.agreement.made, signed: j.agreement.signed ? { name: String(j.agreement.signed.name).slice(0, 80), at: String(j.agreement.signed.at).slice(0, 30) } : null }) : null;
        await db.prepare('UPDATE jobs SET at = ?, client_note = ?, invoice = ?, agreement = ? WHERE id = (SELECT MAX(id) FROM jobs)').bind(at, String(j?.client_note ?? '').slice(0, 600), inv, agr).run(); added++;
      }
    }
    // Payments: added if the same date, amount and method aren't already there
    let pAdded = 0;
    for (const p of (Array.isArray(b.payments) ? b.payments : []).slice(0, 2000)) {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(p?.day || '') ? p.day : null, c = num(p?.amount_cents, 0, 1e9);
      if (!day || !c || await db.prepare('SELECT 1 FROM payments WHERE day = ? AND amount_cents = ? AND method = ?').bind(day, c, String(p?.method)).first()) continue;
      const job = p.client ? await db.prepare('SELECT id FROM jobs WHERE client = ? AND at = ?').bind(String(p.client).slice(0, 80), num(p.job_at, 0, Date.now())).first() : null;
      await changeClients(db, { action: 'payAdd', job_id: job?.id, amount: (c / 100).toFixed(2), day, method: p.method, note: p.note }); pAdded++;
    }
    let eAdded = 0, aAdded = 0;
    for (const e of (Array.isArray(b.expenses) ? b.expenses : []).slice(0, 2000)) {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(e?.day || '') ? e.day : null, c = num(e?.amount_cents, 0, 1e9);
      if (!day || !c || await db.prepare('SELECT 1 FROM expenses WHERE day = ? AND amount_cents = ? AND note = ?').bind(day, c, String(e?.note ?? '').slice(0, 120)).first()) continue;
      if ((await changeClients(db, { action: 'expAdd', amount: (c / 100).toFixed(2), day, category: e.category, note: e.note })).ok) eAdded++;
    }
    for (const a of (Array.isArray(b.auditions) ? b.auditions : []).slice(0, 300)) {
      if (!a?.project || await db.prepare('SELECT 1 FROM auditions WHERE project = ? AND COALESCE(role, \'\') = ?').bind(String(a.project).slice(0, 80), String(a.role ?? '').slice(0, 80)).first()) continue;
      if ((await changeClients(db, { action: 'audSave', ...a, id: 0 })).ok) aAdded++;
    }
    done.push(`jobs (${added} added)`, `payments (${pAdded} added)`, `expenses (${eAdded} added)`, `auditions (${aAdded} added)`);
  }
  if (want.has('streams') && Array.isArray(b.streams)) {
    await streamTables(db); let added = 0;
    for (const x of b.streams.slice(0, 200)) {
      const c = cleanStream(x); if (c.error) continue;
      if (await db.prepare('SELECT 1 FROM streams WHERE title = ? AND start = ?').bind(c.title, c.start).first()) continue;
      await db.prepare('INSERT INTO streams (title, start, minutes, repeat, days, until, skips, link, note, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(c.title, c.start, c.minutes, c.repeat, c.days, c.until, c.skips, c.link, c.note, Date.now()).run(); added++;
    }
    if (Array.isArray(b.pastStreams) && b.pastStreams.length) {
      const past = b.pastStreams.slice(-3000).map(p => ({ t: text(p?.t, 80) || 'Stream', s: num(p?.s, 0, Date.now()), e: num(p?.e, 0, Date.now()) })).filter(p => p.s > 0);
      await put(db, 'streams:past', JSON.stringify(past));
    }
    if (Array.isArray(b.checklist) && b.checklist.length) await changeChecklist(db, { action: 'items', items: b.checklist.map(t => ({ text: t })) });
    done.push(`streams (${added} added)`);
  }
  if (want.has('ask') && Array.isArray(b.ask)) {
    await askTables(db); let added = 0;
    for (const q of b.ask.slice(0, 500)) {
      const qq = text(q?.q, 280), a = longText(q?.answer, A_MAX); if (!qq || !a) continue;
      if (await db.prepare('SELECT 1 FROM questions WHERE q = ?').bind(qq).first()) continue;
      const at = num(q?.at, 0, Date.now()), aa = num(q?.answered_at, 0, Date.now()) || Date.now();
      await db.prepare('INSERT INTO questions (q, name, at, answer, answered_at, hidden) VALUES (?, ?, ?, ?, ?, ?)').bind(qq, text(q?.name, 20), at || aa, a, aa, q?.hidden ? 1 : 0).run(); added++;
    }
    done.push(`answered questions (${added} added)`);
  }
  return { ok: true, done };
}
