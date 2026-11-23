// Finish setting up two-step login (authenticator app code). See lib/admin.js.
import { finishSetup, noStore } from '../../../lib/admin.js';
export async function onRequestPost({ request, env }) {
  if (!env.ARCADE) return noStore({ error: 'Database is offline.' }, 503);
  try { return await finishSetup(env, request); } catch { return noStore({ error: 'Something went wrong. Try again.' }, 500); }
}
