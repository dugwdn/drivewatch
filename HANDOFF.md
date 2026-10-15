# DriveWatch: handoff

> Last checked against the code: 2026-10-15 (branch `phase-1-core`, commit `7625091`).
> This file explains how DriveWatch was built, why it was built that way, and how someone
> (a person or another AI tool) can take it over. It links to the project's other docs instead
> of repeating them. If this file and the code disagree, the code wins; fix this file.
>
> WHICH BRANCH HAS THE REAL WORK: `phase-1-core`. The default branch `main` holds only the empty Expo
> starter (no app, no server, no docs). The whole app is on `phase-1-core`, waiting for pull request #1
> ("Phase 1: drive tracking and phone-use alerts") to be merged into `main`. Until then, work from `phase-1-core`.

## 1. What it is and who uses it
DriveWatch is a private iPhone app for parents of new drivers. It logs each drive on its own and tells the parent within seconds if the driver's phone is used while the car is going 25 mph or faster. It also shows live location and speed, drive history, high-speed alerts, and an alert if tracking is switched off. It was built first for Doug's family and a few friends, and shaped so it can grow into a product. Status: prototype. The server is live; the iPhone app is in TestFlight, and an App Store submission is prepared but not finished. There is no public website beyond the server's home, privacy and support pages.

## 2. Where it runs
| Piece | Where | Notes |
|---|---|---|
| Live site / app | iPhone app through TestFlight (not on the App Store yet). The server answers at a workers.dev address (written in `app.json` under `extra.apiUrl`). | Public pages: `/`, `/privacy`, `/support`, `/health`. |
| Hosting | Cloudflare Worker `drivewatch-api` (free plan), config in `server/wrangler.toml` | No custom domain: unknown, check the Cloudflare dashboard. |
| Domain and DNS | none (workers.dev address) | |
| Build and publish path | Server: Doug runs `npx wrangler deploy` from `server/` on his laptop. App: `npm run build:ios` (Expo EAS cloud build, auto-submits to TestFlight). Store listing: `npx eas-cli@latest metadata:push`. | Merging a pull request does NOT publish anything. Cloud Claude sessions cannot deploy (no Cloudflare token). |
| Database | Cloudflare D1 database `drivewatch` (binding `DB`) | Migrations in `server/migrations/`. |
| Server code / workers | `server/src/` (`index.ts`, `auth.ts`, `pages.ts`, `push.ts`) | One Worker. |
| Scheduled jobs (timers) | Cron every 5 minutes in `server/wrangler.toml`; a daily route cleanup runs on the 07:00 UTC run | See section 8. |
| Email / SMS | Push alerts through Expo's push service, then Apple Push. No email system. A support email address is shown on the support page (variable `SUPPORT_EMAIL`). | |
| Analytics and ads | Own `usage_events` table. GA4 tag on the public pages plus anonymous screen counts sent by the Worker (ADR 0010). Variable `GA4_ID` is set; secret `GA4_API_SECRET` is not set yet, so app screen counts stay off. No ads. | |
| Repo | `dugwdn/drivewatch`. Default branch `main` (starter only). Real work on `phase-1-core`. | Other branches: `android-parent-later` (parked Android parent side), plus old docs and fix branches. Two newer commits not yet in `phase-1-core`: `docs/status-2026-10-06` and `fix/eas-submit-settings`. |

## 3. How it was built
- Stack: Expo SDK 57 and React Native 0.86 (TypeScript), Expo Router for screens, a local Swift native module for phone sensors, a Cloudflare Worker with D1 for the server, vitest for tests. Exact versions are in `docs/TRD.md`.
- Folder map:
  - `src/app/` screens: `welcome`, `driver/`, `parent/`.
  - `src/tracking/` background drive logging (`tracker.ts`) and the send queue (`queue.ts`).
  - `src/lib/` API client, sign-in session, notifications, back button helpers, usage counts.
  - `modules/drive-sensors/` Swift module: unlock/lock, phone in hand, calls and audio route. Android is a stub.
  - `shared/` plain TypeScript used by both app and server: drive start/end, phone-use rules, alert wording, GA4 and usage helpers.
  - `server/` the Worker, migrations, tests, `scripts/smoke.sh`.
  - `store/` and `store.config.js` App Store listing and screenshots.
  - `app.json`, `eas.json` Expo and EAS settings.
