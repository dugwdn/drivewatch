# DriveWatch runbook

Last reviewed 2026-10-01. Related: [TRD](TRD.md), [test plan](test-plan.md).

## What runs where

| Piece | Where | Who deploys |
|---|---|---|
| API Worker `drivewatch-api` | Cloudflare, https://drivewatch-api.noisy-sunset-3f0d.workers.dev | Doug, from his laptop |
| Database `drivewatch` | Cloudflare D1 (binding `DB`) | Doug, migrations from his laptop |
| Cron | Same Worker, every 5 minutes (`*/5 * * * *`); daily route cleanup on the 07:00 UTC run | Deployed with the Worker |
| Push alerts | Expo push service, then Apple Push Notifications | Nothing to deploy |
| iPhone app | EAS cloud build, TestFlight | `npm run build:ios` (Expo login) |

Cloud (Claude Code) sessions cannot deploy: they have no Cloudflare token, and workers.dev is blocked by the cloud network policy. Check the live server with a web fetch instead.

## Where secrets and settings live (names only)

- **Cloudflare login:** `npx wrangler login` on Doug's laptop. No Cloudflare API token is stored in the repo or in cloud sessions.
- **Expo / EAS login:** Doug's Expo account. Apple signing credentials are managed by EAS.
- **`REVIEW_PHONE`:** environment variable on Doug's laptop, only for `metadata:push`. Kept out of git.
- **Worker vars:** `SUPPORT_EMAIL` in `server/wrangler.toml` `[vars]` (not secret). There are no Worker secrets.
- **Bindings:** `DB` (D1 `drivewatch`), `SIGNUP_LIMITER` (rate limit, 10 per 60 s) in `server/wrangler.toml`.
- **App config:** `app.json` `extra.apiUrl` (API address) and `extra.eas.projectId`.

## Deploy the server

From the project folder on Doug's laptop:

```bash
cd server
npm test && npx tsc --noEmit
npm run db:migrate:remote     # only when there is a new file in server/migrations/
npx wrangler deploy
```

Then run the health checks below.

Migrations so far: 0001 (tables), 0002 (`usage_events`), 0003 (sample family and reusable invites). Migration 0003 sets sample drive times relative to when it runs.

## Build and ship the iPhone app

```bash
npm run build:ios             # EAS build, production profile, auto-submit to TestFlight
npx eas-cli@latest metadata:push   # store listing; set REVIEW_PHONE first
```

App Store steps for Doug are in the project files: /mnt/project-files/DriveWatch/app-store-steps.md.

Server-only changes (for example the 2026-10-01 review fixes) need only `npx wrangler deploy`, no new iPhone build.

## Roll back

- **Worker:** `npx wrangler rollback` (from `server/`) goes back to the previous deployment. Or check out the last good commit and `npx wrangler deploy`.
- **Database:** D1 migrations have no down files here. Undo with a new migration. D1 Time Travel can restore the database to an earlier minute (`npx wrangler d1 time-travel restore drivewatch --timestamp=<time>`); this also loses data written since then, so use it only for real damage.
- **iPhone app:** TestFlight testers can install an earlier build from TestFlight. For the App Store, ship a fixed build; there is no instant rollback.

## Health checks

1. `GET /health` returns `{"ok":true}`.
2. `/privacy` and `/support` return pages.
3. On a test phone: parent home shows the driver's last seen time; a short drive shows up in the drive list.
4. Cloudflare dashboard: Worker errors and cron runs (every 5 minutes) look normal.
5. Against a local server, `server/scripts/smoke.sh` walks through the full flow.

## Common failures and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| No drives show up | Driver's location is not "Always" or Precise Location is off | iPhone Settings > DriveWatch > Location > Always, Precise on |
| Parent gets no alerts | Notifications off on the parent phone, or no push token saved | iPhone Settings > Notifications > DriveWatch > Allow; open the app once so it saves the push token |
| "That code is not valid" | Code used, or older than 7 days | Parent makes a new code under Family and rules |
| "Too many tries" (429) on join | Sign-up rate limit: 10 per minute per address | Wait a minute |
| Wrangler says code 7403 on a D1 command | Stale login on the laptop | `npx wrangler logout` then `npx wrangler login` |
| "Please sign in again" (401) | Phone's token was removed by a parent, or the account was deleted | Join again with a new code |
| Swift build error in EAS | First compile of `modules/drive-sensors/` happens in EAS | Read the EAS build log, fix the Swift, rebuild |
| "Phone stopped reporting" alerts on a normal drive | Phone lost signal or iOS paused the app for 6+ minutes | Check the drive; data queued on the phone is sent later |
| Old drives have no route map | 90-day route cleanup | Expected ([ADR 0008](adr/0008-delete-routes-after-90-days.md)) |

## Data requests

- A person deletes their own data in the app ("Delete my account"). Support page explains where.
- Support email is set in `wrangler.toml` `SUPPORT_EMAIL` and shown on `/support` and `/privacy`.
