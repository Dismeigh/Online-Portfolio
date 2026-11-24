// Dashboard: read (GET ?key=quotes) and save (POST { key, data }) site content. Signed-in only. Cleaned in lib/content.js.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { CONTENT, readContent, saveContent } from '../../../lib/content.js';
import { statsTables } from '../../../lib/stats.js';
export const onRequestGet = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE);
  const url = new URL(request.url), name = url.searchParams.get('key') || '';
  if (!Object.hasOwn(CONTENT, name)) return noStore({ error: 'Unknown section.' }, 400);
  return noStore(await readContent(env, name, url.origin));
});
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE);
  const b = await request.json().catch(() => ({}));
  if (!Object.hasOwn(CONTENT, String(b?.key || ''))) return noStore({ error: 'Unknown section.' }, 400);
  if (JSON.stringify(b.data ?? null).length > 100000) return noStore({ error: 'That’s too much to save at once.' }, 413);
  return noStore({ ok: true, ...(await saveContent(env, b.key, b.data)) });
});
