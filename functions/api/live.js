// GET /api/live -> { live, startedAt, game, title } for the main Twitch channel (see lib/twitch.js).
// One shared server-side check (cached ~1 minute) instead of every visitor's browser asking a third-party service.
import { channelStatus } from '../../lib/twitch.js';

export async function onRequestGet({ env }) {
  try {
    const s = await channelStatus(env);
    const out = s.live ? { live: true, startedAt: s.startedAt || null, game: s.game || '', title: s.title || '' } : { live: false };
    return Response.json(out, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    return Response.json({ error: 'Twitch status unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
