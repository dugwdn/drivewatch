// Holds drive data on the phone until the server confirms it has it, so a
// dead zone or a closed app never loses a drive.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventIn, FamilyRules, LocationPermission, PointIn, TripIn } from '../../shared/types';
import { DEFAULT_RULES } from '../../shared/types';
import { api } from '../lib/api';
import { getSession } from '../lib/session';

const KEY = 'drivewatch.queue.v1';
const RULES_KEY = 'drivewatch.rules.v1';
/** Keep at most this many unsent points (about 3 hours of driving). */
const MAX_POINTS = 12_000;
const SEND_BATCH = 2_500;
/** Send routine location this often while driving. Phone-use events go right away. */
export const FLUSH_EVERY_MS = 30_000;

interface Queue {
  trips: Record<string, TripIn>;
  points: PointIn[];
  events: EventIn[];
  permission: LocationPermission;
  lastFlushAt: number;
}

const EMPTY: Queue = { trips: {}, points: [], events: [], permission: 'unknown', lastFlushAt: 0 };

let memory: Queue | null = null;
let flushing: Promise<void> | null = null;

async function load(): Promise<Queue> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    memory = raw ? { ...EMPTY, ...(JSON.parse(raw) as Queue) } : { ...EMPTY };
  } catch {
    memory = { ...EMPTY };
  }
  return memory;
}

async function save(): Promise<void> {
  if (memory) await AsyncStorage.setItem(KEY, JSON.stringify(memory));
}

export async function enqueue(add: {
  trip?: TripIn;
  points?: PointIn[];
  events?: EventIn[];
  permission?: LocationPermission;
}): Promise<void> {
  const q = await load();
  if (add.trip) {
    const had = q.trips[add.trip.id];
    q.trips[add.trip.id] = had
      ? { id: had.id, startedAt: Math.min(had.startedAt, add.trip.startedAt), endedAt: add.trip.endedAt ?? had.endedAt }
      : add.trip;
  }
  if (add.points?.length) {
    q.points.push(...add.points);
    if (q.points.length > MAX_POINTS) q.points.splice(0, q.points.length - MAX_POINTS);
  }
  if (add.events?.length) q.events.push(...add.events);
  if (add.permission) q.permission = add.permission;
  await save();
}

export async function pending(): Promise<{ points: number; events: number }> {
  const q = await load();
  return { points: q.points.length, events: q.events.length };
}

export async function flush(force = false): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const q = await load();
    const now = Date.now();
    const hasWork = q.points.length || q.events.length || Object.keys(q.trips).length;
    if (!force && !hasWork && now - q.lastFlushAt < 15 * 60_000) return;
    const session = await getSession();
    if (!session || session.role !== 'driver') return;

    const points = q.points.slice(0, SEND_BATCH);
    const events = q.events.slice(0, 200);
    const tripIds = Object.keys(q.trips);
    const trips = tripIds.map((id) => q.trips[id]);
    try {
      const res = await api.ingest(
        { status: { permission: q.permission, sentAt: now }, trips, points, events },
        session.token,
      );
      await AsyncStorage.setItem(RULES_KEY, JSON.stringify(res.rules));
      // Drop only what was sent; more may have arrived meanwhile.
      q.points.splice(0, points.length);
      q.events.splice(0, events.length);
      for (const id of tripIds) {
        // Keep an open trip until its end has been sent.
        if (q.trips[id] === trips[tripIds.indexOf(id)] && q.trips[id].endedAt != null) delete q.trips[id];
      }
      q.lastFlushAt = now;
      await save();
    } catch {
      // Offline or server trouble: keep everything and try on the next fix.
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function shouldFlush(urgent: boolean): Promise<boolean> {
  const q = await load();
  return urgent || Date.now() - q.lastFlushAt >= FLUSH_EVERY_MS;
}

export async function cachedRules(): Promise<FamilyRules> {
  try {
    const raw = await AsyncStorage.getItem(RULES_KEY);
    return raw ? { ...DEFAULT_RULES, ...(JSON.parse(raw) as FamilyRules) } : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}
