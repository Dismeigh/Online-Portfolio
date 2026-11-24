// Dashboard: pre-stream checklist. GET -> { items, done }; POST { action: tick|reset|items, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { checklist, changeChecklist } from '../../../lib/checklist.js';
export const onRequestGet = adminOnly(async ({ env }) => noStore(await checklist(env.ARCADE)));
export const onRequestPost = adminOnly(async ({ env, request }) => {
  const r = await changeChecklist(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r, r.error ? 400 : 200);
});
