# 0003: Server on Cloudflare Workers + D1, free plan

- **Status:** Accepted and live, 2026-09-29. Worker `drivewatch-api` (workers.dev), D1 `drivewatch`, migration 0001 applied. Deployed by Doug from his laptop.

## Decision
- A Cloudflare Worker with a D1 database, same pattern as Finutri. Expo's free push service sends alerts.
- While driving, the app sends location in small batches (about every 30 seconds) and keeps anything unsent on the phone until the server confirms it (`src/tracking/queue.ts`).
- A cron every 5 minutes flags a phone that goes quiet mid-drive.

## Why
$0 a month at family size, with room for a dozen families. Cloudflare's $5 plan only if it really grows.

## Consequences
Cloud sessions have no Cloudflare token, so deploys run from Doug's laptop (`npx wrangler deploy` in `server/`).
