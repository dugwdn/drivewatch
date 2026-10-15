# DriveWatch test plan

Last reviewed 2026-10-01. Related: [runbook](runbook.md), [TRD](TRD.md).

## Automated checks

There is no CI. No `.github/workflows` folder exists. Everything below runs by hand.

| Check | Command | Covers |
|---|---|---|
| Server unit tests (vitest) | `cd server && npm test` (or `npm test` at the root) | `server/test/shared.test.ts`: drive start and end, walking is not a drive, unlock at 41 vs. 20 mph, mounted phone not flagged, handling cooldown, handheld call vs. Bluetooth, top speed, alert wording, family speed rule. `server/test/usage.test.ts`: usage row cleaning and caps. `server/test/rules.test.ts`: sample-family check, daily cleanup runs only at 07:00 UTC. |
| Server typecheck | `cd server && npx tsc --noEmit` | Worker and shared code |
| App typecheck | `npx tsc --noEmit` | App code |
| Lint | `npx expo lint` (per `AGENTS.md`) | App code. No ESLint config is committed yet; the first run sets one up. |
| Dependency check | `npx expo-doctor` | Expo SDK versions and config |
| End-to-end API walk-through | `cd server && npx wrangler dev --local`, then `scripts/smoke.sh` | Create family, invite, join, code reuse refused, ingest drive with an unlock at 41 mph, permission off, live, trips, events, trip detail, driver can't invite, passenger mark, privacy page, APPREVIEW joins sample family and is locked, account deletion for reviewer, driver and last parent |

Run unit tests and both typechecks before every PR. Run the smoke script after any change to `server/src/`.

## Manual checks before a release

On two real iPhones (one parent, one driver) with a TestFlight build:

1. Start a family, make a driver code, join on the driver phone, grant location "Always" and motion.
2. Parent allows notifications.
3. Take a short real drive. Drive starts on its own and shows on the parent's live map with speed.
4. Passenger (not driver) unlocks the driver phone above 25 mph: parent gets "Phone use while driving" within seconds.
5. Phone in a mount, unlocked, not touched: no handling alert.
6. Call on car Bluetooth or CarPlay: no alert. Call held to the ear above 25 mph: alert.
7. Stop for over 4 minutes: drive ends and appears in history with a route and phone-use spots.
8. Set location to "While Using": parent gets "Tracking changed".
9. Mark a drive "I was a passenger".
10. Change rules in Family and rules; check the next alert uses the new speed.
11. Android back and the on-screen Back arrow behave per the rule in `CLAUDE.md` (no Android build yet, so check iOS swipe-back and the Back arrow).
12. Join with APPREVIEW: sample family shows, and changes are refused.
13. Delete a test driver account: parent is told, drives are gone.
14. `/privacy` and `/support` load on the live Worker.
15. Battery: note idle battery use over a day (no target set yet).

## Gaps

- No CI runs the tests on PRs.
- No automated tests for Worker routes; only the manual smoke script.
- No tests for the app screens or the background task.
- Swift module has no tests and is only compiled by EAS.
- `HANDLING_RAD_S` and drive start and end timing are not tuned on real drives yet.
- No test checks that the 90-day cleanup deletes the right rows (only that it runs at 07:00 UTC).
