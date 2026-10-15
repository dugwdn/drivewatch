import { Link, Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api, type EventRow, type LiveDriver, type TripRow } from '../../lib/api';
import { agoText, dayTimeText, durationText, eventLabel, milesText, speedText } from '../../lib/format';
import { registerForAlerts } from '../../lib/notifications';
import { colors, ui } from '../../lib/theme';

const LIVE_EVERY_MS = 15_000;
const FRESH_MS = 3 * 60_000;

export default function ParentHome() {
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const map = useRef<MapView>(null);

  useEffect(() => {
    registerForAlerts().catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      const [live, ev, tr] = await Promise.all([api.live(), api.events(), api.trips()]);
      setDrivers(live.drivers);
      setEvents(ev.events);
      setTrips(tr.trips);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void api.live().then((r) => setDrivers(r.drivers)).catch(() => undefined), LIVE_EVERY_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  const located = drivers.filter((d) => d.last_lat != null && d.last_lng != null);

  useEffect(() => {
    if (!located.length || !map.current) return;
    map.current.fitToCoordinates(
      located.map((d) => ({ latitude: d.last_lat!, longitude: d.last_lng! })),
      { edgePadding: { top: 60, bottom: 60, left: 60, right: 60 }, animated: false },
    );
  }, [located.length]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/parent/settings" asChild>
              <Pressable hitSlop={12}>
                <Text style={{ color: colors.brand, fontSize: 17 }}>Family</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView
        style={ui.screen}
        contentContainerStyle={ui.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {!!error && <Text style={ui.error}>{error}</Text>}

        {located.length > 0 && (
          <MapView
            ref={map}
            style={{ height: 260, borderRadius: 12 }}
            initialRegion={{ latitude: located[0].last_lat!, longitude: located[0].last_lng!, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          >
            {located.map((d) => (
              <Marker
                key={d.id}
                coordinate={{ latitude: d.last_lat!, longitude: d.last_lng! }}
                title={d.name}
                description={d.active_trip_id ? `Driving, ${speedText(d.last_speed_mps)}` : `Last seen ${agoText(d.last_fix_at)}`}
              />
            ))}
          </MapView>
        )}

        {drivers.length === 0 && (
          <View style={ui.card}>
            <Text style={ui.h2}>Add a driver</Text>
            <Text style={ui.body}>Tap Family at the top right to make a code, then enter it in DriveWatch on the driver's iPhone.</Text>
          </View>
        )}

        {drivers.map((d) => {
          const driving = !!d.active_trip_id && !!d.last_fix_at && Date.now() - d.last_fix_at < FRESH_MS;
          const setupProblem = d.location_permission !== 'always';
          return (
            <View key={d.id} style={ui.card}>
              <View style={ui.row}>
                <Text style={ui.h2}>{d.name}</Text>
                <Text style={[ui.body, { color: driving ? colors.brand : colors.muted }]}>
                  {driving ? `Driving · ${speedText(d.last_speed_mps)}` : 'Not driving'}
                </Text>
              </View>
              <Text style={ui.muted}>Last update {agoText(d.last_seen_at)}</Text>
              {d.phone_events_today > 0 && (
                <Text style={[ui.body, { color: colors.danger }]}>
                  Phone use while driving: {d.phone_events_today} in the last 24 hours
                </Text>
              )}
              {setupProblem && (
                <Text style={[ui.body, { color: colors.warn }]}>
                  Location isn't set to "Always" on this phone, so drives aren't being logged.
                </Text>
              )}
            </View>
          );
        })}

        <Text style={[ui.h2, { marginTop: 8 }]}>Alerts</Text>
        {events.length === 0 && <Text style={ui.muted}>No alerts. Good news.</Text>}
        {events.slice(0, 15).map((e) => (
          <Pressable key={e.id} disabled={!e.trip_id} onPress={() => e.trip_id && router.push(`/parent/trip/${e.trip_id}`)}>
            <View style={[ui.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[ui.body, { fontWeight: '600' }]}>
                  {e.driver_name}: {eventLabel(e.type)}
                </Text>
                <Text style={ui.muted}>{dayTimeText(e.t)}</Text>
              </View>
              {e.speed_mps != null && <Text style={ui.body}>{speedText(e.speed_mps)}</Text>}
            </View>
          </Pressable>
        ))}

        <Text style={[ui.h2, { marginTop: 8 }]}>Recent drives</Text>
        {trips.length === 0 && <Text style={ui.muted}>No drives yet.</Text>}
        {trips.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/parent/trip/${t.id}`)}>
            <View style={ui.card}>
              <View style={ui.row}>
                <Text style={[ui.body, { fontWeight: '600' }]}>{t.driver_name}</Text>
                <Text style={ui.muted}>{dayTimeText(t.started_at)}</Text>
              </View>
              <Text style={ui.muted}>
                {milesText(t.distance_m)} · {durationText(t.started_at, t.ended_at)} · top {speedText(t.max_speed_mps)}
                {t.ended_at == null ? ' · in progress' : ''}
              </Text>
              {t.phone_events > 0 && <Text style={[ui.body, { color: colors.danger }]}>Phone use: {t.phone_events}</Text>}
              {!!t.passenger && <Text style={ui.muted}>Marked "I was a passenger"</Text>}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
