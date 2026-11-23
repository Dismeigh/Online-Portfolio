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

`www.denizen-dismeigh.com` and `denizen-dismeigh.com` are connected as custom domains on the Pages project (project name `online-portfolio`). The site moved off GitHub Pages in November 2026.

## Stream schedule

Add, move or cancel streams in the Calendar.online calendar. The site picks up changes within about five minutes. It shows the next stream (or "On Now" while one is running) and up to four more in the next 90 days, in Eastern time.

## Private dashboard and Ko-fi goal bar

`/dashboard/` is Dismeigh's private dashboard (not linked anywhere, not indexed). It switches the Ko-fi goal bar on and off,
sets what it's for, the amount, and whether it also shows in the Garage.

Secrets (Pages project → Settings → Variables and Secrets), then redeploy:

- `DASHBOARD_PASSWORD`: the dashboard password, 12+ characters. Changing it logs out every session.
- `KOFI_VERIFICATION_TOKEN`: from Ko-fi → Settings → More → API. Set Ko-fi's webhook URL to `https://www.denizen-dismeigh.com/api/kofi`.

Login is two steps: the password, then a 6-digit code from an authenticator app (set up on the first login).
Lost the phone? Change `DASHBOARD_PASSWORD`: that signs out every session and resets two-step login.

How it works: `lib/admin.js` (password + authenticator code, signed HttpOnly cookie for 12 hours, 5 wrong tries per 15 minutes), `lib/kofi.js`
(webhook, goal, progress), `functions/api/admin/*` (login, twostep, logout, goal), `dist/dashboard.js`, `dist/qr.js`, `functions/api/kofi.js`, `functions/api/goal.js`, `dist/goal.js`.
Ko-fi payments keep only amount, type, currency and time (tables `kofi_payments`, `site_settings` in the ARCADE D1 database).
