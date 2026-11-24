// Dashboard: monthly report. GET ?month=YYYY-MM. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables } from '../../../lib/stats.js';
import { clientTables } from '../../../lib/clients.js';
import { kofiTables } from '../../../lib/kofi.js';
import { monthlyReport } from '../../../lib/report.js';
export const onRequestGet = adminOnly(async ({ env, request }) => {
  const db = env.ARCADE;
  await statsTables(db); await clientTables(db); await kofiTables(db);
  for (const q of ['CREATE TABLE IF NOT EXISTS visitors (key TEXT PRIMARY KEY, n INTEGER NOT NULL, created_at INTEGER NOT NULL)']) await db.prepare(q).run();
  return noStore(await monthlyReport(db, new URL(request.url).searchParams.get('month')));
});
