// Background drive logging. iPhone wakes this code with new locations even
// when the app is closed, as long as location is set to "Always".
//
// Idle: coarse updates every ~100 m, just enough to notice a drive starting.
// Driving: precise updates plus motion sensing for phone use.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import DriveSensors from '../../modules/drive-sensors';
import { IDLE, speedOf, staleTrip, step, type DriveState } from '../../shared/drive';
import { detectPhoneUse, type LastFired } from '../../shared/phoneUse';
import type { EventIn, Fix, LocationPermission, PointIn } from '../../shared/types';
import { getSession } from '../lib/session';
import { cachedRules, enqueue, flush, shouldFlush } from './queue';

export const LOCATION_TASK = 'drivewatch-location';

const STATE_KEY = 'drivewatch.drive.v1';
const PERMISSION_CHECK_EVERY_MS = 10 * 60_000;

type Mode = 'idle' | 'driving';

interface Persisted {
  drive: DriveState;
  lastFired: LastFired;
  mode: Mode;
  lastPermissionCheck: number;
}

const START: Persisted = { drive: IDLE, lastFired: {}, mode: 'idle', lastPermissionCheck: 0 };

let state: Persisted | null = null;
let busy: Promise<void> = Promise.resolve();

async function loadState(): Promise<Persisted> {
  if (state) return state;
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    state = raw ? { ...START, ...(JSON.parse(raw) as Persisted) } : { ...START };
  } catch {
    state = { ...START };
  }
  return state;
}

async function saveState(): Promise<void> {
  if (state) await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function modeOptions(mode: Mode): Location.LocationTaskOptions {
  if (mode === 'driving') {
    return {
      accuracy: Location.Accuracy.BestForNavigation,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: 10,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
    };
  }
  return {
    accuracy: Location.Accuracy.Balanced,
    activityType: Location.ActivityType.AutomotiveNavigation,
    distanceInterval: 100,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
  };
}

async function setMode(mode: Mode): Promise<void> {
  const s = await loadState();
  if (s.mode === mode && (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) return;
  s.mode = mode;
  await saveState();
  await Location.startLocationUpdatesAsync(LOCATION_TASK, modeOptions(mode));
  if (mode === 'driving') DriveSensors?.startMotion();
  else DriveSensors?.stopMotion();
}

export async function permissionStatus(): Promise<LocationPermission> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.granted) return 'always';
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.granted) return 'when_in_use';
  if (fg.status === 'denied') return 'denied';
  return 'unknown';
}

/** Turn logging on. Safe to call every time the app opens. */
export async function startTracking(): Promise<boolean> {
  const session = await getSession();
  if (!session || session.role !== 'driver') return false;
  const permission = await permissionStatus();
  await enqueue({ permission });
  if (permission !== 'always') {
    void flush(true);
    return false;
  }
  const s = await loadState();
  await setMode(s.drive.tripId ? 'driving' : 'idle');
  void flush(true);
  return true;
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  DriveSensors?.stopMotion();
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

export async function currentTripId(): Promise<string | null> {
  return (await loadState()).drive.tripId;
}

function toFix(loc: Location.LocationObject): Fix {
  return {
    t: loc.timestamp,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    speedMps: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
    heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : null,
    accuracy: loc.coords.accuracy ?? null,
  };
}

function event(type: EventIn['type'], fix: Fix, tripId: string | null, speedMps: number, detail?: Record<string, unknown>): EventIn {
  return {
    id: Crypto.randomUUID(),
    tripId,
    type,
    t: fix.t,
    lat: fix.lat,
    lng: fix.lng,
    speedMps,
    detail,
  };
}

async function handleLocations(locations: Location.LocationObject[]): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== 'driver') return;
  const s = await loadState();
  const rules = await cachedRules();
  const points: PointIn[] = [];
  const events: EventIn[] = [];
  let urgent = false;

  const fixes = locations.map(toFix).sort((a, b) => a.t - b.t);

  // Phone was off or the app was killed for a long time: close the old drive.
  if (fixes.length && staleTrip(s.drive, fixes[0].t) && s.drive.tripId && s.drive.lastFix) {
    const endedAt = s.drive.lastFix.t;
    events.push(event('trip_end', s.drive.lastFix, s.drive.tripId, 0, { reason: 'gap' }));
    await enqueue({ trip: { id: s.drive.tripId, startedAt: endedAt, endedAt } });
    s.drive = { ...IDLE, lastFix: s.drive.lastFix };
  }

  for (const fix of fixes) {
    const prev = s.drive.lastFix;
    const speed = speedOf(fix, prev);
    const r = step(s.drive, fix, () => Crypto.randomUUID());
    s.drive = r.state;

    if (r.change?.kind === 'start') {
      events.push(event('trip_start', fix, r.change.tripId, speed));
      await enqueue({ trip: { id: r.change.tripId, startedAt: fix.t, endedAt: null } });
      s.lastFired = {};
      urgent = true;
    }

    const tripId = s.drive.tripId ?? (r.change?.kind === 'end' ? r.change.tripId : null);
    if (tripId) points.push({ ...fix, speedMps: fix.speedMps ?? speed, tripId });

    if (s.drive.tripId && DriveSensors) {
      const sensors = DriveSensors.getState(true);
      const found = detectPhoneUse(sensors, speed, fix.t, rules, s.lastFired);
      s.lastFired = found.lastFired;
      for (const e of found.events) {
        events.push(
          event(e.type, fix, s.drive.tripId, speed, {
            ...e.detail,
            callRoute: sensors.onCall ? sensors.callRoute : undefined,
            audioRoute: sensors.audioRouteName || undefined,
          }),
        );
        urgent = true;
      }
    }

    if (r.change?.kind === 'end') {
      events.push(event('trip_end', fix, r.change.tripId, 0));
      await enqueue({ trip: { id: r.change.tripId, startedAt: fix.t, endedAt: fix.t } });
      urgent = true;
    }
  }

  await enqueue({ points, events });

  if (Date.now() - s.lastPermissionCheck > PERMISSION_CHECK_EVERY_MS) {
    s.lastPermissionCheck = Date.now();
    await enqueue({ permission: await permissionStatus() });
  }

  const wantMode: Mode = s.drive.tripId ? 'driving' : 'idle';
  await saveState();
  if (wantMode !== s.mode) await setMode(wantMode);
  if (await shouldFlush(urgent)) await flush();
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  // One batch at a time, in order.
  busy = busy.then(() => handleLocations(data.locations)).catch(() => undefined);
  await busy;
});
