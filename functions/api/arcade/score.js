import { guard, json, sameOrigin, visitorKey, cleanName, checkScore, checkReaction, boards } from '../../../lib/arcade.js';

// POST /api/arcade/score { run, name, score, seconds } -> { ok, boards }
// The game comes from the run ticket, so a score can't be posted to the wrong board.
export const onRequestPost = guard(async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const { error: nameError, name } = cleanName(body?.name);
  if (nameError) return json({ error: nameError, field: 'name' }, 400);

  const db = env.ARCADE;
  const ip = await visitorKey(request);
  const now = Date.now();
  const run = await db.prepare('SELECT ip, started_at, used, game FROM runs WHERE id = ?').bind(String(body?.run || '')).first();
  if (!run || run.ip !== ip || run.used || now - run.started_at > 3 * 3600000) return json({ error: 'That run can’t be posted. Play another and try again.' }, 400);

  const game = run.game || 'bounty';
  const score = Number(body?.score);
  let seconds;
  if (game === 'drag') {
    seconds = score / 1000;
    if (checkReaction(score, now - run.started_at)) return json({ error: 'That time didn’t check out.' }, 400);
  } else {
    seconds = Number(body?.seconds);
    if (seconds > (now - run.started_at) / 1000 + 3 || checkScore(score, seconds)) return json({ error: 'That score didn’t check out.' }, 400);
  }

  const last = await db.prepare('SELECT MAX(created_at) AS t FROM scores WHERE ip = ?').bind(ip).first();
  if (last?.t && now - last.t < 5000) return json({ error: 'Slow down. Try again in a few seconds.' }, 429);

  const claim = await db.prepare('UPDATE runs SET used = 1 WHERE id = ? AND used = 0').bind(String(body.run)).run();
  if (!claim.meta?.changes) return json({ error: 'That run was already posted.' }, 400);
  await db.prepare('INSERT INTO scores (name, score, seconds, ip, created_at, game) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, score, Math.round(seconds * 1000) / 1000, ip, now, game).run();
  return json({ ok: true, name, boards: await boards(db, now, game) });
});
