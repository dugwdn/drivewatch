@AGENTS.md

# DriveWatch

Private iPhone app for parents of new drivers. Built first for Doug's family and a few friends, shaped so it can grow into a product without a rebuild. Owner: Doug (GitHub dugwdn).

The main job: tell a parent, within seconds, when the driver's phone is used while the car is going 25 mph or faster. Also: live location and speed, trip history, high-speed alerts, and an alert if tracking is switched off.

## Layout

- `src/app/` Expo Router screens. `welcome` (start a family or join with a code), `driver/` (setup and own drives), `parent/` (live map, alerts, drives, family and rules).
- `src/tracking/` background drive logging. `tracker.ts` defines the location task (idle: coarse updates; driving: precise updates plus motion). `queue.ts` keeps unsent data on the phone until the server confirms it.
- `modules/drive-sensors/` local native Swift module: unlock/lock (protected data notifications), device rotation for "phone in hand", active call and audio route (ear vs. Bluetooth/CarPlay). Android is a stub.
- `shared/` pure TypeScript used by both the app and the server: drive start/end detection, phone-use detection, alert wording, shared types.
- `server/` Cloudflare Worker + D1 (free plan). Every row belongs to a family. Typed events table. Cron every 5 minutes flags phones that go quiet mid-drive.

## Rules

- Every record is scoped by family; parents see their family, drivers see only their own drives.
- Phone-use and speed rules live per family (`families.phone_speed_mph`, default 25; `max_speed_mph`, default 80). The phone uses a cached copy; the server checks again before alerting.
- iPhone cannot tell a normal app which app was opened. Getting app names needs Apple's Family Controls entitlement (phase 3).
- The driver is never asked to tap anything while the car is moving.
- Stay on free tiers (Cloudflare free, Expo free). The Apple Developer account is Doug's ($99/yr).

## Commands

- App typecheck: `npx tsc --noEmit`
- Server: `cd server && npm test` (shared logic tests), `npx tsc --noEmit`, `npx wrangler dev --local` then `scripts/smoke.sh` for an end-to-end check.
- iPhone build to TestFlight: `npm run build:ios` (needs an Expo login; builds in the cloud, no Mac needed).

## Current state

- Phase 1 code written (PR "Phase 1: drive tracking and phone-use alerts"). Server tested locally end to end. The iPhone build has not been compiled yet (no Mac here; first EAS build will show any Swift errors).
- Not live: needs the Cloudflare D1 database and Worker deployed, the real API address in `app.json` > `extra.apiUrl`, and a first EAS build.

## Plan

1. Go live: create D1 `drivewatch`, put its id in `server/wrangler.toml`, apply migrations, deploy the Worker, set `extra.apiUrl`, first TestFlight build.
2. Real-drive tuning: handling threshold (`shared/phoneUse.ts` HANDLING_RAD_S), drive start/end timing, battery use when idle.
3. Phase 2: speed vs. posted limit, hard braking, car Bluetooth check, weekly summary.
4. Phase 3: Apple Family Controls entitlement for app names.
5. Later: Android, payments, parent website, move Apple account to the company.

Before launch (lawyer items, not blocking): terms and privacy policy for other families, minors' location data rules, data retention rule.
