// Dashboard: known devices + sign out everywhere. GET -> { devices }; POST { action: 'forget', h } | { action: 'signout' }. Signed-in only.
import { adminOnly, noStore, knownDevices, forgetDevice, signOutEverywhere } from '../../../lib/admin.js';
import { logAdmin } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env }) => noStore({ devices: (await knownDevices(env)).map(d => ({ ...d, first: new Date(d.first).toISOString(), last: new Date(d.last).toISOString() })) }));
export const onRequestPost = adminOnly(async ({ env, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.action === 'forget') { await forgetDevice(env, b.h); return noStore({ ok: true }); }
  if (b.action === 'signout') {
    const fresh = await signOutEverywhere(env);
    await logAdmin(env.ARCADE, request, 'Signed out everywhere');
    return noStore({ ok: true }, 200, { 'Set-Cookie': fresh });
  }
  return noStore({ error: 'Unknown action.' }, 400);
});
