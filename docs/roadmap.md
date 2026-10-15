# DriveWatch: product roadmap

Last reviewed 2026-10-01. Source: the Plan and Current state sections of `CLAUDE.md`. The full build plan Doug approved lives in the project files (Kids-Driving/build-plan-2026-09-29.md), not in this repo. Dates are not set unless shown.

## Now

- **Go live on iPhone.** First EAS build reached TestFlight on 2026-09-29. Next: a real test drive.
- **App Store submission.** Doug applies migration 0003 and deploys the Worker, builds, runs `npx eas-cli@latest metadata:push`, then fills App Privacy and price in App Store Connect and adds the build for review.
- **Review fixes from 2026-10-01** (sample family lock, sign-up rate limit, 90-day route deletion) go live with the next `npx wrangler deploy` from Doug's laptop.
- **Merge PR #1** (`phase-1-core` into `main`).

## Next

- **Real-drive tuning:** handling threshold (`shared/phoneUse.ts` `HANDLING_RAD_S`), drive start and end timing, battery use when idle.
- **Phase 2:** speed vs. posted limit, hard braking, car Bluetooth check, weekly summary. ADR 0004 also lists an "I was a passenger" mark the parent can see (the mark exists today).
- **Show app-use counts** somewhere (no screen shows them yet).

## Later

- **Phase 3:** Apple Family Controls (Screen Time) entitlement so alerts can name the app. Needs Apple's approval and the teen in Family Sharing as a child.
- **Android.** The parent side is parked on branch `android-parent-later`. Driver side on Android is not started (sensor module is a stub).
- Payments.
- Parent website.
- Move the Apple Developer account to the company.
- Rename the App Store listing from "DriveWatch (d5baeb)" (Doug's idea: "DriveWatch Family").

## Before other families join (lawyer items, not blocking family use)

- Terms and privacy policy for other families (must mention the app-use counts).
- Minors' location data rules.
- Confirm the 90-day route rule.
