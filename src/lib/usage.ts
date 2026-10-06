// App use counts, sent to our own server. Only two things are counted on the
// phone: the app opening and which screen was shown. Screen names are route
// patterns like "parent/trip/[id]", never ids or places. The server passes the
// screen names on to Google Analytics as anonymous counts (ADR 0010), with a
// random id made on this install for that alone (never the account or token).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { UsageIn } from '../../shared/usage';
import { api, ApiError } from './api';
import { getSession } from './session';

const KEY = 'drivewatch.usage.v1';
const GA_KEY = 'drivewatch.ga-install.v1';
const MAX_KEPT = 500;
const SEND_EVERY_MS = 60_000;

let queue: UsageIn[] | null = null;
let lastSent = 0;
let sending: Promise<void> | null = null;

async function load(): Promise<UsageIn[]> {
  if (queue) return queue;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    queue = raw ? (JSON.parse(raw) as UsageIn[]) : [];
  } catch {
    queue = [];
  }
  return queue;
}

async function save(): Promise<void> {
  try {
    if (queue) await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Counting use is never worth an error on screen.
  }
}

let gaId: string | null = null;
/** A random id for this install, only for anonymous GA counts. Not linked to the account. */
async function gaInstallId(): Promise<string | undefined> {
  if (gaId) return gaId;
  try {
    gaId = await AsyncStorage.getItem(GA_KEY);
    if (!gaId) {
      gaId = Crypto.randomUUID();
      await AsyncStorage.setItem(GA_KEY, gaId);
    }
    return gaId;
  } catch {
    return undefined;
  }
}

export async function trackUsage(action: 'app_open' | 'screen_view', object?: string): Promise<void> {
  const q = await load();
  q.push({ id: Crypto.randomUUID(), action, object: object ?? null, t: Date.now() });
  if (q.length > MAX_KEPT) q.splice(0, q.length - MAX_KEPT);
  await save();
  if (action === 'app_open' || Date.now() - lastSent >= SEND_EVERY_MS) void sendUsage();
}

export function sendUsage(): Promise<void> {
  if (sending) return sending;
  sending = (async () => {
    const q = await load();
    if (!q.length || !(await getSession())) return;
    const batch = q.slice(0, 100);
    try {
      await api.usage(batch, await gaInstallId());
      q.splice(0, batch.length);
    } catch (err) {
      // An older server without counts: drop them instead of piling up.
      if (err instanceof ApiError && err.status === 404) q.splice(0, batch.length);
      else return;
    }
    lastSent = Date.now();
    await save();
  })()
    .catch(() => undefined)
    .finally(() => {
      sending = null;
    });
  return sending;
}

/** Throws away unsent counts. Used when the account is deleted. */
export async function clearUsage(): Promise<void> {
  queue = [];
  gaId = null;
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
  await AsyncStorage.removeItem(GA_KEY).catch(() => undefined);
}
