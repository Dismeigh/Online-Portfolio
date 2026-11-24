// Dashboard: login backup codes. GET -> { left, made }; POST { action: 'make' } -> { codes } (shown once). Signed-in only.
import { adminOnly, noStore, makeBackupCodes, backupInfo } from '../../../lib/admin.js';
import { logAdmin } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env }) => noStore(await backupInfo(env)));
export const onRequestPost = adminOnly(async ({ env, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action !== 'make') return noStore({ error: 'Unknown action.' }, 400);
  const codes = await makeBackupCodes(env);
  await logAdmin(env.ARCADE, request, 'Made new backup codes');
  return noStore({ codes, ...(await backupInfo(env)) });
});
