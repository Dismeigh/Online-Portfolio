// Stamps today's date (Eastern) on any mod that just moved to "Done" on the build sheet.
// Run by .github/workflows/stamp-mods.yml whenever dist/index.html changes.
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const FILE = 'dist/index.html';

export function doneItems(html) {
  const section = (html.match(/<section class="build-col build-done"[\s\S]*?<\/ul>/) || [''])[0];
  return [...section.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].map(m => ({ attrs: m[1], name: m[2].replace(/<[^>]+>/g, '').trim() }));
}

export function stamp(current, previous, today) {
  const before = new Set(doneItems(previous).map(i => i.name.toLowerCase()));
  const section = (current.match(/<section class="build-col build-done"[\s\S]*?<\/ul>/) || [''])[0];
  if (!section) return { html: current, stamped: [] };
  const stamped = [];
  const updated = section.replace(/<li([^>]*)>([\s\S]*?)<\/li>/g, (whole, attrs, inner) => {
    const name = inner.replace(/<[^>]+>/g, '').trim();
    if (/data-done=/.test(attrs) || before.has(name.toLowerCase())) return whole;
    stamped.push(name);
    return `<li${attrs} data-done="${today}">${inner}</li>`;
  });
  return { html: current.replace(section, updated), stamped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const current = await readFile(FILE, 'utf8');
  let previous = '';
  try { previous = execSync(`git show HEAD~1:${FILE}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); } catch { console.log('No previous version; nothing to compare.'); process.exit(0); }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const { html, stamped } = stamp(current, previous, today);
  if (stamped.length) { await writeFile(FILE, html); console.log(`Stamped ${today}: ${stamped.join(', ')}`); }
  else console.log('No newly finished mods.');
}
