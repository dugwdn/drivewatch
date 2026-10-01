# DriveWatch: product requirements (PRD)

Owner: Doug (GitHub dugwdn). Last reviewed 2026-10-01.
Related: [roadmap](roadmap.md), [TRD](TRD.md), [decision records](adr/README.md). `CLAUDE.md` holds the current build state.

## Who it is for

- **Parents of a new teen driver.** First Doug's family, then a few friends' families. Built so more families can join without a rebuild ([ADR 0002](adr/0002-families-from-day-one.md)).
- **The teen driver.** They install the same app, join with a code a parent gives them, and grant location and motion access. They always know DriveWatch is on.

## The problem

A parent can't see if a new driver uses their phone while the car is moving. Rival apps mostly report phone use after the trip. DriveWatch's main job is to tell a parent **within seconds** when the driver's phone is used while the car is going 25 mph or faster ([ADR 0004](adr/0004-phone-use-what-iphone-allows.md)).

## Goals

1. Live phone-use alert to parents, within seconds, at or above the family's phone-use speed (default 25 mph).
2. Drives log on their own. The driver never taps anything while moving ([ADR 0005](adr/0005-never-ask-driver-while-moving.md)).
3. Parents learn when tracking is switched off or the phone goes quiet mid-drive.
4. Keep a minor's data inside the family, with no outside analytics, and delete old routes ([ADR 0007](adr/0007-own-usage-counts-not-google.md), [ADR 0008](adr/0008-delete-routes-after-90-days.md)).
5. Run at $0 a month at family size (Cloudflare free plan, Expo free tier; Apple Developer account is $99 a year) ([ADR 0003](adr/0003-cloudflare-free-plan.md)).

## Non-goals (do not build)

- Crash detection or calling 911 ([ADR 0006](adr/0006-not-building-crash-detection.md)).
- Naming which app was opened, until Apple's Family Controls permission is granted (phase 3). Alerts never claim more than the phone tells us.
- Any prompt to the driver while the car is moving.
- Google Analytics or any third-party analytics or ad SDK.
- A web app. There is no web build (react-native-web is not installed).
- Android drivers for now. The Android sensor module is a stub. A parked branch `android-parent-later` has an Android parent side only.

## Requirements as built today (Phase 1, branch `phase-1-core`)

| Area | What it does | Where in code |
|---|---|---|
| Family setup | A parent starts a family. Parents make 6-character invite codes (one use, expire after 7 days) for a parent or a driver. | `src/app/welcome.tsx`, `server/src/index.ts` (`createFamily`, `createInvite`, `join`) |
| Roles | One app. Parents see the live map, drives, alerts, family and rules. Drivers see setup and their own drives only. | `src/app/parent/`, `src/app/driver/` |
| Drive logging | Background location task. A drive starts after 2 fixes at 10 mph or more, ends after 4 minutes stopped. Unsent data stays on the phone until the server confirms it. | `src/tracking/tracker.ts`, `src/tracking/queue.ts`, `shared/drive.ts` |
| Phone-use detection | Unlock, unlocked phone being handled (rotation over `HANDLING_RAD_S` = 1.2 rad/s), or a call held to the ear, at or above the family's phone speed. A call on car Bluetooth or CarPlay is not flagged. | `shared/phoneUse.ts`, `modules/drive-sensors/ios/` |
| Alerts | Push to every parent in the family: phone use, high speed (default 80 mph), location permission no longer "Always", phone stopped reporting mid-drive (6 minutes quiet), driver deleted their account. Same alert type for the same driver at most once a minute. | `shared/alerts.ts`, `server/src/push.ts`, `server/src/index.ts` |
| Family rules | Per-family `phone_speed_mph` (5 to 60, default 25) and `max_speed_mph` (30 to 120, default 80). Phone keeps a cached copy; server checks again before alerting. | `src/app/parent/settings.tsx`, `server/src/index.ts` (`updateFamily`) |
| Drive history | List of drives, each with a route map, top speed, distance, and phone-use spots. "I was a passenger" mark. | `src/app/parent/trip/[id].tsx`, `/v1/trips` |
| Account deletion | "Delete my account" in the app. Erases the person's data; the last parent deleting erases the whole family. | `src/lib/account.ts`, `DELETE /v1/me` |
| Public pages | Home, `/privacy`, `/support`, served by the Worker for the App Store. | `server/src/pages.ts` |
| App Review | Look-around-only "Sample Family" joined with the reusable code APPREVIEW. | `server/migrations/0003_review_demo.sql` |
| App-use counts | Own `usage_events` table. No location, names, or free text. | `src/lib/usage.ts`, `shared/usage.ts` |

## Planned

See [roadmap](roadmap.md). In short: real-drive tuning, then phase 2 (speed vs. posted limit, hard braking, car Bluetooth check, weekly summary), then phase 3 (Family Controls for app names), then later Android, payments, a parent website.

## Success measures

No numeric targets have been set yet. What the product promises and can be checked:

- Phone-use alert reaches the parent "within seconds" of the event. Numeric target: Not decided yet.
- No false alerts from a passenger bump or a mounted phone after real-drive tuning. Measure: Not decided yet.
- Every drive by the driver is logged (no missed drives) while location is "Always".
- Parents are told every time tracking is switched off.
- App-use counts in `usage_events` (app opens, screen views, invites, rule changes, trip views) show which parts are used. No screen shows them yet.

## Open questions (lawyer items before other families, from `CLAUDE.md`)

- Terms and privacy policy for other families (must mention app-use counts).
- Rules for minors' location data.
- Confirm the 90-day route rule.
