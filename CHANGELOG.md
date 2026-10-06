# Changelog

Newest first. Dates are when the change landed on `phase-1-core` (UTC). PR numbers are GitHub pull requests in dugwdn/drivewatch.

## Unreleased

- Google Analytics 4, off until Doug sets the ID: the public pages (home, privacy, support) get the GA4 tag, and the server passes on anonymous app screen counts (screen name only, a random per-install id, nothing about drives, location or the family). Privacy page updated. ADR 0010.

## 2026-10-01

- Docs: added PRD, roadmap, TRD (with privacy and data handling), runbook, test plan, this changelog, README, and ADRs 0007 to 0009. Docs rule added to `CLAUDE.md`.
- The App Review "Sample Family" is look-around only: no invites, rule or name changes, removals, passenger marks, or drive uploads. A reviewer deleting their account never erases it. (#4)
- Sign-ups (new family or join code) limited to 10 tries per minute per network address. (#4)
- Drive routes (GPS points) older than 90 days are deleted once a day. Trips and alerts stay. Privacy page updated. (#4)
- Phone back button stays in the app: Android back steps back one screen, and every non-home screen has a Back arrow. (#3)

## 2026-09-30

- Decision records 0001 to 0006 and the build state notes merged. (#2)

## 2026-09-29

- Ready for the App Store: privacy and support pages served by the Worker, "Delete my account" in the app, a sample family for App Review (code APPREVIEW), and the store listing with screenshots.
- App-use counts kept in our own database (`usage_events`) instead of Google. Live the same day.
- Decision records added (`docs/adr/`).
- Pinned react-dom, worklets, and reanimated to SDK 57 versions.
- App and server pointed at the live DriveWatch Worker and D1 database.
- Phase 1: drive tracking and phone-use alerts. Families and invite codes, background drive logging, unlock, handling and handheld-call alerts over 25 mph, high-speed alerts, tracking-off and quiet-phone alerts, live map, drive history, passenger mark.
- First EAS iOS build reached TestFlight.
- Expo project linked; app name DriveWatch and bundle id set.
- Initial commit (Expo starter).
