// Dashboard: Ko-fi goal status (GET) and changes (POST { action: 'save' | 'toggle', ... }). Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { kofiTables, goalAdmin, goalChange } from '../../../lib/kofi.js';
export const onRequestGet = adminOnly(async ({ env, request }) => {
  await kofiTables(env.ARCADE);
  return noStore(await goalAdmin(env, new URL(request.url).origin));
});
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await kofiTables(env.ARCADE);
  const body = await request.json().catch(() => ({}));
  const r = await goalChange(env, body || {});
  return noStore(r, r.error ? 400 : 200);
});
