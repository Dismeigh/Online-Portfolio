// Dashboard: site banner and holiday look. GET current, POST { what: 'banner' | 'look', ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { siteSettings, saveSite, SEASON_KEYS, bannerPresets, bannerQueue, capacitySetting, collabSetting, COLLAB_KINDS } from '../../../lib/content.js';
import { statsTables } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env }) => {
  await statsTables(env.ARCADE);
  return noStore({ ...(await siteSettings(env.ARCADE)), seasons: SEASON_KEYS, presets: await bannerPresets(env.ARCADE), queue: await bannerQueue(env.ARCADE), capacitySet: await capacitySetting(env.ARCADE), collabSet: await collabSetting(env.ARCADE), collabKinds: COLLAB_KINDS });
});
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE);
  const r = await saveSite(env.ARCADE, await request.json().catch(() => ({})));
  return noStore(r.error ? r : { ok: true, ...r }, r.error ? 400 : 200);
});
