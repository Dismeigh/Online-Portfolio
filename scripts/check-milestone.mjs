// Records Twitch follower milestones as they're crossed, so the site can celebrate.
// Run every few hours by .github/workflows/check-milestone.yml.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'dist/milestones.json';
const MILESTONES = [50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 25000, 50000, 100000];

const response = await fetch('https://decapi.me/twitch/followcount/dismeigh', { headers: { 'Cache-Control': 'no-cache' } });
const count = parseInt((await response.text()).trim(), 10);
if (!response.ok || !Number.isFinite(count)) throw new Error('Could not read follower count');

const data = JSON.parse(await readFile(FILE, 'utf8'));
const recorded = Math.max(0, ...data.achieved.map(a => a.milestone));
const reached = MILESTONES.filter(m => m <= count && m > recorded);

if (!reached.length) {
  console.log(`${count} followers, no new milestone (last: ${recorded}).`);
} else {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  for (const milestone of reached) data.achieved.push({ milestone, date: today });
  await writeFile(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`${count} followers: new milestone ${reached.at(-1)} on ${today}.`);
}
