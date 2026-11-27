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
| `CALENDAR_FEED_URL` | Optional, only for the one-time "bring over past streams" button in the dashboard's Streams tab (the old Calendar.online ICS link). The stream schedule itself now lives in the dashboard. Safe to delete after importing. |

Redeploy once after adding the variable. Every push to `main` deploys automatically.

### Custom domain

`www.denizen-dismeigh.com` and `denizen-dismeigh.com` are connected as custom domains on the Pages project (project name `online-portfolio`). The site moved off GitHub Pages in November 2026.

## Twitch live status

`/api/live` (`functions/api/live.js`, `lib/twitch.js`) tells the site, the go-live alerts and the dashboard health light whether Dismeigh is live.
It asks Twitch directly when these two secrets are set, and falls back to decapi.me otherwise:

- `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`: from a free app at dev.twitch.tv/console (Register Your Application, OAuth redirect `http://localhost`, category Website Integration, client type Confidential).

## Stream schedule

Add, move or cancel streams in the Calendar.online calendar. The site picks up changes within about five minutes. It shows the next stream (or "On Now" while one is running) and up to four more in the next 90 days, in Eastern time.

## Private dashboard and Ko-fi goal bar

`/dashboard/` is Dismeigh's private dashboard (not linked anywhere, not indexed). It switches the Ko-fi goal bar on and off,
sets what it's for, the amount, and whether it also shows in the Garage.

Secrets (Pages project → Settings → Variables and Secrets), then redeploy:

- `DASHBOARD_PASSWORD`: the dashboard password, 12+ characters. Changing it logs out every session.
- `KOFI_VERIFICATION_TOKEN`: from Ko-fi → Settings → More → API. Set Ko-fi's webhook URL to `https://www.denizen-dismeigh.com/api/kofi`.

Login is two steps: the password, then a 6-digit code from an authenticator app (set up on the first login).
Maintenance mode (Site tab) swaps every public page for the "Ship's in the shop" page (`dist/maintenance.html`, served with a 503) via `functions/_middleware.js` and `lib/maintenance.js`. The dashboard, all `/api/` routes (Ko-fi webhook included) and static files keep working. Private notes live in `lib/notes.js` (Notes tab, owner-only).

Phone alerts (Alerts tab) use Web Push from `lib/push.js`: the site's push key is made on first use and stored encrypted with the dashboard password (changing the password means turning alerts on again). Alerts go out for Ship's Log entries, Ko-fi payments (amount only), goal milestones and failed logins (at most every 10 minutes). Alert text is end-to-end encrypted; only Apple/Google/Mozilla/Microsoft push addresses are accepted.

Lost the phone? Use one of the backup codes (Logins tab → Backup codes; each works once in place of the 6-digit code). No codes left? Change `DASHBOARD_PASSWORD`: that signs out every session, resets two-step login and voids old backup codes.

How it works: `lib/admin.js` (password + authenticator code, signed HttpOnly cookie for 12 hours, 5 wrong tries per 15 minutes), `lib/kofi.js`
(webhook, goal, progress), `functions/api/admin/*` (login, twostep, logout, goal), `dist/dashboard.js`, `dist/qr.js`, `functions/api/kofi.js`, `functions/api/goal.js`, `dist/goal.js`.
Ko-fi payments keep only amount, type, currency and time (tables `kofi_payments`, `site_settings` in the ARCADE D1 database).

### Everything else in the dashboard

Tabs: Overview (private stats), Ko-fi goal, Content (bounties, pinned clip, quotes, lore, verdicts, crew), Ship's Log
moderation (pin, hide, delete), Arcade (remove scores or every score under a name), Banner & looks (site-wide banner,
force or turn off holiday looks), Logins (last 90 days of logins and failed tries).

- Content saved from the dashboard lives in D1 (`site_settings`, keys `content:*`) and wins over the JSON files in `dist/`.
  Until a section is saved once, the site keeps using its file. The site reads content from `/api/content/<name>`.
- Stats: `/api/hit` counts views per page per day (table `page_views`), with no IP, cookie or browser details.
- The dashboard installs as its own app (`/dashboard/manifest.webmanifest`, scope `/dashboard/`).
