// Maintenance mode: when it's on, public pages show the "Ship's in the shop" page instead.
// The dashboard, every /api/ route (Ko-fi webhook included) and static files keep working.
const KEY = 'site:maintenance';
const clean = v => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function maintenanceState(db) {
  try {
    const v = JSON.parse((await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(KEY).first())?.value || 'null');
    if (!v?.on || (v.until && Date.now() > v.until)) return { on: false, note: v?.note || '' };
    return v;
  } catch { return { on: false, note: '' }; }
}
export async function saveMaintenance(db, b) {
  const until = Number(b.until) > Date.now() ? Math.min(Number(b.until), Date.now() + 30 * 86400000) : null;
  const value = { on: b.on === true, note: clean(b.note), until: b.on === true ? until : null, at: Date.now() };
  await db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(KEY, JSON.stringify(value)).run();
  return { maintenance: value };
}

// Pages only: paths with no file extension, or .html. Everything below stays reachable.
const OPEN = [/^\/api\//, /^\/dashboard(\/|$)/, /^\/overlay(\/|$)/, /^\/(status|invoice|agree)(\/|$)/];
export const isPage = p => !OPEN.some(r => r.test(p)) && (/\.html$/.test(p) || !/\.[a-z0-9]+$/i.test(p));

export async function shopPage(env, request, note) {
  const r = await env.ASSETS.fetch(new URL('/maintenance.html', request.url));
  let html = await r.text();
  if (note) html = html.replace('<!--SHOP_NOTE-->', `<p class="shop-note">${esc(note)}</p>`);
  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3600',
      'X-Robots-Tag': 'noindex', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}
