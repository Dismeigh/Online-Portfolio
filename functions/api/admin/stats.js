// Dashboard: private site stats (see lib/stats.js). Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables, siteStats } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env }) => { await statsTables(env.ARCADE); return noStore(await siteStats(env.ARCADE)); });
