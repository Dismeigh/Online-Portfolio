// Dashboard: YouTube row settings. GET -> { settings, feed }; POST { count, pinned, hidden }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables } from '../../../lib/stats.js';
import { clipSettings, saveClips } from '../../../lib/clips.js';
import { fetchFeed } from '../youtube.js';
export const onRequestGet = adminOnly(async ({ env }) => {
  await statsTables(env.ARCADE);
  let feed = [], feedError = false;
  try { feed = await fetchFeed(); } catch { feedError = true; }
  return noStore({ settings: await clipSettings(env.ARCADE), feed, feedError });
});
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE);
  return noStore({ ok: true, settings: await saveClips(env.ARCADE, await request.json().catch(() => ({}))) });
});
