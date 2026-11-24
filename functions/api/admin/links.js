// Dashboard: link checker. GET -> { links: [{ url, where }] }; POST { urls: [...] } -> { results } (10 at a time). Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables } from '../../../lib/stats.js';
import { collectLinks, checkLinks } from '../../../lib/links.js';
export const onRequestGet = adminOnly(async ({ env, request }) => { await statsTables(env.ARCADE); return noStore({ links: await collectLinks(env, new URL(request.url).origin) }); });
export const onRequestPost = adminOnly(async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  return noStore({ results: await checkLinks(b.urls) });
});
