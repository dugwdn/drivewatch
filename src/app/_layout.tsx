// The background drive task must be defined as soon as the app loads,
// including when iPhone wakes the app in the background.
import '../tracking/tracker';
import '../lib/notifications';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
