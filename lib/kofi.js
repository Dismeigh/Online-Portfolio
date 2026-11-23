// Ko-fi goal bar. Dismeigh switches a goal on in the private dashboard (/dashboard/); while it's on, a progress bar
// shows in Support & Shop on the home page (and in the Garage, if picked).
// Progress = the "already raised" amount typed in + Ko-fi payments since the goal started. Ko-fi sends those to
// /api/kofi (its webhook), checked against the KOFI_VERIFICATION_TOKEN secret. Only the amount, type, currency and
// time are kept: never names, emails or messages.

export const KOFI_URL = 'https://ko-fi.com/dismeigh';
const now = () => Date.now();
const cents = v => Math.max(0, Math.min(100_000_000, Math.round(Number(String(v ?? '').replace(/[$,\s]/g, '')) * 100) || 0));
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

let ready = false;
export async function kofiTables(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS kofi_payments (message_id TEXT PRIMARY KEY, type TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL, at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS kofi_payments_at ON kofi_payments (at)'),
  ]);
  ready = true;
}

export async function goalSettings(db) {
  let g = {};
  try { g = JSON.parse((await db.prepare("SELECT value FROM site_settings WHERE key = 'kofi_goal'").first())?.value || '{}') || {}; } catch {}
  return { on: false, title: '', blurb: '', target: 0, start: 0, since: null, memberships: true, garage: false, ...g };
}
const saveGoal = (db, g) => db.prepare("INSERT INTO site_settings (key, value) VALUES ('kofi_goal', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(g)).run();

export async function goalProgress(db, g) {
  const types = g.memberships ? "'Donation', 'Subscription'" : "'Donation'";
  const r = g.since
    ? await db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS c, COUNT(*) AS n FROM kofi_payments WHERE at >= ? AND currency = 'USD' AND type IN (${types})`).bind(g.since).first()
    : { c: 0, n: 0 };
  const raised = (g.start || 0) + (r?.c || 0);
  return { raised, payments: r?.n || 0, pct: g.target ? Math.min(100, Math.floor((raised / g.target) * 100)) : 0 };
}

// Public: nothing at all unless a goal is switched on
export async function publicGoal(db) {
  const g = await goalSettings(db);
  if (!g.on || !g.target) return { on: false };
  const p = await goalProgress(db, g);
  return { on: true, title: g.title, blurb: g.blurb, target: g.target / 100, raised: p.raised / 100, pct: p.pct, garage: !!g.garage, url: KOFI_URL };
}

// ---------- Ko-fi webhook ----------
const same = (a, b) => {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
};
export async function kofiWebhook(env, request) {
  if (!env.KOFI_VERIFICATION_TOKEN) return new Response('Not set up', { status: 503 });
  const body = await request.text();
  if (body.length > 20000) return new Response('Too big', { status: 413 });
  let d; try { d = JSON.parse(new URLSearchParams(body).get('data') || ''); } catch { return new Response('Bad request', { status: 400 }); }
  if (!same(d?.verification_token, env.KOFI_VERIFICATION_TOKEN)) return new Response('Unauthorized', { status: 401 });
  const id = String(d.message_id || d.kofi_transaction_id || '').slice(0, 80);
  if (!id) return new Response('Bad request', { status: 400 });
  const type = ['Donation', 'Subscription', 'Shop Order', 'Commission'].includes(d.type) ? d.type : 'Other';
  await kofiTables(env.ARCADE);
  await env.ARCADE.prepare('INSERT OR IGNORE INTO kofi_payments (message_id, type, amount_cents, currency, at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, type, cents(d.amount), String(d.currency || 'USD').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'USD', now()).run();
  return new Response('OK', { status: 200 });
}

// ---------- Dashboard ----------
export async function goalAdmin(env, origin) {
  const db = env.ARCADE, g = await goalSettings(db), p = await goalProgress(db, g);
  const last = await db.prepare('SELECT at FROM kofi_payments ORDER BY at DESC LIMIT 1').first();
  return {
    goal: { ...g, target: g.target / 100, start: g.start / 100 },
    progress: { ...p, raised: p.raised / 100 },
    connected: Boolean(env.KOFI_VERIFICATION_TOKEN),
    lastPayment: last?.at ? new Date(last.at).toISOString() : null,
    webhookUrl: `${origin}/api/kofi`,
    kofiUrl: KOFI_URL,
  };
}
export async function goalChange(env, b) {
  const db = env.ARCADE, g = await goalSettings(db);
  if (b.action === 'toggle') {
    if (b.on && !g.target) return { error: 'Save a goal with an amount first.' };
    await saveGoal(db, { ...g, on: Boolean(b.on), since: b.on && !g.since ? now() : g.since });
    return { ok: true };
  }
  if (b.action === 'save') {
    const title = text(b.title, 80), target = cents(b.target);
    if (!title || target < 100) return { error: 'Give the goal a name and an amount of at least $1.' };
    // A new goal (or "start counting again") only counts Ko-fi payments from now on
    const fresh = b.restart === true || !g.since;
    await saveGoal(db, {
      ...g, title, blurb: text(b.blurb, 200), target, start: cents(b.start),
      memberships: b.memberships !== false, garage: b.garage === true, since: fresh ? now() : g.since,
    });
    return { ok: true };
  }
  return { error: 'Unknown action.' };
}
