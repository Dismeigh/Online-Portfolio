// Dashboard logout: clears the session cookie (and notes it in the login history if it was a real session).
import { logout, signedIn } from '../../../lib/admin.js';
import { logAdmin } from '../../../lib/stats.js';
export async function onRequestPost({ request, env }) {
  try { if (env.ARCADE && await signedIn(env, request)) await logAdmin(env.ARCADE, request, 'Logged out'); } catch {}
  return logout();
}
