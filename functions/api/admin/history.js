// Dashboard: recent logins and failed tries (last 90 days). Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { adminHistory } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env }) => noStore({ history: await adminHistory(env.ARCADE) }));
