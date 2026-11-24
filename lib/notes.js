// Private notes board in the dashboard (stream ideas, bounty ideas, future quotes). Owner-only: there's no public
// endpoint for these, only the signed-in /api/admin/notes. Stored in D1 (site_settings, key "admin_notes").
const CATS = ['stream', 'bounty', 'quote', 'other'];
const MAX_NOTES = 300;
const clean = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 1000);

async function read(db) {
  try { const v = JSON.parse((await db.prepare("SELECT value FROM site_settings WHERE key = 'admin_notes'").first())?.value || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
const write = (db, list) => db.prepare("INSERT INTO site_settings (key, value) VALUES ('admin_notes', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(list.slice(0, MAX_NOTES))).run();

export const listNotes = async db => ({ notes: await read(db) });

export async function changeNote(db, b) {
  const list = await read(db);
  if (b.action === 'add') {
    const text = clean(b.text);
    if (!text) return { error: 'Write something first.' };
    if (list.length >= MAX_NOTES) return { error: `That’s the limit of ${MAX_NOTES} notes. Delete some old ones first.` };
    list.unshift({ id: Date.now(), cat: CATS.includes(b.cat) ? b.cat : 'other', text, done: false, at: Date.now() });
  } else {
    const i = list.findIndex(n => n.id === Number(b.id));
    if (i < 0) return { error: 'That note wasn’t found.' };
    if (b.action === 'delete') list.splice(i, 1);
    else if (b.action === 'update') {
      if (typeof b.done === 'boolean') list[i].done = b.done;
      if (b.cat !== undefined && CATS.includes(b.cat)) list[i].cat = b.cat;
      if (b.text !== undefined) { const t = clean(b.text); if (!t) return { error: 'A note can’t be empty. Delete it instead.' }; list[i].text = t; list[i].edited = Date.now(); }
    } else return { error: 'Unknown action.' };
  }
  await write(db, list);
  return { ok: true, notes: list };
}
