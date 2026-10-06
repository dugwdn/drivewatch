# 0007: App-use counts in our own database, not Google

- **Status:** Accepted, 2026-09-29 (live 2026-09-29: migration 0002 applied and Worker redeployed from Doug's laptop)
- Backfilled 2026-10-01 from commit "Count app use in our own database instead of Google" and `CLAUDE.md`.

## Context
We want to know which parts of the app get used. Drivers are minors and the app holds their location, so sending anything to an outside analytics service is a risk we don't need.

## Decision
- Keep app-use counts in our own D1 table, `usage_events` (`server/migrations/0002_usage.sql`). No Google Analytics or other outside analytics.
- The phone sends only `app_open` and `screen_view`. A screen is a route pattern like `parent/trip/[id]`, never an id (`src/lib/usage.ts`).
- The server records family, invite, rule, passenger, member-removed and trip-viewed actions itself when the request succeeds.
- Rows hold no location, names, or free text. Allowed actions live in `shared/usage.ts`; `cleanUsage` drops anything else.

## Consequences
No screen shows the counts yet. The privacy policy must mention them (it does, on `/privacy`). Rows are deleted with the account or family; there is no other time limit.
