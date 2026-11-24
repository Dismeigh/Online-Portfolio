// Runs before every request. Only job: maintenance mode for public pages.
import { maintenanceState, isPage, shopPage } from '../lib/maintenance.js';
let cache = { at: 0, v: null }; // small per-server cache so most page loads skip the database
export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const path = new URL(request.url).pathname;
  if (!['GET', 'HEAD'].includes(request.method) || !env.ARCADE || !isPage(path)) return next();
  try {
    if (Date.now() - cache.at > 15000) cache = { at: Date.now(), v: await maintenanceState(env.ARCADE) };
    if (cache.v?.on || path === '/maintenance.html') return shopPage(env, request, cache.v?.note || '');
  } catch {}
  return next();
}
