// POST /api/log/react { id, kind }: one emoji reaction per visitor per Ship's Log entry. No sign-in; a scrambled
// visitor key (not the IP) remembers who already reacted. Returns { ok, reactions }.
import { guard, json, sameOrigin, visitorKey } from '../../../lib/arcade.js';
import { ensureTable, REACTIONS } from './index.js';
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const db = env.ARCADE; await ensureTable(db);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const id = Number(b?.id), kind = String(b?.kind || '');
  if (!Number.isInteger(id) || id < 1 || !REACTIONS.includes(kind)) return json({ error: 'Bad request.' }, 400);
  const entry = await db.prepare('SELECT id FROM guestbook WHERE id = ? AND hidden = 0').bind(id).first();
  if (!entry) return json({ error: 'That entry is gone.' }, 404);
  const who = await visitorKey(request), now = Date.now();
  const today = (await db.prepare('SELECT COUNT(*) AS n FROM log_reacted WHERE visitor = ? AND at > ?').bind(who, now - 86400000).first())?.n || 0;
  if (today >= 100) return json({ error: 'That\u2019s a lot of reactions for one day!' }, 429);
  const ins = await db.prepare('INSERT OR IGNORE INTO log_reacted (entry_id, visitor, at) VALUES (?, ?, ?)').bind(id, who, now).run();
  if (ins.meta?.changes) await db.prepare('INSERT INTO log_reactions (entry_id, kind, n) VALUES (?, ?, 1) ON CONFLICT(entry_id, kind) DO UPDATE SET n = n + 1').bind(id, kind).run();
  const rows = (await db.prepare('SELECT kind, n FROM log_reactions WHERE entry_id = ?').bind(id).all()).results;
  return json({ ok: true, already: !ins.meta?.changes, reactions: Object.fromEntries(rows.map(r => [r.kind, r.n])) });
});
