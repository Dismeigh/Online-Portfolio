// Twitch live status for the main channel, used by /api/live, the dashboard health light and go-live alerts.
// 1) Twitch's own API (Helix) when TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET are set (free app at dev.twitch.tv/console)
// 2) decapi.me as a backup (free, no keys, but a single third-party service that sometimes goes down)
// Only public channel info is fetched; nothing about visitors is sent anywhere.
export const CHANNEL = 'dismeigh';
const UA = 'denizen-dismeigh.com (+https://www.denizen-dismeigh.com)';
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

let token = { value: '', exp: 0 };   // app token, kept in this server's memory only (never stored or sent to browsers)
async function helixToken(env) {
  if (token.value && Date.now() < token.exp) return token.value;
  const body = new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' });
  const r = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', body, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? 'Twitch keys were rejected' : `Twitch login answered ${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error('Twitch login gave no token');
  token = { value: j.access_token, exp: Date.now() + Math.max(60, (Number(j.expires_in) || 3600) - 300) * 1000 };
  return token.value;
}

async function viaHelix(env, login) {
  const call = async () => fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${await helixToken(env)}` }, signal: AbortSignal.timeout(6000),
  });
  let r = await call();
  if (r.status === 401) { token = { value: '', exp: 0 }; r = await call(); }   // token expired early: get a new one once
  if (!r.ok) throw new Error(`Twitch answered ${r.status}`);
  const s = (await r.json())?.data?.[0];
  if (!s || s.type !== 'live') return { live: false, source: 'twitch' };
  const started = Date.parse(s.started_at);
  return { live: true, startedAt: Number.isFinite(started) ? new Date(started).toISOString() : null, game: clip(s.game_name, 80), title: clip(s.title, 140), source: 'twitch' };
}

const decapi = async path => {
  const r = await fetch(`https://decapi.me/twitch/${path}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`decapi.me answered ${r.status}`);
  return (await r.text()).trim();
};
async function viaDecapi(login) {
  const t = await decapi(`uptime/${encodeURIComponent(login)}`);
  if (/offline|not live|not currently/i.test(t)) return { live: false, source: 'decapi' };
  if (!/\d/.test(t) || /error|not found|rate limit/i.test(t)) throw new Error(`decapi.me gave an odd answer: ${clip(t, 60)}`);
  let secs = 0;
  for (const [, n, unit] of t.matchAll(/(\d+)\s*(day|hour|minute|second)/gi)) secs += Number(n) * { day: 86400, hour: 3600, minute: 60, second: 1 }[unit.toLowerCase()];
  const game = await decapi(`game/${encodeURIComponent(login)}`).catch(() => '');
  return { live: true, startedAt: secs ? new Date(Date.now() - secs * 1000).toISOString() : null, game: /error|not found|offline/i.test(game) ? '' : clip(game, 80), title: '', source: 'decapi' };
}

export const hasHelix = env => !!(env?.TWITCH_CLIENT_ID && env?.TWITCH_CLIENT_SECRET);

// Throws only when every source failed (message lists why). fresh = skip the short cache.
let cache = { at: 0, v: null };
export async function channelStatus(env, { fresh = false } = {}) {
  if (!fresh && cache.v && Date.now() - cache.at < 60000) return cache.v;
  const errors = [];
  if (hasHelix(env)) { try { const v = await viaHelix(env, CHANNEL); cache = { at: Date.now(), v }; return v; } catch (e) { errors.push(String(e?.message || 'Twitch didn’t answer')); } }
  try { const v = await viaDecapi(CHANNEL); cache = { at: Date.now(), v }; return v; } catch (e) { errors.push(String(e?.message || 'decapi.me didn’t answer')); }
  throw new Error(errors.join('; '));
}
