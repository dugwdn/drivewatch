import { describe, expect, it } from 'vitest';
import { alertFor } from '../../shared/alerts';
import { END_AFTER_MS, IDLE, step, type DriveState } from '../../shared/drive';
import { detectPhoneUse, type SensorSnapshot } from '../../shared/phoneUse';
import { DEFAULT_RULES, type Fix } from '../../shared/types';

const MPH = 0.44704; // m/s per mph

function fix(t: number, speedMph: number, lat = 41.1, lng = -81.4): Fix {
  return { t, lat, lng, speedMps: speedMph * MPH, heading: 0, accuracy: 5 };
}

describe('drive detection', () => {
  it('starts after two fast fixes and ends after a long stop', () => {
    let s: DriveState = IDLE;
    let id = 0;
    const next = () => `trip-${++id}`;
    let r = step(s, fix(1000, 5), next);
    expect(r.change).toBeNull();
    r = step(r.state, fix(2000, 20), next);
    expect(r.change).toBeNull();
    r = step(r.state, fix(3000, 25), next);
    expect(r.change).toEqual(expect.objectContaining({ kind: 'start', tripId: 'trip-1' }));
    // Red light: short stop keeps the drive going.
    r = step(r.state, fix(60_000, 0), next);
    expect(r.change).toBeNull();
    r = step(r.state, fix(90_000, 30), next);
    expect(r.state.tripId).toBe('trip-1');
    // Parked long enough.
    r = step(r.state, fix(90_000 + END_AFTER_MS, 0), next);
    expect(r.change).toEqual(expect.objectContaining({ kind: 'end', tripId: 'trip-1' }));
    expect(r.state.tripId).toBeNull();
  });

  it('does not start a drive while walking', () => {
    let s: DriveState = IDLE;
    for (let t = 0; t < 20; t++) s = step(s, fix(t * 1000, 3), () => 'x').state;
    expect(s.tripId).toBeNull();
  });
});

const quiet: SensorSnapshot = { unlocked: false, unlockTimes: [], handling: 0, onCall: false, callRoute: 'none' };

describe('phone use over 25 mph', () => {
  it('flags an unlock at 41 mph', () => {
    const r = detectPhoneUse({ ...quiet, unlocked: true, unlockTimes: [9_000] }, 41 * MPH, 10_000, DEFAULT_RULES, {});
    expect(r.events.map((e) => e.type)).toEqual(['phone_unlocked']);
  });

  it('ignores an unlock at 20 mph', () => {
    const r = detectPhoneUse({ ...quiet, unlocked: true, unlockTimes: [9_000] }, 20 * MPH, 10_000, DEFAULT_RULES, {});
    expect(r.events).toEqual([]);
  });

  it('ignores a phone left unlocked in a mount (no handling)', () => {
    const r = detectPhoneUse({ ...quiet, unlocked: true, handling: 0.2 }, 45 * MPH, 10_000, DEFAULT_RULES, {});
    expect(r.events).toEqual([]);
  });

  it('flags an unlocked phone being handled, once per cooldown', () => {
    const snap = { ...quiet, unlocked: true, handling: 2 };
    const a = detectPhoneUse(snap, 45 * MPH, 100_000, DEFAULT_RULES, {});
    expect(a.events.map((e) => e.type)).toEqual(['phone_handling']);
    const b = detectPhoneUse(snap, 45 * MPH, 130_000, DEFAULT_RULES, a.lastFired);
    expect(b.events).toEqual([]);
    const c = detectPhoneUse(snap, 45 * MPH, 230_000, DEFAULT_RULES, a.lastFired);
    expect(c.events.map((e) => e.type)).toEqual(['phone_handling']);
  });

  it('flags a call held to the ear but not one on car Bluetooth', () => {
    const ear = detectPhoneUse({ ...quiet, onCall: true, callRoute: 'receiver' }, 40 * MPH, 1, DEFAULT_RULES, {});
    expect(ear.events.map((e) => e.type)).toEqual(['handheld_call']);
    const car = detectPhoneUse({ ...quiet, onCall: true, callRoute: 'bluetooth' }, 40 * MPH, 1, DEFAULT_RULES, {});
    expect(car.events).toEqual([]);
  });

  it('flags top speed', () => {
    const r = detectPhoneUse(quiet, 85 * MPH, 1, DEFAULT_RULES, {});
    expect(r.events.map((e) => e.type)).toEqual(['over_speed']);
  });
});

describe('alert wording', () => {
  it('writes a plain alert', () => {
    expect(alertFor({ type: 'phone_unlocked', speedMps: 41 * MPH }, DEFAULT_RULES, 'Sam')).toEqual({
      title: 'Phone use while driving',
      body: "Sam's phone was unlocked at 41 mph.",
    });
  });

  it('respects the family speed rule on the server too', () => {
    expect(alertFor({ type: 'phone_unlocked', speedMps: 20 * MPH }, DEFAULT_RULES, 'Sam')).toBeNull();
    expect(alertFor({ type: 'phone_unlocked', speedMps: 20 * MPH }, { ...DEFAULT_RULES, phoneSpeedMph: 15 }, 'Sam')).not.toBeNull();
  });

  it('does not alert for trip start and end', () => {
    expect(alertFor({ type: 'trip_start', speedMps: 10 }, DEFAULT_RULES, 'Sam')).toBeNull();
  });
});
