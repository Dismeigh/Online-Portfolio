// Monthly site health check, run by .github/workflows/health-check.yml.
// 1) Every main page and data feed must load.
// 2) Lighthouse (mobile) scores for the home page are compared to the stored baseline.
// Problems are written to health-problems.md, which the workflow turns into a GitHub issue.
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const SITE = 'https://www.denizen-dismeigh.com';
const PAGES = ['/', '/lore/', '/rewind/', '/install/', '/api/schedule', '/api/youtube', '/calendar.ics', '/lore.json', '/milestones.json', '/sitemap.xml'];
const BASELINE = '.github/health/baseline.json';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const ALLOWED_DROP = { performance: 10, accessibility: 5, 'best-practices': 5, seo: 5 };
const RUNS = 3;

export function compare(scores, baseline) {
  const drops = [];
  for (const c of CATEGORIES) {
    if (baseline?.[c] == null || scores[c] == null) continue;
    if (scores[c] < baseline[c] - ALLOWED_DROP[c]) drops.push(`${c}: ${scores[c]} (was ${baseline[c]})`);
  }
  return drops;
}

export function raise(scores, baseline) {
  const next = { ...(baseline || {}) };
  let changed = !baseline;
  for (const c of CATEGORIES) if (scores[c] != null && (next[c] == null || scores[c] > next[c])) { next[c] = scores[c]; changed = true; }
  return { next, changed };
}

const median = list => { const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function checkPages() {
  const problems = [];
  for (const path of PAGES) {
    try {
      const r = await fetch(SITE + path, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (!r.ok) problems.push(`${path} returned ${r.status}`);
    } catch (e) { problems.push(`${path} did not load (${e.name})`); }
  }
  return problems;
}

function lighthouse() {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    execFileSync('lighthouse', [SITE + '/', '--quiet', '--output=json', '--output-path=lh.json',
      `--only-categories=${CATEGORIES.join(',')}`, '--chrome-flags=--headless=new --no-sandbox'], { stdio: 'inherit' });
    runs.push(JSON.parse(execFileSync('cat', ['lh.json'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })));
  }
  const scores = {};
  for (const c of CATEGORIES) scores[c] = median(runs.map(r => Math.round((r.categories[c]?.score ?? 0) * 100)));
  return scores;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pageProblems = await checkPages();
  const scores = lighthouse();
  let baseline = null;
  try { baseline = JSON.parse(await readFile(BASELINE, 'utf8')).scores; } catch {}
  const drops = compare(scores, baseline);
  const { next, changed } = raise(scores, baseline);
  if (changed && !drops.length) {
    await writeFile(BASELINE, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), scores: next }, null, 2) + '\n');
  }

  const table = CATEGORIES.map(c => `| ${c} | ${scores[c]} | ${baseline?.[c] ?? 'n/a'} |`).join('\n');
  const summary = `## Site health check\n\n| Lighthouse (mobile) | Now | Baseline |\n|---|---|---|\n${table}\n\nPages checked: ${PAGES.length}, problems: ${pageProblems.length}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);

  const problems = [...pageProblems, ...drops.map(d => `Lighthouse ${d}`)];
  if (problems.length) {
    await writeFile('health-problems.md', `The monthly check of ${SITE} found:\n\n${problems.map(p => `- ${p}`).join('\n')}\n\n${summary}\nScores can wobble a little month to month; a drop that shows up again next month is worth a look.\n`);
    console.log('Problems found:\n' + problems.join('\n'));
  }
}
