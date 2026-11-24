// Dashboard: quote requests and the client board. GET -> { requests, jobs }; POST { action, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { clientTables, clientBoard, changeClients } from '../../../lib/clients.js';
export const onRequestGet = adminOnly(async ({ env }) => { await clientTables(env.ARCADE); return noStore(await clientBoard(env.ARCADE)); });
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await clientTables(env.ARCADE);
  const r = await changeClients(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r, r.error ? 400 : 200);
});
