// GET /api/deaths -> { on, game, count, home, updated }. Public: the overlay and home page read it.
import { guard, json } from '../../lib/arcade.js';
import { getDeaths, publicDeaths } from '../../lib/deaths.js';
export const onRequestGet = guard(async ({ env }) => {
  const r = json(publicDeaths(await getDeaths(env.ARCADE)));
  r.headers.set('Cache-Control', 'public, max-age=2');
  return r;
});
