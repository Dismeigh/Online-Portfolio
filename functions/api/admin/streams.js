// Dashboard: the stream calendar (Streams tab). GET -> { streams, upcoming, pastCount, canImport }; POST { action, ... }. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { streamTables, streamBoard, changeStreams, importOld } from '../../../lib/streams.js';
export const onRequestGet = adminOnly(async ({ env }) => noStore(await streamBoard(env)));
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await streamTables(env.ARCADE);
  const b = await request.json().catch(() => ({}));
  const r = b?.action === 'import' ? await importOld(env) : await changeStreams(env.ARCADE, b);
  if (r.error) return noStore(r, 400);
  return noStore({ ...r, ...(await streamBoard(env)) });
});
