// Dashboard: site health lights. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables } from '../../../lib/stats.js';
import { kofiTables } from '../../../lib/kofi.js';
import { healthReport } from '../../../lib/health.js';
export const onRequestGet = adminOnly(async ({ env }) => { await statsTables(env.ARCADE); await kofiTables(env.ARCADE); return noStore(await healthReport(env)); });
