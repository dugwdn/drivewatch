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
- Analytics: our own `usage_events` table (migration 0002) is the real count. Since 2026-10-06 (ADR 0010) the Worker also forwards anonymous screen names to GA4 (Measurement Protocol, random per-install id, nothing else) and the public pages carry the GA4 tag; both off while `GA4_ID` / `GA4_API_SECRET` are empty. The phone sends only `app_open` and `screen_view` (route pattern, no ids) via `src/lib/usage.ts`; the server records family/invite/rules/passenger/trip-viewed actions itself. Rows carry no location, names, or free text. Allowed actions live in `shared/usage.ts`.

## Rules

- Every record is scoped by family; parents see their family, drivers see only their own drives.
- Phone-use and speed rules live per family (`families.phone_speed_mph`, default 25; `max_speed_mph`, default 80). The phone uses a cached copy; the server checks again before alerting.
- iPhone cannot tell a normal app which app was opened. Getting app names needs Apple's Family Controls entitlement (phase 3).
- The driver is never asked to tap anything while the car is moving.
- Stay on free tiers (Cloudflare free, Expo free). The Apple Developer account is Doug's ($99/yr).

## Docs rule (Doug, 2026-10-01, standing)
This project keeps the docs a real company would. Update the matching doc in the same PR as any change it describes. Never rewrite an accepted decision record; add a new one that supersedes it.

| Doc | Where |
|---|---|
| PRD (product requirements) | `docs/PRD.md` |
| Product roadmap | `docs/roadmap.md` |
| TRD (technical design + technical roadmap) | `docs/TRD.md` (includes privacy and data handling) |
| Decision records (ADRs) | `docs/adr/` (index: `docs/adr/README.md`) |
| README / how-to | `README.md` |
| Changelog | `CHANGELOG.md` |
| Runbook | `docs/runbook.md` |
| Test plan | `docs/test-plan.md` |

## Phone back button (standing rule, Doug 2026-10-01)

Phone back button stays in the app: every in-app screen, step, or modal is something the phone's back control steps out of, instead of closing the app.

- Android back button/gesture steps back one screen or closes the open modal/dialog, and leaves the app only from a home screen (welcome's first step, driver home, parent home). Never trap the user there.
- New screens are Expo Router `Stack` screens: the stack handles Android back and iOS swipe-back (keep `gestureEnabled` on). In-screen steps, panels, and sheets use `useBackClose(open, onClose)`. RN `<Modal>` uses `onRequestClose`. `Alert.alert` gets `{ cancelable: true }`.
- Every non-home screen shows a visible Back arrow top-left (44pt, accessibilityLabel "Back"): the native header back on stack screens, `BackButton` as `headerLeft` for in-screen steps. Non-home stack screens render `<BackToHomeIfFirst home="/parent" />` so a screen opened from a drivewatch:// link still has Back, and back goes home first instead of closing the app.
- Leaving signed-in screens (sign out, delete account) uses `startOver('/welcome')` so back can't return to them.
- Web: there is no web build (react-native-web isn't installed). If one is added, every screen/modal must push a browser history entry, a deep link's back goes home first, back from home leaves normally, no beforeunload prompts.
- Helpers: `src/lib/useBackClose.ts`, `src/lib/BackButton.tsx` (`BackButton`, `BackToHomeIfFirst`, `startOver`).

## Commands

- App typecheck: `npx tsc --noEmit`
- Server: `cd server && npm test` (shared logic tests), `npx tsc --noEmit`, `npx wrangler dev --local` then `scripts/smoke.sh` for an end-to-end check.
- iPhone build to TestFlight: `npm run build:ios` (needs an Expo login; builds in the cloud, no Mac needed).

## Current state

- Phase 1 code written (PR "Phase 1: drive tracking and phone-use alerts"). Server tested locally end to end. The iPhone build has not been compiled yet (no Mac here; first EAS build will show any Swift errors).
- Server live (2026-09-29): Worker `drivewatch-api` at https://drivewatch-api.noisy-sunset-3f0d.workers.dev, D1 `drivewatch` with migration 0001 applied. Deployed from Doug's laptop with `npx wrangler deploy` (no Cloudflare token in cloud sessions; workers.dev is blocked by the cloud network policy, so check it with a web fetch).
- App-use counts (analytics) live 2026-09-29: migration 0002 applied to the live database and Worker redeployed from Doug's laptop. No screen shows the counts yet. If wrangler on the laptop says code 7403 on a D1 command, `npx wrangler logout` then `npx wrangler login` fixes it.
- First EAS iOS build compiled and reached TestFlight (2026-09-29).
- App Store submission prepared (2026-09-29): Worker serves /privacy, /support, and a home page (`server/src/pages.ts`; support email in wrangler.toml [vars]). "Delete my account" in the app (`DELETE /v1/me`; the last parent deleting erases the whole family). Migration 0003 adds a made-up "Sample Family" for App Review with the reusable parent code APPREVIEW (members with ids starting `demo-` can't be removed). Listing lives in `store.config.js` (needs `$env:REVIEW_PHONE` when pushing) with screenshots in `store/apple/screenshot/` made from `store/source/`. Steps for Doug: /mnt/project-files/DriveWatch/app-store-steps.md.
- Next: Doug applies 0003 + deploys, builds, runs `npx eas-cli@latest metadata:push`, then App Privacy, price, build, and Add for Review in App Store Connect.
- Review fixes (2026-10-01, Doug approved): the sample family is look-around only (no invites, rule or name changes, removals, passenger marks, or drive uploads; a reviewer deleting their account never erases it). Sign-ups (`/v1/families`, `/v1/join`) are limited to 10 tries per minute per address with the free Workers rate limit binding `SIGNUP_LIMITER` (wrangler.toml). GPS points from drives older than 90 days are deleted once a day on the 07:00 UTC cron run (`deleteOldRoutes`); trips and alerts stay; privacy page says so. Goes live with the next laptop `npx wrangler deploy` (no new iPhone build).
- Phone back button rule (2026-10-01): Android back steps back inside the app, Back arrow on every non-home screen; see the section above.
- GA4 (2026-10-06, ADR 0010): property "DriveWatch" (G-6YN2K1TQ0Z, GA account Web Design Nerd) set in wrangler.toml 2026-10-06; web tag goes live with the next laptop `npx wrangler deploy`. App screen counts stay off until Doug adds the `GA4_API_SECRET` secret in Cloudflare (Workers & Pages > drivewatch-api > Settings > Variables and Secrets). Originally: `GA4_ID` in `server/wrangler.toml` [vars] and `npx wrangler secret put GA4_API_SECRET`. Web tag on /, /privacy, /support; app screen names forwarded by the Worker (`shared/ga.ts`). Before shipping the app build: App Store privacy label adds Analytics: Product Interaction, not linked, not tracking.
- Decisions and why: `docs/adr/`.

## Plan

1. Go live: first TestFlight build, then a real test drive.
2. Real-drive tuning: handling threshold (`shared/phoneUse.ts` HANDLING_RAD_S), drive start/end timing, battery use when idle.
3. Phase 2: speed vs. posted limit, hard braking, car Bluetooth check, weekly summary.
4. Phase 3: Apple Family Controls entitlement for app names.
5. Later: Android, payments, parent website, move Apple account to the company.

Before launch (lawyer items, not blocking): terms and privacy policy for other families (must mention the app-use counts), minors' location data rules, confirm the 90-day route rule.
