// Dashboard: viewer go-live alerts. GET -> { count, job, auto, message }; POST { action: start|work|settings, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { goliveTables, goliveBoard, startAlert, workAlert } from '../../../lib/golive.js';
const put = (db, k, v) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
export const onRequestGet = adminOnly(async ({ env }) => { await goliveTables(env.ARCADE); return noStore(await goliveBoard(env)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await goliveTables(env.ARCADE);
  const b = await request.json().catch(() => ({}));
  if (b?.action === 'start') { const r = await startAlert(env, { message: b.message, force: !!b.force }); if (r.skipped) return noStore({ skipped: true, ...(await goliveBoard(env)) }); await workAlert(env); }
  else if (b?.action === 'work') await workAlert(env);
  else if (b?.action === 'settings') {
    await put(env.ARCADE, 'golive:auto', b.auto ? '1' : '0');
    await put(env.ARCADE, 'golive:message', String(b.message ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 120));
  } else return noStore({ error: 'Unknown action.' }, 400);
  return noStore({ ok: true, ...(await goliveBoard(env)) });
});
