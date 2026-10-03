// The background drive task must be defined as soon as the app loads,
// including when iPhone wakes the app in the background.
import '../tracking/tracker';
import '../lib/notifications';

import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { trackUsage } from '../lib/usage';

export default function RootLayout() {
  const segments = useSegments();
  const screen = segments.join('/') || 'index';

  // Count app opens: now, and each time it comes back to the front. iPhone
  // also starts the app unseen for drive tracking; that is not an open.
  useEffect(() => {
    if (AppState.currentState === 'active') void trackUsage('app_open');
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void trackUsage('app_open');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (AppState.currentState === 'active') void trackUsage('screen_view', screen);
  }, [screen]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ title: 'DriveWatch' }} />
        <Stack.Screen name="driver/index" options={{ title: 'DriveWatch' }} />
        <Stack.Screen name="parent/index" options={{ title: 'DriveWatch' }} />
        <Stack.Screen name="parent/settings" options={{ title: 'Family and rules' }} />
        <Stack.Screen name="parent/trip/[id]" options={{ title: 'Drive' }} />
      </Stack>
    </>
  );
}
