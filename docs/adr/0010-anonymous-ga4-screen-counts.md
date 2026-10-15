# 0010: Anonymous GA4 screen counts, sent by our server

- **Status:** Accepted, 2026-10-06 (Doug: "i want analytics everywhere"). Changes part of [0007](0007-own-usage-counts-not-google.md).

## Context
0007 kept all app-use counts in our own database and nothing at Google, because drivers are minors and the app holds
location. Doug now wants Google Analytics on every project. The risk 0007 named is what would reach Google, so this
keeps that list as short as it can be.

## Decision
- **Public web pages** (`/`, `/privacy`, `/support` on `drivewatch-api`): GA4 web tag when `GA4_ID` (wrangler.toml
  `[vars]`) holds a Measurement ID. Empty = no tag, no request to Google. Page views only; consent defaults deny ad
  storage, ad user data and ad personalization; Google signals and ad personalization off; `page_location` is origin
  + path (no query string).
- **App**: the phone still never talks to Google and no Google SDK is added. When the phone posts its usage rows to
  `/v1/usage`, the Worker forwards only the `screen_view` rows to the GA4 Measurement Protocol (`shared/ga.ts`,
  `sendScreensToGa` in `server/src/index.ts`) after the response. Each event is `screen_view` with `screen_name` (the
  route pattern, brackets as `:id`, e.g. `parent/trip/:id`) and nothing else. `client_id` is a random UUID the phone
  makes for this alone (`drivewatch.ga-install.v1`, cleared with the account); it is not the member, family or device
  token, is never stored on the server, and no `user_id` is sent. No location, speed, trips, phone-use, alerts,
  names, roles, child or parent data, timestamps, or app opens.
- Off unless `GA4_ID` and the secret `GA4_API_SECRET` are both set, and the phone sends an install id (app builds
  from before this change don't, so they send nothing to Google).
- Our own `usage_events` table stays the real count (0007).

## Consequences
- App Store privacy label changes before the build that sends the install id ships: **Analytics: Product
  Interaction, not linked to the user, not used for tracking.**
- The privacy page names Google Analytics and what it never gets. A lawyer still reads it before other families.
- Region in GA4 for app screens is blank or Cloudflare's, not the phone's: the Worker sends the request, not the phone.
