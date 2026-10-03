# DriveWatch: technical design and technical roadmap (TRD)

Last reviewed 2026-10-01, against branch `phase-1-core`. Related: [PRD](PRD.md), [decision records](adr/README.md), [runbook](runbook.md), [test plan](test-plan.md).

## Architecture

```
Driver iPhone (Expo app)                     Cloudflare (free plan)                 Parent iPhone (same app)
 background location task  --HTTPS JSON-->   Worker drivewatch-api  --SQL-->  D1    live map, drives, alerts
 drive-sensors Swift module                   cron */5 min                    "drivewatch"
 queue in AsyncStorage                        push via Expo  --> Expo push --> APNs --> parent phone
```

- **One Expo app** for both roles ([ADR 0001](adr/0001-iphone-first-expo.md)). Expo Router screens in `src/app/`: `welcome`, `driver/`, `parent/` (home, `settings`, `trip/[id]`).
- **Background tracking** in `src/tracking/tracker.ts`. Idle mode: `Balanced` accuracy, update every 100 m. Driving mode: `BestForNavigation`, every 10 m, plus motion sensing.
- **Native module** `modules/drive-sensors/` (Swift): unlock and lock (protected data notifications), rotation rate (CoreMotion) for "phone in hand", active call and audio route (CallKit, AVFoundation). Android is a stub.
- **Shared logic** in `shared/` (plain TypeScript, used by app and server): drive start and end (`drive.ts`), phone-use detection (`phoneUse.ts`), alert wording (`alerts.ts`), usage row cleaning (`usage.ts`), types.
- **Server** `server/src/index.ts`: one Cloudflare Worker, D1 binding `DB`, cron every 5 minutes ([ADR 0003](adr/0003-cloudflare-free-plan.md)).

## Stack

| Part | Version (from package.json) |
|---|---|
| Expo SDK | ~57.0.25 |
| React Native | 0.86.3 |
| React | 19.2.3 |
| Expo Router | ~57.0.23 (typed routes on) |
| expo-location, expo-task-manager, expo-notifications, expo-secure-store | SDK 57 |
| react-native-maps | 1.27.2 |
| App TypeScript | ~6.0.3 |
| Server: wrangler | ^4.143.0 |
| Server: TypeScript | ^5.9.3 |
| Server tests: vitest | ^3.2.7 |

## Hosting and builds

- **API:** Cloudflare Worker `drivewatch-api` at https://drivewatch-api.noisy-sunset-3f0d.workers.dev (set in `app.json` `extra.apiUrl`). D1 database `drivewatch`. Config in `server/wrangler.toml`.
- **App builds:** EAS (Expo cloud), profile `production` with `autoIncrement`, app version source `remote` (`eas.json`). `npm run build:ios` builds and auto-submits to TestFlight. No Mac is used.
- **Store listing:** `store.config.js`, pushed with `npx eas-cli@latest metadata:push`. Screenshots in `store/apple/screenshot/`, made from `store/source/`.
- iOS bundle id and Android package: `com.webdesignnerd.drivewatch`. URL scheme `drivewatch://`.

## Data model (D1)

Migrations in `server/migrations/`:

| Table | Holds | Migration |
|---|---|---|
| `families` | name, `phone_speed_mph` (default 25), `max_speed_mph` (default 80), `demo` flag | 0001, 0003 |
| `members` | family, role (`parent` or `driver`), first name, `token_hash`, `push_token`, `location_permission`, last seen time, **last location, speed and heading**, open trip | 0001 |
| `invites` | 6-character code, role, creator, expiry, used by, `reusable` flag | 0001, 0003 |
| `trips` | driver, start and end, distance, top speed, phone-use count, passenger flag, last point | 0001 |
| `points` | GPS route points per trip: time, lat, lng, speed, heading, accuracy | 0001 |
| `events` | typed events: who, type, time, **lat, lng, speed**, detail JSON, alerted flag | 0001 |
| `usage_events` | app-use counts: who, family, role, action, object, source (`app` or `server`), time. No location, names or free text. | 0002 |

Every row is scoped by family ([ADR 0002](adr/0002-families-from-day-one.md)).

## API

All JSON. Sign-in is `Authorization: Bearer <token>`.

