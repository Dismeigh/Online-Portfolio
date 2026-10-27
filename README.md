# Dismeigh Online Portfolio

A personal portfolio and creator hub for Dismeigh, featuring streaming links, car photos, gaming clips, sponsors, a calendar-driven stream schedule, and Denizen Technologies.

## Layout

| Path | What it is |
| --- | --- |
| `dist/` | The website itself (HTML, CSS, images, clips) |
| `functions/api/schedule.js` | `/api/schedule`: reads the stream calendar and returns upcoming streams as JSON |
| `lib/schedule.js` | Calendar parsing (recurring streams, skipped dates, moved dates, cancellations) |
| `package.json` | Pins `ical.js`, which Cloudflare installs for the function |

## Cloudflare Pages deployment

Connect this GitHub repository to a **Cloudflare Pages** project using Git integration (Workers & Pages → Create → Pages → Connect to Git).

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `dist` |
| Root directory | Leave blank |

Then under **Settings → Variables and Secrets**, add:

| Variable | Value |
| --- | --- |
| `CALENDAR_FEED_URL` | The Calendar.online ICS subscription link, e.g. `https://export.calendar.online/ics/<number>/7e461a2bf4ac3d7a10bc/<name>.ics` |

Redeploy once after adding the variable. Every push to `main` deploys automatically.

### Custom domain

In the Pages project's **Custom domains** tab, add `www.denizen-dismeigh.com` (and `denizen-dismeigh.com` if you want the bare domain too) and follow Cloudflare's DNS prompts. Once the site loads from Cloudflare, turn off GitHub Pages (repo Settings → Pages) and delete `.github/workflows/deploy.yml`.

Until then, GitHub Pages keeps serving `dist/`. The schedule section stays hidden there because GitHub Pages can't run the calendar function.

## Stream schedule

Add, move or cancel streams in the Calendar.online calendar. The site picks up changes within about five minutes. It shows the next stream (or "On Now" while one is running) and up to four more in the next 90 days, in Eastern time.
