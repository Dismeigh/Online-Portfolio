// GET /api/discord -> { name, online, members } for the Discord server, from Discord's public invite info
// (the same numbers anyone sees on the invite). Cached for 5 minutes. No visitor data involved.
const INVITE = 'ttKfZbHnsj';
export async function onRequestGet() {
  try {
    const r = await fetch(`https://discord.com/api/v10/invites/${INVITE}?with_counts=true`, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'denizen-dismeigh.com (server count card)' }, cf: { cacheTtl: 300, cacheEverything: true } });
    if (!r.ok) throw new Error();
    const d = await r.json();
    const num = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null);
    return Response.json({ name: String(d?.guild?.name || 'Discord').slice(0, 60), online: num(d?.approximate_presence_count), members: num(d?.approximate_member_count) },
      { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'Discord unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
