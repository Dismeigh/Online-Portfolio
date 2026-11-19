import { guard, boards, json, gameOf } from '../../../lib/arcade.js';

// GET /api/arcade/scores?game=bounty|drag -> { game, better, all: [{ name, score }], week: [...], weekStart }
export const onRequestGet = guard(async ({ request, env }) => {
  const game = gameOf(new URL(request.url).searchParams.get('game'));
  if (!game) return json({ error: 'Unknown game.' }, 400);
  return json(await boards(env.ARCADE, Date.now(), game));
});
