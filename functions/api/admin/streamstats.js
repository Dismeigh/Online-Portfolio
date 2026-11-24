// Dashboard: stream stats log. GET -> { stats }; POST { action: save|delete, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statTables, statBoard, changeStats } from '../../../lib/streamstats.js';
export const onRequestGet = adminOnly(async ({ env }) => { await statTables(env.ARCADE); return noStore(await statBoard(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statTables(env.ARCADE);
  const r = await changeStats(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r.error ? r : { ok: true, ...(await statBoard(env.ARCADE)) }, r.error ? 400 : 200);
});
