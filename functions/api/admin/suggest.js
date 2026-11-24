// Dashboard: viewer suggestions. GET -> { suggestions }; POST { action: approve|delete, id, text?, game?, context? }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { suggestTables, suggestBoard, changeSuggestion } from '../../../lib/suggest.js';
export const onRequestGet = adminOnly(async ({ env }) => { await suggestTables(env.ARCADE); return noStore(await suggestBoard(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await suggestTables(env.ARCADE);
  const r = await changeSuggestion(env, await request.json().catch(() => ({})), new URL(request.url).origin);
  return noStore(r.error ? r : { ...r, ...(await suggestBoard(env.ARCADE)) }, r.error ? 400 : 200);
});
