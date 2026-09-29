import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import type { LocationPermission } from '../../../shared/types';
import { api, type TripRow } from '../../lib/api';
import { Button } from '../../lib/Button';
import { dayTimeText, durationText, milesText } from '../../lib/format';
import { getSession } from '../../lib/session';
import { colors, ui } from '../../lib/theme';
import { flush, pending } from '../../tracking/queue';
import { currentTripId, permissionStatus, startTracking } from '../../tracking/tracker';

export default function DriverHome() {
  const [name, setName] = useState('');
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  const [tracking, setTracking] = useState(false);
  const [driving, setDriving] = useState(false);
  const [waiting, setWaiting] = useState({ points: 0, events: 0 });
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const session = await getSession();
    setName(session?.name ?? '');
    setTracking(await startTracking());
    setPermission(await permissionStatus());
    setDriving(!!(await currentTripId()));
    await flush(true);
    setWaiting(await pending());
    try {
      setTrips((await api.trips()).trips);
    } catch {
      // Offline: keep what we have.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  async function turnOnLocation() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.granted) {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (!bg.granted) await Linking.openSettings();
    } else {
      await Linking.openSettings();
    }
    await refresh();
  }

  async function setPassenger(trip: TripRow, value: boolean) {
    setTrips((ts) => ts.map((t) => (t.id === trip.id ? { ...t, passenger: value ? 1 : 0 } : t)));
    try {
      await api.markPassenger(trip.id, value);
    } catch {
      setTrips((ts) => ts.map((t) => (t.id === trip.id ? { ...t, passenger: trip.passenger } : t)));
    }
  }

  const ready = permission === 'always' && tracking;

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.pad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
    >
      <Text style={ui.h1}>Hi {name}</Text>

      <View style={[ui.card, { borderColor: ready ? colors.ok : colors.warn }]}>
        <Text style={[ui.h2, { color: ready ? colors.ok : colors.warn }]}>
          {ready ? (driving ? 'Drive in progress' : 'DriveWatch is on') : 'Setup needed'}
        </Text>
        {ready ? (
          <Text style={ui.body}>Drives are logged on their own. You never need to open the app while driving.</Text>
        ) : (
          <>
            <Text style={ui.body}>
              Location must be set to "Always" so drives can be logged when the app is closed. Your parents are told when it
              isn't.
            </Text>
            <Button title='Set location to "Always"' onPress={turnOnLocation} />
            <Text style={ui.muted}>
              If Settings opens: tap Location, then Always. Also leave Precise Location on.
            </Text>
          </>
        )}
        {(waiting.points > 0 || waiting.events > 0) && (
          <Text style={ui.muted}>Waiting to upload: {waiting.points} locations, {waiting.events} events.</Text>
        )}
      </View>

      <Text style={[ui.h2, { marginTop: 8 }]}>Your drives</Text>
      {trips.length === 0 && <Text style={ui.muted}>No drives yet.</Text>}
      {trips.map((t) => (
        <View key={t.id} style={ui.card}>
          <Text style={ui.body}>{dayTimeText(t.started_at)}</Text>
          <Text style={ui.muted}>
            {milesText(t.distance_m)} · {durationText(t.started_at, t.ended_at)}
            {t.phone_events ? ` · ${t.phone_events} phone use` : ''}
          </Text>
          <View style={ui.row}>
            <Text style={ui.body}>I was a passenger</Text>
            <Switch value={!!t.passenger} onValueChange={(v) => setPassenger(t, v)} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
