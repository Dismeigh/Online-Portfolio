// Dashboard: death counter. GET -> { deaths }; POST { action: add (n)|set|start|rename|end|home|clearRuns, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { getDeaths, changeDeaths } from '../../../lib/deaths.js';
export const onRequestGet = adminOnly(async ({ env }) => noStore({ deaths: await getDeaths(env.ARCADE) }));
export const onRequestPost = adminOnly(async ({ env, request }) => {
  const r = await changeDeaths(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r, r.error ? 400 : 200);
});
