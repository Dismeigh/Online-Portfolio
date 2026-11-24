// Dashboard: recent activity feed (Ship's Log, Ko-fi, arcade scores, secrets found). Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables, activity } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env }) => { await statsTables(env.ARCADE); return noStore({ items: await activity(env.ARCADE) }); });
