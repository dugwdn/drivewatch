// Decides when a drive starts and ends from a stream of location fixes.
// Pure logic: the phone feeds fixes in, gets back what changed.

import type { Fix } from './types';

/** 10 mph. Walking and biking stay under this. */
export const START_SPEED_MPS = 4.5;
/** Need this many fast fixes in a row before calling it a drive. */
export const START_FIXES = 2;
/** Under about 3 mph counts as stopped. */
export const STOPPED_SPEED_MPS = 1.4;
/** Stopped this long ends the drive. Long enough for red lights and drive-throughs. */
export const END_AFTER_MS = 4 * 60 * 1000;

export interface DriveState {
  tripId: string | null;
  fastFixes: number;
  lastMovingAt: number | null;
  lastFix: Fix | null;
}

export const IDLE: DriveState = { tripId: null, fastFixes: 0, lastMovingAt: null, lastFix: null };

export type DriveChange =
  | { kind: 'start'; tripId: string; at: Fix }
  | { kind: 'end'; tripId: string; at: Fix }
  | null;

/** Speed from the phone, or worked out from the last fix if the phone gave none. */
export function speedOf(fix: Fix, prev: Fix | null): number {
  if (fix.speedMps != null && fix.speedMps >= 0) return fix.speedMps;
  if (!prev) return 0;
  const dt = (fix.t - prev.t) / 1000;
  if (dt <= 0 || dt > 120) return 0;
  return distanceM(prev.lat, prev.lng, fix.lat, fix.lng) / dt;
}

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function step(
  state: DriveState,
  fix: Fix,
  newTripId: () => string,
): { state: DriveState; change: DriveChange } {
  // Ignore fixes that arrive out of order.
  if (state.lastFix && fix.t <= state.lastFix.t) return { state, change: null };

  const speed = speedOf(fix, state.lastFix);
  const moving = speed >= STOPPED_SPEED_MPS;

  if (!state.tripId) {
    const fastFixes = speed >= START_SPEED_MPS ? state.fastFixes + 1 : 0;
    if (fastFixes >= START_FIXES) {
      const tripId = newTripId();
      return {
        state: { tripId, fastFixes: 0, lastMovingAt: fix.t, lastFix: fix },
        change: { kind: 'start', tripId, at: fix },
      };
    }
    return { state: { ...state, fastFixes, lastFix: fix }, change: null };
  }

  const lastMovingAt = moving ? fix.t : state.lastMovingAt ?? fix.t;
  if (fix.t - lastMovingAt >= END_AFTER_MS) {
    return { state: { ...IDLE, lastFix: fix }, change: { kind: 'end', tripId: state.tripId, at: fix } };
  }
  return { state: { ...state, lastMovingAt, lastFix: fix }, change: null };
}

/**
 * If the phone has been silent too long (killed, no signal), the drive is over.
 * Called when a new fix arrives after a gap.
 */
export function staleTrip(state: DriveState, now: number): boolean {
  return !!state.tripId && state.lastMovingAt != null && now - state.lastMovingAt >= END_AFTER_MS * 2;
}
