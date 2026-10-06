# DriveWatch

Private iPhone app for parents of new drivers. It logs each drive on its own and tells parents within seconds if the driver's phone is used while the car is going 25 mph or faster. Also: live location and speed, drive history with a route map, high-speed alerts, and an alert if tracking is switched off.

- API and public pages: https://drivewatch-api.noisy-sunset-3f0d.workers.dev (`/privacy`, `/support`, `/health`)
- Owner: Doug (GitHub dugwdn)
- Not on the App Store yet. Family testers get it through TestFlight.

## Branches

The app lives on `phase-1-core` until PR #1 ("Phase 1: drive tracking and phone-use alerts") merges into `main`. Until then `main` holds only the Expo starter. `android-parent-later` is a parked Android parent side.

## Layout

| Folder | What |
|---|---|
| `src/app/` | Expo Router screens: `welcome`, `driver/`, `parent/` |
| `src/tracking/` | Background drive logging and the send queue |
| `src/lib/` | API client, session, notifications, app-use counts, helpers |
| `modules/drive-sensors/` | Local Swift module: unlock, phone in hand, calls (Android is a stub) |
| `shared/` | TypeScript used by app and server: drive detection, phone-use rules, alert text |
| `server/` | Cloudflare Worker + D1 API, migrations, tests, smoke script |
| `store/`, `store.config.js` | App Store listing and screenshots |
| `docs/` | Product and technical docs (table below) |

## Run locally

Needs Node and npm.

```bash
# App
npm install
npx expo start              # dev server; the app uses native code, so use a development build, not Expo Go
npx tsc --noEmit            # typecheck

# Server
cd server
npm install
npm run db:migrate:local    # create local D1 tables
npx wrangler dev --local    # API on http://localhost:8787
scripts/smoke.sh            # end-to-end walk-through (needs curl and jq)
```

The app reads its API address from `app.json` `extra.apiUrl` (the live Worker). To point a dev build at a local server, change that value locally and do not commit it.

## Test

```bash
cd server && npm test       # vitest: drive detection, phone-use rules, alert text, usage rows, sample-family lock
cd server && npx tsc --noEmit
npx tsc --noEmit            # app
```

See [docs/test-plan.md](docs/test-plan.md).

## Deploy

- **Server:** from Doug's laptop, `cd server && npx wrangler deploy` (apply new migrations first with `npm run db:migrate:remote`).
- **iPhone app:** `npm run build:ios` (EAS cloud build, auto-submits to TestFlight; needs an Expo login).
- **Store listing:** `npx eas-cli@latest metadata:push` with `REVIEW_PHONE` set.

Details and rollback: [docs/runbook.md](docs/runbook.md).

## Docs

| Doc | Where |
|---|---|
| PRD (product requirements) | [docs/PRD.md](docs/PRD.md) |
| Product roadmap | [docs/roadmap.md](docs/roadmap.md) |
| TRD (technical design + technical roadmap, privacy) | [docs/TRD.md](docs/TRD.md) |
| Decision records (ADRs) | [docs/adr/](docs/adr/README.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Runbook | [docs/runbook.md](docs/runbook.md) |
| Test plan | [docs/test-plan.md](docs/test-plan.md) |
| Rules for AI agents and current state | [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) |
