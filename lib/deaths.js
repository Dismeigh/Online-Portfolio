// Death counter: one running count for the game being played, controlled from the dashboard (Streams tab).
// Shown on an OBS overlay (/overlay/?w=deaths) and, if switched on, on the home page. Past runs are kept (last 20).
// Stored in site_settings 'deaths' as { game, count, since, home, runs: [{ game, count, since, ended }] }.
const KEY = 'deaths';
const line = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const MAX = 99999;
export async function getDeaths(db) {
  let d = null;
  try { d = JSON.parse((await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(KEY).first())?.value || 'null'); } catch {}
  return { game: '', count: 0, since: 0, home: false, runs: [], updated: 0, ...(d && typeof d === 'object' ? d : {}) };
}
const save = (db, d) => db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(KEY, JSON.stringify(d)).run();
export const publicDeaths = d => ({ on: !!d.game, game: d.game, count: d.count, home: !!d.home && !!d.game, updated: d.updated });
export async function changeDeaths(db, b, now = Date.now()) {
  const d = await getDeaths(db);
  const archive = () => { if (d.game && d.count > 0) d.runs = [{ game: d.game, count: d.count, since: d.since, ended: now }, ...d.runs].slice(0, 20); };
  switch (b?.action) {
    case 'add': { // n: how many taps since the last save (negative to take some away)
      const n = b.n === undefined ? 1 : Math.round(Number(b.n)); if (!(n >= -50 && n <= 50)) return { error: 'Bad request.' };
      d.count = Math.max(0, Math.min(MAX, d.count + n)); break;
    }
    case 'set': { const n = Math.round(Number(b.count)); if (!(n >= 0 && n <= MAX)) return { error: 'Use a number from 0 to 99,999.' }; d.count = n; break; }
    case 'start': { // a new run: the current one (if any deaths) goes into past runs
      const game = line(b.game, 60); if (!game) return { error: 'Type the game name.' };
      archive(); d.game = game; d.count = 0; d.since = now; break;
    }
    case 'rename': { const game = line(b.game, 60); if (!game) return { error: 'Type the game name.' }; d.game = game; break; }
    case 'end': archive(); d.game = ''; d.count = 0; d.since = 0; break;
    case 'home': d.home = !!b.on; break;
    case 'clearRuns': d.runs = []; break;
    default: return { error: 'Unknown action.' };
  }
  if (!d.game && ['add', 'set'].includes(b.action)) return { error: 'Start a run first (type the game name).' };
  d.updated = now; await save(db, d); return { ok: true, deaths: d };
}
