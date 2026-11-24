// Pre-stream checklist (dashboard, Streams tab): your own list of things to check before going live.
// Ticks sync between your devices and clear on their own the next day (Eastern time), or with "Start fresh".
const get = async (db, k) => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first())?.value ?? null;
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const today = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
export const DEFAULT_ITEMS = ['Mic check (levels and no echo)', 'Camera and model tracking', 'Overlays, alerts and scenes working', 'Stream title and category set', 'Going-live post (X and Discord)', 'Water within reach', 'Phone on Do Not Disturb'];

export async function checklist(db, now = Date.now()) {
  let items = null, state = null;
  try { items = JSON.parse(await get(db, 'checklist:items') || 'null'); } catch {}
  try { state = JSON.parse(await get(db, 'checklist:state') || 'null'); } catch {}
  if (!Array.isArray(items)) items = DEFAULT_ITEMS.map((t, i) => ({ id: i + 1, text: t }));
  const done = state && state.day === today(now) && Array.isArray(state.done) ? state.done.filter(id => items.some(x => x.id === id)) : [];
  return { items, done };
}
export async function changeChecklist(db, b, now = Date.now()) {
  const cur = await checklist(db, now);
  if (b?.action === 'tick') {
    const id = Math.round(Number(b.id)); if (!cur.items.some(x => x.id === id)) return { error: 'That item is gone.' };
    const done = b.on ? [...new Set([...cur.done, id])] : cur.done.filter(x => x !== id);
    await put(db, 'checklist:state', JSON.stringify({ day: today(now), done }));
  } else if (b?.action === 'reset') {
    await put(db, 'checklist:state', JSON.stringify({ day: today(now), done: [] }));
  } else if (b?.action === 'items') {
    let next = Math.max(0, ...cur.items.map(x => x.id)) + 1;
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 25).map(x => {
      const t = text(x?.text, 100); if (!t) return null;
      const id = cur.items.some(y => y.id === Number(x?.id)) ? Number(x.id) : next++;
      return { id, text: t };
    }).filter(Boolean);
    await put(db, 'checklist:items', JSON.stringify(items));
  } else return { error: 'Unknown action.' };
  return { ok: true, ...(await checklist(db, now)) };
}
