// Dashboard: collab requests. GET -> { collabs }; POST { action: replied|unreplied|delete, id }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { collabTables, collabBoard, changeCollab } from '../../../lib/collab.js';
export const onRequestGet = adminOnly(async ({ env }) => { await collabTables(env.ARCADE); return noStore(await collabBoard(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await collabTables(env.ARCADE);
  const r = await changeCollab(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r.error ? r : { ok: true, ...(await collabBoard(env.ARCADE)) }, r.error ? 400 : 200);
});
