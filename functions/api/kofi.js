// Ko-fi webhook (Ko-fi → Settings → More → API → Webhooks). Checked against the KOFI_VERIFICATION_TOKEN secret.
// Keeps only amount, type, currency and time (see lib/kofi.js).
import { kofiWebhook } from '../../lib/kofi.js';
export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.ARCADE) return new Response('Not set up', { status: 503 });
  try { return await kofiWebhook(env, request, waitUntil); } catch { return new Response('Error', { status: 500 }); }
}
