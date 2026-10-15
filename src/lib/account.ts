// Deleting an account: erase it on the server, then stop tracking and wipe
// everything this phone kept, so nothing is sent afterwards.

import { Alert } from 'react-native';
import { clearQueue } from '../tracking/queue';
import { stopTracking } from '../tracking/tracker';
import { api } from './api';
import { startOver } from './BackButton';
import { clearSession } from './session';
import { clearUsage } from './usage';

export function confirmDeleteAccount(role: 'parent' | 'driver', onError: (message: string) => void): void {
  const message =
    role === 'parent'
      ? 'This erases your account from DriveWatch. If you are the only parent, the whole family and all of its drives are erased too. This cannot be undone.'
      : 'This erases your account and all of your drives from DriveWatch, and your parents are told. This cannot be undone.';
  Alert.alert('Delete your account?', message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          await api.deleteMe();
        } catch (e) {
          onError(e instanceof Error ? e.message : 'Could not delete. Try again.');
          return;
        }
        await stopTracking().catch(() => undefined);
        await clearQueue().catch(() => undefined);
        await clearUsage();
        await clearSession();
        startOver('/welcome');
      },
    },
  ], { cancelable: true });
}
