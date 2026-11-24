// Dashboard: site feedback. GET -> { feedback }; POST { action: done|undone|delete, id }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { feedbackTables, feedbackBoard, changeFeedback } from '../../../lib/feedback.js';
export const onRequestGet = adminOnly(async ({ env }) => { await feedbackTables(env.ARCADE); return noStore(await feedbackBoard(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await feedbackTables(env.ARCADE);
  const r = await changeFeedback(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r.error ? r : { ok: true, ...(await feedbackBoard(env.ARCADE)) }, r.error ? 400 : 200);
});
