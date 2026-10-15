// App use counts ("analytics") kept in our own database instead of Google,
// because drivers are minors and the app holds location. Rows say who did
// what, never where: no coordinates, no names, no free text.

export type UsageAction =
  // sent by the phone
  | 'app_open' // app came to the front
  | 'screen_view' // object = screen route, e.g. "parent/trip/[id]"
  // recorded by the server when the matching request succeeds
  | 'family_created'
  | 'member_joined' // object = role
  | 'invite_created' // object = role
  | 'rules_changed' // object = rule name
  | 'member_removed'
  | 'passenger_marked' // object = "on" or "off"
  | 'trip_viewed';

/** Actions the phone may send. Everything else is recorded by the server. */
export const PHONE_ACTIONS: readonly UsageAction[] = ['app_open', 'screen_view'];

export interface UsageIn {
  id: string; // made on the phone so a resend is not counted twice
  action: UsageAction;
  object?: string | null;
  t: number;
}

export const MAX_USAGE_PER_CALL = 100;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AHEAD_MS = 5 * 60 * 1000;

/** Keeps only well-formed rows from the phone. Screen names are route
 *  patterns, so ids never land in the object column. */
export function cleanUsage(raw: unknown, now: number): UsageIn[] {
  if (!Array.isArray(raw)) return [];
  const out: UsageIn[] = [];
  for (const r of raw.slice(0, MAX_USAGE_PER_CALL)) {
    if (!r || typeof r !== 'object') continue;
    const { id, action, object, t } = r as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) continue;
    if (typeof action !== 'string' || !PHONE_ACTIONS.includes(action as UsageAction)) continue;
    if (typeof t !== 'number' || t < now - MAX_AGE_MS || t > now + MAX_AHEAD_MS) continue;
    let obj: string | null = null;
    if (action === 'screen_view') {
      if (typeof object !== 'string' || !/^[a-z/[\]()_-]{1,60}$/.test(object)) continue;
      obj = object;
    }
    out.push({ id, action: action as UsageAction, object: obj, t: Math.round(t) });
  }
  return out;
}
