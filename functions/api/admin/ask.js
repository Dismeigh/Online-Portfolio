// Dashboard: Ask the captain questions. GET -> { questions }; POST { action: answer|hide|unhide|delete, id, answer }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { askTables, askBoard, changeAsk } from '../../../lib/ask.js';
export const onRequestGet = adminOnly(async ({ env }) => { await askTables(env.ARCADE); return noStore(await askBoard(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await askTables(env.ARCADE);
  const r = await changeAsk(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r.error ? r : { ok: true, ...(await askBoard(env.ARCADE)) }, r.error ? 400 : 200);
});
