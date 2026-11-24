// Public, for the OBS tip alert overlay: Ko-fi tips and memberships from the last 15 minutes.
// Amount, kind and time only (the site never stores supporters' names or messages).
import { kofiTables } from '../../lib/kofi.js';
export async function onRequestGet({ env }) {
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (!env.ARCADE) return Response.json({ tips: [] }, { headers });
  try {
    await kofiTables(env.ARCADE);
    const rows = (await env.ARCADE.prepare("SELECT message_id, type, amount_cents, currency, at FROM kofi_payments WHERE at > ? AND type IN ('Donation', 'Subscription') ORDER BY at DESC LIMIT 10").bind(Date.now() - 15 * 60000).all()).results;
    // The id is a short scrambled form of Ko-fi's message id, just so the overlay knows which ones it already showed
    const tips = await Promise.all(rows.map(async r => {
      const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tip|${r.message_id}`));
      return { id: [...new Uint8Array(h)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(''), kind: r.type === 'Subscription' ? 'member' : 'tip', cents: r.amount_cents, currency: r.currency, at: r.at };
    }));
    return Response.json({ tips }, { headers });
  } catch { return Response.json({ tips: [] }, { headers }); }
}