- Data model: tables `families`, `members`, `invites`, `trips`, `points`, `events`, `usage_events`. Every row belongs to a family. Table-by-table detail is in `docs/TRD.md`. Location, speed and heading are stored, so privacy rules matter (see ADR 0008 and the TRD privacy section).
- Migrations: `server/migrations/0001_init.sql`, `0002_usage.sql`, `0003_review_demo.sql`. Apply with `npm run db:migrate:remote` from `server/`, from Doug's laptop, before deploying code that needs them. There are no down migrations; undo with a new migration. Doug must OK anything that touches the live database.
- Tests: `cd server && npm test` (drive detection, phone-use rules, alert text, usage rows, GA4, sample-family lock). `npx tsc --noEmit` for the app and in `server/` for the server. `server/scripts/smoke.sh` walks the full flow against a local server.

## 4. Why it was built this way
- One Expo app for both parent and driver, iPhone first: `docs/adr/0001-iphone-first-expo.md`.
- Families from day one, so it can grow past Doug's family without a rebuild: ADR 0002.
- Cloudflare Workers + D1 on the free plan, about $0 a month at family size: ADR 0003.
- "Phone use" means unlock or handling above 25 mph, because iPhone will not tell a normal app which app was opened (that needs Apple's Family Controls approval, phase 3): ADR 0004.
- The driver is never asked to tap anything while moving: ADR 0005. No crash detection or 911 calls: ADR 0006.
- Own usage counts first, then anonymous GA4: ADRs 0007 and 0010. GPS routes deleted after 90 days: ADR 0008. No passwords, a per-phone token from an invite code: ADR 0009.
- Product reasons: `docs/PRD.md`, `docs/roadmap.md`.

## 5. Accounts and services
| Service | Used for | Owner account | Where the secret lives |
|---|---|---|---|
| GitHub | Code and pull requests | Doug (`dugwdn`) | No repository secrets. There are no GitHub Actions in this repo. |
| Cloudflare | Worker, D1 database, cron, rate limit | Doug's Cloudflare account | Login is `npx wrangler login` on Doug's laptop. Worker secret `GA4_API_SECRET` (set with `npx wrangler secret put GA4_API_SECRET` from `server/`). |
| Expo / EAS | Cloud iPhone builds, TestFlight submit, store listing push | Doug's Expo account | Login on Doug's laptop. Apple signing credentials are managed by EAS. |
| Apple Developer | App Store and TestFlight ($99 a year) | Doug's Apple account (planned to move to the company later) | Login only. |
| Expo push service / Apple Push | Alerts to the parent's phone | Free, no account setup beyond Expo | None. |
| Google Analytics 4 | Anonymous screen counts, web tag | Doug's Google account, property "DriveWatch" | Public ID in `server/wrangler.toml` (`GA4_ID`). API secret as above. |
| Environment variable `REVIEW_PHONE` | App Review contact phone for `metadata:push` | Doug's laptop | Kept out of git; set it in PowerShell before pushing the listing. |

## 6. Run it on Doug's Windows laptop
Needs Node and npm. The app uses native code, so Expo Go will not work; use a development build.
1. Open VS Code > File > Open Folder > `C:\Users\doug\Documents\drivewatch`. If the folder is missing, clone it first:
```
cd C:\Users\doug\Documents
git clone https://github.com/dugwdn/drivewatch
cd drivewatch
git checkout phase-1-core
```
2. Terminal > New Terminal. Check the code and run the tests (each on its own):
```
npm install
```
```
npx tsc --noEmit
```
```
cd server
npm install
npm test
```
You should see the tests finish with no failures.
3. Run the server on your laptop only (still in `server`):
```
npm run db:migrate:local
npx wrangler dev --local
```
You should see the server listening on http://localhost:8787. Open http://localhost:8787/health; it should show `{"ok":true}`.
4. The app itself needs a phone build (section 7). To point a dev build at the local server, change `extra.apiUrl` in `app.json` locally and never commit that change. No env file is needed.

## 7. Publish, roll back, check health
- Publish the server (Doug, on his laptop): `cd server`, then `npm test`, then `npm run db:migrate:remote` (only if there is a new file in `server/migrations/`), then `npx wrangler deploy`.
- Publish the iPhone app: `npm run build:ios` from the project folder (needs an Expo login). It builds in the cloud and sends the build to TestFlight. Server-only changes need no new app build.
- Store listing: set `REVIEW_PHONE`, then `npx eas-cli@latest metadata:push`. App Store steps for Doug are in the project files at DriveWatch/app-store-steps.md (outside this repo).
- Roll back the server: from `server/`, `npx wrangler rollback`, or check out the last good commit and deploy it. In the Cloudflare dashboard: Workers & Pages > drivewatch-api > Deployments.
- Roll back the database: no down files. Write a new migration. D1 Time Travel can restore an earlier minute but also loses newer data; real damage only. Steps in `docs/runbook.md`.
- Roll back the app: TestFlight testers can install an earlier build. For the App Store, ship a fixed build.
- Health check: open the server's `/health` page (should show `{"ok":true}`), then `/privacy` and `/support`. On a test phone, a short drive should show up in the parent's drive list. Full list in `docs/runbook.md`.

## 8. Recurring jobs and what breaks if they stop
- Cron every 5 minutes (Worker): flags a phone that goes quiet in the middle of a drive and sends the parent an alert. If it stops, "phone stopped reporting" alerts stop.
- Daily route cleanup (same Worker, 07:00 UTC run): deletes GPS points older than 90 days. Trips and alerts stay. If it stops, old routes pile up and the privacy page becomes untrue.
- Both are set in `server/wrangler.toml` and start with each `npx wrangler deploy`.

## 9. Known issues and quirks
- Merging does not publish. The server and the app go live only when Doug deploys from his laptop. Changes can sit merged but not live.
- Cloud Claude sessions cannot deploy or reach the workers.dev address (no Cloudflare token, network policy). Check the live server with a web fetch instead.
- Wrangler error code 7403 on a D1 command: `npx wrangler logout`, then `npx wrangler login`.
- The Swift module first compiles inside EAS; read the EAS build log for Swift errors.
- No GA4 app screen counts until the `GA4_API_SECRET` secret is added. Before shipping an app build with counts on, the App Store privacy label must add Analytics: Product Interaction, not linked, not tracking.
- The sample "Sample Family" for App Review is look-around only (made by migration 0003). Sign-ups are limited to 10 tries a minute per address.
- The App Store listing name still has a suffix ("DriveWatch (d5baeb)"); renaming is on the roadmap.
- `main` is out of date by design right now; see the note at the top.

## 10. Open work
See "Plan" in `CLAUDE.md` and `docs/roadmap.md`. Right now: merge PR #1 into `main`, finish the App Store submission, do a real test drive and tune the handling threshold. Later: speed vs. posted limit, Apple Family Controls (app names), Android, payments.

## 11. Other docs in this repo
| Doc | File |
|---|---|
| Project rules and current state | `CLAUDE.md` (and `AGENTS.md`, Expo rules for AI tools) |
| README | `README.md` |
| Product requirements | `docs/PRD.md` |
| Roadmap | `docs/roadmap.md` |
| Technical design and privacy | `docs/TRD.md` |
| Decision records | `docs/adr/README.md` |
| Runbook | `docs/runbook.md` |
| Test plan | `docs/test-plan.md` |
| Changelog | `CHANGELOG.md` |

## 12. Take over with another bot
```
You are taking over DriveWatch (repo dugwdn/drivewatch). The real work is on branch phase-1-core, not main. Before changing anything:
1. Read HANDOFF.md, then CLAUDE.md, then AGENTS.md and docs/TRD.md.
2. Run `cd server && npm test` and `npx tsc --noEmit` (app) and confirm they pass before you edit.
Rules:
- Expo changes every SDK release. Before touching any Expo, EAS or React Native API, read the versioned docs for the expo major version in package.json. Use `npx expo install` to add packages.
- Every record is scoped by family; parents see their family, drivers see only their own drives.
- The driver is never asked to tap anything while the car is moving.
- Stay on free tiers (Cloudflare free, Expo free).
- Phone back button stays in the app: every non-home screen has a visible Back arrow; use useBackClose for sheets and steps.
- Never create or edit ios/ or android/ by hand; use app.json and config plugins.
- Do not store anything new about location or minors without a decision record and Doug's OK; apply migrations and deploys only when Doug says so (you cannot deploy from a cloud session).
- Never rewrite an accepted decision record (docs/adr); add a new one that supersedes it.
- Never commit passwords, keys or tokens. Secrets live in Cloudflare Worker secrets and the Expo account.
- Work on a new branch and open a pull request; never push straight to main or phase-1-core.
- Update HANDOFF.md in the same pull request if you change hosting, the data model, the deploy
  path or a key decision.
Task: <describe the task here>
```

## 13. Take over by hand
1. Doug adds the person as a collaborator: GitHub > repo > Settings > Collaborators > Add people.
2. Service access: invite them to the Cloudflare account (Worker and D1), the Expo account (builds), and the Apple Developer / App Store Connect team (TestFlight and the App Store). Google Analytics for the DriveWatch property.
3. Run locally (section 6). Publishing is done from a laptop with wrangler and EAS logins (section 7), not by merging.
