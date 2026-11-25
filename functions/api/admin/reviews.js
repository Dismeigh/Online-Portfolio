// Dashboard: client reviews. GET -> { reviews }; POST { action: approve|hide|delete, id }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { clientTables } from '../../../lib/clients.js';
import { reviewTables, reviewBoard, changeReview } from '../../../lib/reviews.js';
export const onRequestGet = adminOnly(async ({ env }) => { await clientTables(env.ARCADE); await reviewTables(env.ARCADE); return noStore(await reviewBoard(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await clientTables(env.ARCADE); await reviewTables(env.ARCADE);
  const r = await changeReview(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r.error ? r : { ok: true, ...(await reviewBoard(env.ARCADE)) }, r.error ? 400 : 200);
});