| Method and path | Who | Does |
|---|---|---|
| `GET /health` | anyone | `{ok:true}` |
| `GET /`, `/privacy`, `/support` | anyone | HTML pages (`server/src/pages.ts`) |
| `POST /v1/families` | anyone, rate limited | Start a family, returns a parent token |
| `POST /v1/join` | anyone, rate limited | Join with an invite code, returns a token |
| `GET /v1/family`, `PATCH /v1/family` | member; PATCH parent only | Family, members, rules; change name and rules |
| `POST /v1/invites` | parent | Make a code |
| `POST /v1/push-token` | member | Save this phone's Expo push token |
| `POST /v1/ingest` | driver | Trips, points, events, permission status; returns rules |
| `POST /v1/usage` | member | App-use rows (`app_open`, `screen_view` only) |
| `GET /v1/live` | member | Drivers' last location (a driver sees only themselves) |
| `GET /v1/trips`, `GET /v1/trips/:id` | member | Drive list and detail (a driver sees only their own) |
| `GET /v1/events` | member | Alerts and events (a driver sees only their own) |
| `POST /v1/trips/:id/passenger` | member | "I was a passenger" mark |
| `DELETE /v1/members/:id` | parent | Sign a member's phone out for good |
| `DELETE /v1/me` | member | Delete my account |

## Key flows

1. **Join.** Parent creates a family, makes a code (`POST /v1/invites`), driver types it in `welcome`. Server stores only a SHA-256 hash of the new token. The phone keeps the token in the iPhone keychain.
2. **Drive.** iPhone wakes the location task with new fixes. `shared/drive.ts` starts a drive after 2 fixes at 10 mph or more and ends it after 4 minutes under about 3 mph. A gap of 8 minutes or more closes the old drive.
3. **Phone use.** On each fix during a drive, the task reads the sensor snapshot and runs `detectPhoneUse`. An event at or above the family's phone speed makes the phone send right away. Routine points go about every 30 seconds.
4. **Alert.** The server stores the event (idempotent by event id), runs `alertFor` against the family rules, skips it if the same type was alerted for that driver in the last 60 seconds, and pushes to every parent with a push token through Expo (`priority: high`, `interruptionLevel: time-sensitive`).
5. **Tamper checks.** Each ingest compares location permission; a change away from "Always" is an alert. The 5-minute cron flags a driver with an open drive who has been quiet for 6 minutes (`signal_lost`, once), and closes drives quiet for 2 hours.
6. **Daily cleanup.** The cron run at 07:00 UTC deletes GPS points of drives that started more than 90 days ago.

## Privacy and data handling (as the code does it today)

Drivers are minors, and the app holds their location. This section states what the code does, not what we intend.

### What is collected

| Data | Where it is stored | How long |
|---|---|---|
| First name typed at sign-up (60 characters max) | `members.name` | Until the account is deleted |
| Route GPS points during drives (lat, lng, speed, heading, accuracy) | `points` | Deleted by the daily cron for drives that started more than 90 days ago (`deleteOldRoutes`, ROUTE_RETENTION_MS). The sample family is skipped. |
| Location and speed at each phone-use, speed, permission or signal-lost event | `events.lat`, `lng`, `speed_mps` | **Not covered by the 90-day rule.** Kept until the account or family is deleted. |
| Last point of each drive | `trips.last_lat`, `last_lng` | **Not covered by the 90-day rule.** Kept until deletion. |
| Driver's last known location, speed, heading | `members.last_*` | Overwritten on each ingest; kept until deletion |
| Phone-use signals: unlock times, rotation rate, call state and audio route name | Read on the phone only. Sent as events with `detail` (speed mph, handling value, call route, audio route name). | As events |
| Location permission state | `members.location_permission` | Until deletion |
| Expo push token (parents and drivers) | `members.push_token` | Until deletion or removal |
| App-use counts | `usage_events` | No time limit in code; deleted with the account or family |

The phone never sees or sends which app was opened, message content, or call content. iPhone does not expose these to a normal app ([ADR 0004](adr/0004-phone-use-what-iphone-allows.md)).

### Who can see it

- Every query is scoped by the caller's `family_id`.
- Parents see all drivers, drives, events and live locations in their family.
- Drivers see only their own live location, drives and events (`? = 'parent' OR member_id = ?` filters in `server/src/index.ts`).
- Only a driver token can send drive data, and only for trips it owns.
- The App Review sample family (`demo-` ids) is look-around only: no invites, rule or name changes, removals, passenger marks, or drive uploads.

### Where it goes outside our server

