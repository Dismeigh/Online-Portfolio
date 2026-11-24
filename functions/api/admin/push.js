// Dashboard: phone alerts. GET -> { key, devices }; POST { action: subscribe|kinds|remove|test, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { publicKey, devices, changePush } from '../../../lib/push.js';
export const onRequestGet = adminOnly(async ({ env }) => noStore({ key: await publicKey(env), devices: await devices(env) }));
export const onRequestPost = adminOnly(async ({ env, request }) => {
  const r = await changePush(env, await request.json().catch(() => ({})));
  return noStore(r, r.error ? 400 : 200);
});
