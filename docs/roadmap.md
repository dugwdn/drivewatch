# DriveWatch: product roadmap

Last reviewed 2026-10-06. Source: the Plan and Current state sections of `CLAUDE.md`. The full build plan Doug approved lives in the project files (Kids-Driving/build-plan-2026-09-29.md), not in this repo. Dates are not set unless shown.

## Now

- **App Store submission, waiting on Doug (status 2026-10-06).** Done from Doug's laptop on 2026-10-05: migration 0003 applied to the live database, Worker redeployed with the review fixes (sample family lock, sign-up limit, 90-day route deletion; `/privacy` and `/support` checked), iOS 1.0.0 build 4 uploaded to App Store Connect, listing pushed with `metadata:push`. Still open, and only Doug can do it in App Store Connect: App Privacy answers, price and availability, content rights, attach build 4, Add for Review, Submit. The config fixes that made auto-submit and the listing push work are in draft PR #7 (not merged).
- **Real test drive** with the TestFlight build (first reached TestFlight 2026-09-29).
- **Merge PR #1** (`phase-1-core` into `main`). `main` is still the empty Expo starter; all the real app is on `phase-1-core`, and PRs #5 and #7 stack on it. Then PR #7 (App Store settings) and PR #6 (QUICK-EDITS.md, against `main`).

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
