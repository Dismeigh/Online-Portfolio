// Backup and restore of everything typed into the dashboard: content sections, site settings, the Ko-fi goal and past
// goals, arcade targets, notes and Ship's Log entries. Never included: passwords, two-step keys, the alert key, visitor
// data or IP addresses. Every restored value goes through the same cleaning as a normal dashboard save.
import { CONTENT, readContent, saveContent, saveSite, siteSettings } from './content.js';
import { goalSettings, kofiTables } from './kofi.js';
import { listNotes } from './notes.js';
import { clipSettings, saveClips } from './clips.js';
import { cleanName, cleanMessage, LOG_NAME_MAX } from './guestbook.js';
import { TARGET_DEFAULTS, TARGET_LIMITS, tuning } from './arcade.js';

export const SECTIONS = ['content', 'site', 'goal', 'arcade', 'notes', 'guestbook'];
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
  let presets = []; try { presets = JSON.parse((await get(db, 'site:banner_presets')) || '[]'); } catch {}
  const clips = await clipSettings(db);
  const guestbook = (await db.prepare('SELECT name, message, created_at, hidden, pinned FROM guestbook ORDER BY created_at').all().catch(() => ({ results: [] }))).results;
  return {
    app: 'dismeigh-dashboard-backup', version: 1, at: new Date().toISOString(),
    content,
    site: { banner: s.banner, look: s.look, now: s.now, commissions: s.commissions, presets, clips },
    goal: { current: await goalSettings(db), past },
    arcade: { targets: (await tuning(db)).targets },
    notes: (await listNotes(db)).notes,
    guestbook,
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
  return { ok: true, done };
}
