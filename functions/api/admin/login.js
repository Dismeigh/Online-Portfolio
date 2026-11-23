// Dashboard login: POST { password }. See lib/admin.js.
import { login, noStore } from '../../../lib/admin.js';
export async function onRequestPost({ request, env }) {
  if (!env.ARCADE) return noStore({ error: 'Database is offline.' }, 503);
  try { return await login(env, request); } catch { return noStore({ error: 'Something went wrong. Try again.' }, 500); }
}
