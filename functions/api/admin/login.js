// Dashboard login: POST { password }. See lib/admin.js. Failed tries can ping the phone (lib/push.js).
import { login, noStore } from '../../../lib/admin.js';
import { loginAlert, alert } from '../../../lib/push.js';
export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.ARCADE) return noStore({ error: 'Database is offline.' }, 503);
  try {
    const res = await login(env, request);
    if (res.status === 401 || res.status === 429) {
      const what = res.status === 429 ? 'Someone was locked out after too many tries' : 'Someone typed a wrong password or code';
      const job = loginAlert(env, what);
      if (waitUntil) waitUntil(job); else await job;
    }
    if (res.status === 200) {
      const d = await res.clone().json().catch(() => ({}));
      if (d.usedBackup) {
        const job = alert(env, 'login', { title: 'Backup code used', body: `Someone logged in to the dashboard with a backup code. ${d.backupLeft} left. If that wasn\u2019t you, change DASHBOARD_PASSWORD now.`, tab: 'security' });
        if (waitUntil) waitUntil(job); else await job;
      }
    }
    return res;
  } catch { return noStore({ error: 'Something went wrong. Try again.' }, 500); }
}