- **Cloudflare** stores the D1 database and runs the Worker. The privacy page states data is stored in the United States.
- **Expo push service and Apple Push Notifications** receive the push token and the alert text. Alert text has the driver's first name and speed (for example "Sam's phone was unlocked at 41 mph."). It does not include coordinates.
- **No third-party analytics.** App-use counts go to our own table ([ADR 0007](adr/0007-own-usage-counts-not-google.md)). The phone sends only `app_open` and `screen_view` with route patterns like `parent/trip/[id]`, never ids. The server rejects other actions and malformed screen names (`shared/usage.ts` `cleanUsage`).
- Maps on the parent phone are drawn by `react-native-maps` (Apple Maps on iPhone).

### On the phone

- Sign-in token: iPhone keychain via `expo-secure-store`, `AFTER_FIRST_UNLOCK` so background tracking can read it while the phone is locked (`src/lib/session.ts`).
- Unsent drive data: `AsyncStorage` key `drivewatch.queue.v1`, up to 12,000 points (about 3 hours of driving). Cached rules in `drivewatch.rules.v1`. Unsent usage rows in `drivewatch.usage.v1` (up to 500).
- Delete account clears the session, the queue, the usage queue, and stops tracking (`src/lib/account.ts`).

### Consent and transparency

- A driver can only join with a code from a parent.
- iOS asks the driver for location ("Always") and motion permission. Usage strings are in `app.json` `ios.infoPlist`.
- `showsBackgroundLocationIndicator` is `false`, so iOS does not show the blue location bar while tracking.

### Deletion

- `DELETE /v1/me` by a driver: deletes their points, trips, events, usage rows, invites and member row; parents get a push "deleted their DriveWatch account".
- `DELETE /v1/me` by a parent who is not the last parent: deletes that parent's own rows only.
- `DELETE /v1/me` by the last parent: deletes the whole family and all its data. Never for the sample family.
- **Parent removing a member** (`DELETE /v1/members/:id`) only signs that phone out (token replaced, push token cleared). Their trips and events stay in the family.

### Security notes

- Tokens: 32 random bytes, base64url. Only a SHA-256 hash is stored. Tokens do not expire; there is no sign-out-everywhere besides removal or deletion.
- Invite codes: 6 characters from a 32-character alphabet, one use, 7-day expiry. `APPREVIEW` is the one reusable code (sample family only).
- Sign-ups (`/v1/families`, `/v1/join`): 10 tries per minute per IP (`SIGNUP_LIMITER` rate limit binding). Skipped when the binding is missing (local).
- Ingest limits per call: 20 trips, 3,000 points, 200 events. Names capped at 60 characters, event detail at 2,000.
- No Worker secrets. `SUPPORT_EMAIL` is a plain `[vars]` value in `wrangler.toml`. `REVIEW_PHONE` is an environment variable on Doug's laptop only for `metadata:push`, kept out of git.

## Technical roadmap

### Tech debt and gaps

- **No CI.** There is no `.github/workflows`. Tests and type checks are run by hand.
- **Route tests stop at shared logic.** Worker routes are only checked by `server/scripts/smoke.sh` against a local server.
- **Swift is only compiled by EAS.** No local Mac build; Swift errors show in the cloud build.
- **Location outside the 90-day rule.** Event and trip-end coordinates and `members.last_*` are kept until deletion. Decide whether the 90-day rule should cover them (also a lawyer item).
- **Removed members keep their data** in the family. Decide if removal should delete.
- **`usage_events` has no retention limit.**
- **Tokens never expire.**
- **Deploys only from Doug's laptop.** Cloud sessions have no Cloudflare token, and workers.dev is blocked from the cloud network.
- `HANDLING_RAD_S` (1.2) is a guess until real drives.
- `.gitignore` lists `/ios` and `/android` twice (harmless).
- `LICENSE` is the Expo template's MIT license naming 650 Industries. Unknown whether that is intended for this private app.

### Planned upgrades and infra

- Phase 2 needs posted speed limits (data source: Not decided yet), hard braking from motion data, and a car Bluetooth check.
- Phase 3 needs Apple's Family Controls entitlement and a Screen Time extension.
- Android: Kotlin sensor module, Android build profile (parked branch `android-parent-later` has an APK profile for the parent side).
- Cloudflare $5 plan only if it really grows ([ADR 0003](adr/0003-cloudflare-free-plan.md)).
- Expo SDK upgrades: follow `AGENTS.md` (read the versioned docs; use `npx expo install --fix`).
