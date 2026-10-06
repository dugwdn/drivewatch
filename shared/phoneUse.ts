// Turns raw phone signals (unlocks, handling, calls) plus the car's speed
// into driving events. Runs on the phone every time a location fix arrives.

import type { EventType, FamilyRules } from './types';
import { mph } from './types';

export interface SensorSnapshot {
  /** Phone is unlocked right now. */
  unlocked: boolean;
  /** Times (ms) the phone was unlocked since the last snapshot. */
  unlockTimes: number[];
  /** Biggest rotation in the last few seconds, radians per second. A mounted phone stays low. */
  handling: number;
  onCall: boolean;
  /** Where call audio goes: 'receiver' means held to the ear. */
  callRoute: string;
}

/** Rotation above this, with the phone unlocked, means it is in a hand. Tuned on real drives later. */
export const HANDLING_RAD_S = 1.2;
/** An unlock this close to a fast fix counts as unlocking while driving. */
export const UNLOCK_MATCH_MS = 15_000;

export const COOLDOWN_MS: Record<string, number> = {
  phone_unlocked: 60_000,
  phone_handling: 120_000,
  handheld_call: 5 * 60_000,
  over_speed: 5 * 60_000,
};

export type LastFired = Partial<Record<EventType, number>>;

export interface Detected {
  type: EventType;
  detail: Record<string, unknown>;
}

export function detectPhoneUse(
  sensors: SensorSnapshot,
  speedMps: number,
  now: number,
  rules: FamilyRules,
  lastFired: LastFired,
): { events: Detected[]; lastFired: LastFired } {
  const events: Detected[] = [];
  const fired: LastFired = { ...lastFired };
  const speed = mph(speedMps);

  const ready = (type: EventType) => {
    const last = fired[type];
    return last == null || now - last >= (COOLDOWN_MS[type] ?? 0);
  };
  const fire = (type: EventType, detail: Record<string, unknown>) => {
    events.push({ type, detail });
    fired[type] = now;
  };

  if (speed >= rules.phoneSpeedMph) {
    const recentUnlock = sensors.unlockTimes.some((t) => now - t <= UNLOCK_MATCH_MS);
    if (recentUnlock && ready('phone_unlocked')) {
      fire('phone_unlocked', { speedMph: Math.round(speed) });
    }

    const justUnlocked =
      fired.phone_unlocked != null && now - fired.phone_unlocked < COOLDOWN_MS.phone_unlocked;
    if (
      sensors.unlocked &&
      sensors.handling >= HANDLING_RAD_S &&
      !justUnlocked &&
      ready('phone_handling')
    ) {
      fire('phone_handling', { speedMph: Math.round(speed), handling: round2(sensors.handling) });
    }

    if (sensors.onCall && sensors.callRoute === 'receiver' && ready('handheld_call')) {
      fire('handheld_call', { speedMph: Math.round(speed) });
    }
  }

  if (speed >= rules.maxSpeedMph && ready('over_speed')) {
    fire('over_speed', { speedMph: Math.round(speed) });
  }

  return { events, lastFired: fired };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
