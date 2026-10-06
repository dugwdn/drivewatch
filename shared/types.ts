// Shapes shared by the phone app and the server. Keep this file free of
// React Native and Cloudflare imports so both sides can use it.

export type Role = 'parent' | 'driver';

export type EventType =
  | 'trip_start'
  | 'trip_end'
  | 'phone_unlocked' // phone was unlocked while the car was moving
  | 'phone_handling' // unlocked phone was being moved around in a hand
  | 'handheld_call' // on a call with audio at the ear, not Bluetooth
  | 'over_speed' // above the family's top-speed rule
  | 'permission_changed' // location permission is no longer "Always"
  | 'signal_lost'; // phone stopped reporting in the middle of a drive

export interface FamilyRules {
  /** Phone use counts only at or above this speed. Doug's rule: 25. */
  phoneSpeedMph: number;
  /** Alert when the car reaches this speed. */
  maxSpeedMph: number;
}

export const DEFAULT_RULES: FamilyRules = { phoneSpeedMph: 25, maxSpeedMph: 80 };

export interface Fix {
  t: number; // ms since epoch
  lat: number;
  lng: number;
  speedMps: number | null; // null when the phone could not measure speed
  heading: number | null;
  accuracy: number | null;
}

export interface PointIn extends Fix {
  tripId: string;
}

export interface EventIn {
  id: string; // made on the phone so a retry never creates a duplicate
  tripId: string | null;
  type: EventType;
  t: number;
  lat: number | null;
  lng: number | null;
  speedMps: number | null;
  detail?: Record<string, unknown>;
}

export interface TripIn {
  id: string;
  startedAt: number;
  endedAt: number | null;
}

export type LocationPermission = 'always' | 'when_in_use' | 'denied' | 'unknown';

export interface IngestBody {
  status: { permission: LocationPermission; sentAt: number };
  trips: TripIn[];
  points: PointIn[];
  events: EventIn[];
}

export const MPS_TO_MPH = 2.236936;

export function mph(speedMps: number | null | undefined): number {
  if (speedMps == null || speedMps < 0) return 0;
  return speedMps * MPS_TO_MPH;
}
