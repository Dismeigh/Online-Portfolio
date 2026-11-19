// Ship's Log guestbook: visitors leave a name and a short message.
// Stored in the same D1 database as the scoreboards (binding ARCADE), table "guestbook".
// To hide an entry: UPDATE guestbook SET hidden = 1 WHERE id = ...;
import { cleanName, isClean } from './arcade.js';

export const LOG_NAME_MAX = 20;
export const LOG_MESSAGE_MAX = 140;

const LINKY = /(https?:|www\.|discord\.gg|\b[a-z0-9-]+\.(com|net|org|gg|tv|io|co|me|xyz|ly|app|link|site|info|biz|ru)\b)/i;

export function cleanMessage(raw) {
  const message = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if ([...message].length < 2) return { error: 'Write a message first.' };
  if ([...message].length > LOG_MESSAGE_MAX) return { error: `Messages can be up to ${LOG_MESSAGE_MAX} characters.` };
  if (LINKY.test(message)) return { error: 'No links in the log, please.' };
  // Check word by word (so normal words aren't caught), plus spaced-out letters like "f u c k"
  const words = message.split(' ').map(w => w.replace(/^[^\p{L}\p{N}@$!|]+|[^\p{L}\p{N}@$!|]+$/gu, '')).filter(Boolean);
  const runs = [];
  let run = '';
  for (const w of words) { if (w.length === 1) run += w; else { if (run.length > 2) runs.push(run); run = ''; } }
  if (run.length > 2) runs.push(run);
  if ([...words, ...runs].some(w => !isClean(w))) return { error: 'That message isn’t allowed. Try rewording it.' };
  return { message };
}

export { cleanName, isClean };
