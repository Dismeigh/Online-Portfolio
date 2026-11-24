// Dashboard: private notes board. GET the notes; POST { action: add|update|delete, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables } from '../../../lib/stats.js';
import { listNotes, changeNote } from '../../../lib/notes.js';
export const onRequestGet = adminOnly(async ({ env }) => { await statsTables(env.ARCADE); return noStore(await listNotes(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE);
  const r = await changeNote(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r, r.error ? 400 : 200);
});
