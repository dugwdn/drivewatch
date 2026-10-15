// The sign-in token lives in the iPhone keychain. It must stay readable while
// the phone is locked, because drives are logged in the background.

import * as SecureStore from 'expo-secure-store';
import type { Role } from '../../shared/types';

export interface Session {
  token: string;
  memberId: string;
  role: Role;
  name: string;
  familyId: string;
}

const KEY = 'drivewatch.session';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

let cached: Session | null | undefined;

export async function getSession(): Promise<Session | null> {
  if (cached !== undefined) return cached;
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  cached = raw ? (JSON.parse(raw) as Session) : null;
  return cached;
}

export async function saveSession(session: Session): Promise<void> {
  cached = session;
  await SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS);
}

export async function clearSession(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}
