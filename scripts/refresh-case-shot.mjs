// Takes a fresh screenshot of the 757 Anime Club "Next Meetup" section for the
// Case Files card on this site. Run weekly by .github/workflows/refresh-case-shot.yml.
//
// The event flyer image is hidden before the shot: flyers sometimes feature
// franchise characters or cosplay, which shouldn't be copied onto this site.
import { chromium } from 'playwright';

const URL = 'https://757animeclub.com/';
const OUT = 'dist/assets/work/case-757-meetup.jpg';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 730 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

const section = page.locator('#next-meetup');
await section.waitFor({ state: 'visible', timeout: 30000 });
await page.waitForFunction(() => {
  const el = document.querySelector('#next-meetup');
  return el && /\d{4}/.test(el.textContent || '');
}, null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => document.fonts.ready);

await page.addStyleTag({ content: '#next-meetup img { display: none !important; } * { caret-color: transparent !important; }' });

const top = await section.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
await page.evaluate(y => window.scrollTo(0, Math.max(0, y - 110)), top);
await page.waitForTimeout(1500);

const box = await section.boundingBox();
const height = Math.min(730, Math.round(box.y + box.height + 15));
if (height < 300) throw new Error(`Next Meetup section looks wrong (height ${height}px)`);

await page.screenshot({ path: OUT, type: 'jpeg', quality: 84, clip: { x: 200, y: 0, width: 1120, height } });
console.log(`Saved ${OUT} (1120x${height})`);
await browser.close();
