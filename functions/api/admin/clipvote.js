// Dashboard: Clip of the Month counts and past winners. Signed-in only.
import { adminOnly, noStore } from '../../../lib/admin.js';
import { voteTables, voteBoard } from '../../../lib/clipvote.js';
export const onRequestGet = adminOnly(async ({ env }) => { await voteTables(env.ARCADE); return noStore(await voteBoard(env.ARCADE)); });
