// Dashboard: maintenance mode. GET current state; POST { on, note, until }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables } from '../../../lib/stats.js';
import { maintenanceState, saveMaintenance } from '../../../lib/maintenance.js';
export const onRequestGet = adminOnly(async ({ env }) => { await statsTables(env.ARCADE); return noStore({ maintenance: await maintenanceState(env.ARCADE) }); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE);
  return noStore({ ok: true, ...(await saveMaintenance(env.ARCADE, await request.json().catch(() => ({})))) });
});
