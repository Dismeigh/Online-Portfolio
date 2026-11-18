// GET /api/discord -> { online, members }
// Counts come from the public invite link, so no Discord widget setting is needed.
const INVITE = 'ttKfZbHnsj';

export async function onRequestGet() {
  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${INVITE}?with_counts=true`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'denizen-dismeigh.com (+https://www.denizen-dismeigh.com)' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!response.ok) throw new Error('Discord unavailable');
    const data = await response.json();
    const online = Number(data.approximate_presence_count);
    const members = Number(data.approximate_member_count);
    if (!Number.isFinite(online) || !Number.isFinite(members)) throw new Error('No counts');
    return Response.json({ online, members }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'Discord counts unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
