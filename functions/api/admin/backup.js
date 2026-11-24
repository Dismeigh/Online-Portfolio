// Dashboard: GET downloads a backup file; POST { backup, only? } restores one. Signed-in only. See lib/backup.js.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { statsTables } from '../../../lib/stats.js';
import { makeBackup, restoreBackup } from '../../../lib/backup.js';
import { ensureTable } from '../log/index.js';
const ensureGuestbook = db => ensureTable(db);  // same table and columns as the Ship's Log itself
export const onRequestGet = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE); await ensureGuestbook(env.ARCADE);
  const day = new Date().toISOString().slice(0, 10);
  return noStore(await makeBackup(env, new URL(request.url).origin), 200, { 'Content-Disposition': `attachment; filename="dismeigh-backup-${day}.json"` });
});
export const onRequestPost = adminOnly(async ({ env, request }) => {
  await statsTables(env.ARCADE); await ensureGuestbook(env.ARCADE);
  const raw = await request.text();
  if (raw.length > 1500000) return noStore({ error: 'That file is too big.' }, 413);
  let b; try { b = JSON.parse(raw); } catch { return noStore({ error: 'That file couldn’t be read.' }, 400); }
  if (b?.action === 'before') {
    const v = (await env.ARCADE.prepare("SELECT value FROM site_settings WHERE key = 'backup:before_restore'").first())?.value;
    return v ? noStore(JSON.parse(v), 200, { 'Content-Disposition': 'attachment; filename="dismeigh-backup-before-restore.json"' }) : noStore({ error: 'No restore has been done yet.' }, 404);
  }
  if (b?.backup?.app === 'dismeigh-dashboard-backup') {
    // Keep a copy of how things were right before this restore, in case it was the wrong file
    const before = JSON.stringify(await makeBackup(env, new URL(request.url).origin));
    if (before.length < 1500000) await env.ARCADE.prepare("INSERT INTO site_settings (key, value) VALUES ('backup:before_restore', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(before).run();
  }
  const r = await restoreBackup(env, b?.backup, b?.only);
  return noStore(r, r.error ? 400 : 200);
});
