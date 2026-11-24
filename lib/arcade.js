// Bounty Run arcade scoreboard: shared helpers for the /api/arcade/* functions.
// Data lives in the Cloudflare D1 database bound as ARCADE (dismeigh-arcade).

export const NAME_MAX = 10;
export const BOARD_SIZE = 10;

// ---- Scoring model (must match dist/bounty-run.js) ----
// Time score: 10 points per second at speed 1, speed = 1 + t/40  ->  10 * (t + t^2 / 80)
// Bounty chips: +50 each, they spawn about 0.7 per second.
export const timeScore = t => 10 * (t + (t * t) / 80);

// Is this score possible for a run of `seconds`? Returns a reason string when it isn't.
export function checkScore(score, seconds) {
  if (!Number.isInteger(score) || score < 1 || score > 10_000_000) return 'bad score';
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3 * 3600) return 'bad length';
  const base = timeScore(seconds);
  const extra = score - base;
  // The game floors the total, so the score sits within a point of base + 50 * chips
  if (extra < -2) return 'score too low for run';
  const chips = Math.round(extra / 50);
  if (Math.abs(extra - chips * 50) > 2.5) return 'score does not add up';
  // Chips spawn ~0.7/s; catching every one is already hard, allow plenty of luck on top
  if (chips > seconds * 1.4 + 6) return 'too many chips';
  return null;
}

// Launch Control (drag race, Garage page): score is reaction time in milliseconds, lower wins.
// The tree takes at least 2.5 s from staging to green (dist/drag-race.js).
export const TREE_MIN_MS = 2500;
export function checkReaction(ms, elapsedMs) {
  if (!Number.isInteger(ms)) return 'bad time';
  if (ms < 100) return 'faster than humanly possible';
  if (ms > 1500) return 'too slow to post';
  if (elapsedMs < TREE_MIN_MS + ms - 250) return 'run too short';
  return null;
}

// Games on the board. `better` is how scores rank.
export const GAMES = {
  bounty: { better: 'high' },
  drag: { better: 'low' },
};
export const gameOf = v => (Object.hasOwn(GAMES, String(v || 'bounty')) ? String(v || 'bounty') : null);

// ---- Names ----
const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '6': 'g' };

// Blocked anywhere inside the name (after removing spaces, symbols and number swaps)
const BLOCK_ANYWHERE = [
  'fuck', 'fuk', 'fck', 'phuck', 'shit', 'sht', 'cunt', 'kunt', 'bitch', 'biatch', 'btch', 'whore', 'slut', 'nigg', 'niga', 'nigr', 'negro',
  'fag', 'retard', 'rape', 'rapist', 'penis', 'vagina', 'pussy', 'cock', 'dick', 'dik', 'twat', 'wank', 'jizz', 'cum', 'dildo', 'porn', 'boob',
  'tits', 'titty', 'testicle', 'ballsack', 'scrotum', 'clit', 'blowjob', 'handjob', 'anus', 'anal', 'molest', 'pedo', 'paedo',
  'nazi', 'hitler', 'heil', 'kkk', 'chink', 'gook', 'kike', 'spic', 'wetback', 'tranny', 'dyke', 'coon', 'beaner', 'raghead', 'towelhead',
  'killyour', 'suicide', 'bastard', 'asshole', 'arse', 'douche', 'skank', 'hoe', 'thot', 'cuck', 'semen', 'sperm', 'nude', 'nsfw', 'sex',
];
// Blocked only as the whole name or a whole word (they hide inside normal words)
const BLOCK_WORD = ['ass', 'asses', 'tit', 'hoes', 'nig', 'gay', 'homo', 'lesbo', 'jap', 'paki', 'damn', 'hell', 'piss', 'crap', 'poop', 'butt', 'balls', 'kys'];
// Normal words that contain a blocked piece; checked before blocking
const ALLOW = ['cockpit', 'peacock', 'hancock', 'shuttlecock', 'dickens', 'scunthorpe', 'cumulus', 'document', 'circumference', 'cucumber',
  'shoe', 'hoed', 'whoever', 'phoenix', 'phoebe', 'sexton', 'essex', 'sussex', 'analyst', 'analog', 'canal', 'banal', 'janus', 'manus',
  'raccoon', 'tycoon', 'cocoon', 'scrap', 'grape', 'drape', 'trape', 'therapist', 'spice', 'spicy', 'arsenal', 'torpedo', 'montenegro', 'cuckoo',
  'accumul', 'acumul', 'circum', 'cumber', 'incumb', 'succumb', 'sucumb', 'parse', 'sparse', 'analy', 'conspic', 'cockat', 'pedometer', 'manuscript', 'cumin']

const normalize = s => s.toLowerCase().split('').map(c => LEET[c] ?? c).join('');
const lettersOnly = s => s.replace(/[^a-z]/g, '');
const squeeze = s => s.replace(/(.)\1+/g, '$1');

