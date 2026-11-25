// Runs before every request: maintenance mode for public pages, and keeping the Gear page hidden (404) until it's
// switched on in the dashboard. /gear/?preview=1 always loads the page shell; the list itself then comes from the
// signed-in admin API, so only Dismeigh sees anything in a preview.
import { maintenanceState, isPage, shopPage } from '../lib/maintenance.js';
import { gearOn } from '../lib/content.js';
let cache = { at: 0, v: null }; // small per-server cache so most page loads skip the database
let gearCache = { at: 0, on: false };
const GEAR = /^\/gear(\/|\/index\.html)?$/;
export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const path = new URL(request.url).pathname;
  if (!['GET', 'HEAD'].includes(request.method) || !env.ARCADE || !isPage(path)) return next();
  try {
    if (Date.now() - cache.at > 15000) cache = { at: Date.now(), v: await maintenanceState(env.ARCADE) };
    if (cache.v?.on || path === '/maintenance.html') return shopPage(env, request, cache.v?.note || '');
    if (GEAR.test(path)) {
      if (Date.now() - gearCache.at > 15000) gearCache = { at: Date.now(), on: await gearOn(env.ARCADE) };
      if (!gearCache.on && new URL(request.url).searchParams.get('preview') !== '1') {
        const page = await env.ASSETS.fetch(new URL('/404.html', request.url));
        return new Response(page.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
      }
      const res = await next(); const out = new Response(res.body, res); out.headers.set('Cache-Control', 'no-store'); return out;
    }
  } catch {}
  return next();
}
