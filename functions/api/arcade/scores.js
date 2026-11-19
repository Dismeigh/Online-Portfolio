import { guard, boards, json } from '../../../lib/arcade.js';

// GET /api/arcade/scores -> { all: [{ name, score }], week: [...], weekStart }
export const onRequestGet = guard(async ({ env }) => json(await boards(env.ARCADE)));
