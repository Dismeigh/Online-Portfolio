// Dashboard: link tap counts. GET ?days=7|30|90 -> { days, links: [{ name, n }] }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { clickTables, clickBoard } from '../../../lib/clicks.js';
export const onRequestGet = adminOnly(async ({ env, request }) => {
  await clickTables(env.ARCADE);
  const d = Number(new URL(request.url).searchParams.get('days'));
  return noStore(await clickBoard(env.ARCADE, [7, 30, 90].includes(d) ? d : 30));
});