export function cleanName(raw, max = NAME_MAX) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return { error: 'Type a name first.' };
  if ([...name].length > max) return { error: `Names can be up to ${max} characters.` };
  if (!/^[A-Za-z0-9 _\-.!]+$/.test(name)) return { error: 'Use letters, numbers, spaces, dashes or underscores.' };
  if (!/[A-Za-z0-9]/.test(name)) return { error: 'Use at least one letter or number.' };
  if (!isClean(name)) return { error: 'That name isn’t allowed. Try another one.' };
  return { name };
}

export function isClean(name) {
  const norm = normalize(name);
  const words = norm.split(/[\s_\-.]+/).map(lettersOnly).filter(Boolean);
  const joined = lettersOnly(norm);
  const variants = new Set([joined, squeeze(joined)]);
  for (const v of variants) {
    if (BLOCK_ANYWHERE.some(b => v.includes(b))) {
      // Allow it only if every blocked hit sits inside an allowed word
      let stripped = v;
      for (const a of ALLOW) stripped = stripped.split(a).join(' ');
      if (BLOCK_ANYWHERE.some(b => stripped.includes(b))) return false;
    }
  }
  const tokens = new Set([...words, ...words.map(squeeze), joined, squeeze(joined)]);
  if (BLOCK_WORD.some(b => tokens.has(b))) return false;
  return true;
}

// ---- Requests ----
export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function visitorKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const bytes = new TextEncoder().encode(`dismeigh-arcade|${ip}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

// Monday 00:00 in New York, as a UTC timestamp (ms)
export function weekStart(now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const daysSinceMonday = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 })[parts.weekday];
  const intoDay = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;
  return Math.floor((now - intoDay - daysSinceMonday * 86400000) / 1000) * 1000;
}

// Dashboard tuning: Arcade master targets and early weekly resets (stored in site_settings)
export const TARGET_DEFAULTS = { bounty: 1500, drag: 175 };
export const TARGET_LIMITS = { bounty: [100, 100000], drag: [100, 1000] };
export async function tuning(db) {
  const get = async k => (await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(k).first().catch(() => null))?.value;
  let t = {}; try { t = JSON.parse((await get('arcade:targets')) || '{}') || {}; } catch {}
  const targets = {}, resets = {};
  for (const g of Object.keys(TARGET_DEFAULTS)) {
    const v = Number(t[g]), [lo, hi] = TARGET_LIMITS[g];
    targets[g] = Number.isInteger(v) && v >= lo && v <= hi ? v : TARGET_DEFAULTS[g];
    resets[g] = Number(await get(`arcade:reset:${g}`)) || 0;
  }
  return { targets, resets };
}
// Start of "this week" for a game: Monday 00:00 Eastern, or a later early reset from the dashboard
export const boardWeekStart = (resetAt, now = Date.now()) => Math.max(weekStart(now), Math.min(Number(resetAt) || 0, now));

export async function boards(db, now = Date.now(), game = 'bounty') {
  // Best score per name (case-insensitive), so one player can't fill the board
  const high = GAMES[game].better === 'high';
  const q = since => db.prepare(
    `SELECT name, ${high ? 'MAX' : 'MIN'}(score) AS score, created_at FROM scores WHERE game = ? AND created_at >= ?
     GROUP BY lower(name) ORDER BY score ${high ? 'DESC' : 'ASC'}, created_at ASC LIMIT ${BOARD_SIZE}`).bind(game, since).all();
  const { targets, resets } = await tuning(db);
  const since = boardWeekStart(resets[game], now);
  const [all, week] = await Promise.all([q(0), q(since)]);
  const tidy = rows => rows.results.map(r => ({ name: r.name, score: r.score }));
  return { game, better: GAMES[game].better, all: tidy(all), week: tidy(week), weekStart: new Date(since).toISOString(), master: targets[game] };
}

let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, ip TEXT NOT NULL, started_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, game TEXT NOT NULL DEFAULT 'bounty')"),
    db.prepare('CREATE INDEX IF NOT EXISTS runs_ip ON runs (ip, started_at)'),
    db.prepare("CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, score INTEGER NOT NULL, seconds REAL NOT NULL, ip TEXT NOT NULL, created_at INTEGER NOT NULL, game TEXT NOT NULL DEFAULT 'bounty')"),
    db.prepare('CREATE INDEX IF NOT EXISTS scores_game ON scores (game, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS scores_rank ON scores (score DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS scores_week ON scores (created_at, score DESC)'),
    db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
  ]);
  schemaReady = true;
}

export function guard(handler) {
  return async ctx => {
    if (!ctx.env?.ARCADE) return json({ error: 'Scoreboard is offline.' }, 503);
    try { await ensureSchema(ctx.env.ARCADE); return await handler(ctx); } catch (e) { return json({ error: 'Scoreboard hiccup. Try again.' }, 500); }
  };
}
