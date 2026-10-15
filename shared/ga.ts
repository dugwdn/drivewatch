// Anonymous screen counts for Google Analytics 4 (ADR 0010, Doug 2026-10-06: "i want analytics everywhere").
// The phone never talks to Google. The Worker forwards only `screen_view` rows (a route pattern like
// "parent/trip/[id]") to GA4's Measurement Protocol, with a random per-install id the phone makes for this alone
// (never the account, member, family or device token). No location, speed, trips, phone-use, names, child or
// parent data, no user_id, no timestamps, nothing typed. Off unless both GA4_ID and GA4_API_SECRET are set.

import type { UsageIn } from './usage';

/** A GA4 Measurement ID, or null (missing, placeholder or malformed = off). */
export function gaMeasurementId(raw: string | undefined | null): string | null {
  const id = (raw ?? '').trim().toUpperCase();
  return /^G-[A-Z0-9]{6,14}$/.test(id) && !/^G-X+$/.test(id) ? id : null;
}

/** The phone's random install id for GA: a UUID, nothing else. */
export function gaClientId(raw: unknown): string | null {
  return typeof raw === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw.toLowerCase() : null;
}

/** Screen names GA may see: the route pattern with any bracketed or id-like part as ":id". */
export function gaScreenName(route: string): string | null {
  if (!/^[a-z/[\]()_-]{1,60}$/.test(route)) return null;
  return route
    .split('/')
    .map((p) => (/^\[.*\]$/.test(p) ? ':id' : p))
    .join('/');
}

export interface GaPayload {
  client_id: string;
  non_personalized_ads: true;
  events: { name: 'screen_view'; params: { screen_name: string; engagement_time_msec: 1 } }[];
}

/** Measurement Protocol bodies (25 events each, Google's cap) for the screen views in these rows. */
export function gaPayloads(rows: UsageIn[], clientId: string): GaPayload[] {
  const events = rows
    .filter((r) => r.action === 'screen_view' && typeof r.object === 'string')
    .map((r) => gaScreenName(r.object as string))
    .filter((s): s is string => !!s)
    .map((screen_name) => ({ name: 'screen_view' as const, params: { screen_name, engagement_time_msec: 1 as const } }));
  const out: GaPayload[] = [];
  for (let i = 0; i < events.length; i += 25) {
    out.push({ client_id: clientId, non_personalized_ads: true, events: events.slice(i, i + 25) });
  }
  return out;
}

/** The web tag for the public pages, or "" when GA4_ID is empty. Page path only, no query string. */
export function gaWebTag(rawId: string | undefined | null): string {
  const id = gaMeasurementId(rawId);
  if (!id) return '';
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`
    + `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}`
    + `gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"granted"});`
    + `gtag("js",new Date());`
    + `gtag("config","${id}",{allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname});</script>`;
}
