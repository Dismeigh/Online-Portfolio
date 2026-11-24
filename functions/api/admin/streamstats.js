// Dashboard: stream stats log. GET -> { stats, best }; POST { action: save|delete, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statTables, statBoard, changeStats, bestTimes } from '../../../lib/streamstats.js';
import { calendarIcs } from '../../../lib/streams.js';
import { streamsBetween } from '../../../lib/rewind.js';
async function board(env) {
  const b = await statBoard(env.ARCADE);
  let sched = [];
  try { if (b.stats.length) { const first = Date.parse(`${b.stats.at(-1).day}T00:00:00Z`) - 86400000; sched = streamsBetween(await calendarIcs(env), first, Date.now()); } } catch {}
  return { ...b, best: bestTimes(b.stats, sched) };
}
export const onRequestGet = adminOnly(async ({ env }) => { await statTables(env.ARCADE); return noStore(await board(env)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statTables(env.ARCADE);
  const r = await changeStats(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r.error ? r : { ...r, ...(await board(env)) }, r.error ? 400 : 200);
});
