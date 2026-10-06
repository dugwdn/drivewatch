# 0008: Delete drive routes (GPS points) after 90 days

- **Status:** Accepted, 2026-10-01 (Doug approved the App Review fixes). Live with the next `npx wrangler deploy` from Doug's laptop.
- Backfilled 2026-10-01 from PR #4 and `CLAUDE.md`.

## Context
A minor's detailed location history is the most sensitive thing DriveWatch keeps. Parents need recent drives, not years of routes.

## Decision
- Once a day, on the 07:00 UTC cron run, the Worker deletes GPS points (`points`) of drives that started more than 90 days ago (`deleteOldRoutes`, `ROUTE_RETENTION_MS` in `server/src/index.ts`).
- Trip summaries and alerts stay. The sample family is skipped.
- The privacy page says so.

## Consequences
Old drives show no route map. Event coordinates, the last point of each trip, and the driver's last known location are not covered by this rule (see the TRD). "Confirm the 90-day route rule" is still on the lawyer list before other families join.
