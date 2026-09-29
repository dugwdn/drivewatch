import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { api, type TripDetail } from '../../../lib/api';
import { dayTimeText, durationText, eventLabel, milesText, speedText, timeText } from '../../../lib/format';
import { colors, ui } from '../../../lib/theme';

const SHOWN = new Set(['phone_unlocked', 'phone_handling', 'handheld_call', 'over_speed', 'signal_lost']);

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<TripDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.trip(id).then(setData, (e) => setError(e instanceof Error ? e.message : 'Could not load.'));
  }, [id]);

  if (error) return <Text style={[ui.error, ui.pad]}>{error}</Text>;
  if (!data) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const { trip, points, events } = data;
  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const flagged = events.filter((e) => SHOWN.has(e.type));

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.pad}>
      <Text style={ui.h1}>{trip.driver_name}</Text>
      <Text style={ui.muted}>
        {dayTimeText(trip.started_at)} · {milesText(trip.distance_m)} · {durationText(trip.started_at, trip.ended_at)} · top{' '}
        {speedText(trip.max_speed_mps)}
      </Text>
      {!!trip.passenger && <Text style={ui.body}>{trip.driver_name} marked this drive "I was a passenger".</Text>}

      {coords.length > 0 && (
        <MapView
          style={{ height: 340, borderRadius: 12 }}
          initialRegion={region(coords)}
        >
          <Polyline coordinates={coords} strokeWidth={4} strokeColor={colors.brand} />
          {flagged
            .filter((e) => e.lat != null && e.lng != null)
            .map((e) => (
              <Marker
                key={e.id}
                coordinate={{ latitude: e.lat!, longitude: e.lng! }}
                pinColor={colors.danger}
                title={eventLabel(e.type)}
                description={`${timeText(e.t)}${e.speed_mps != null ? `, ${speedText(e.speed_mps)}` : ''}`}
              />
            ))}
        </MapView>
      )}

      <Text style={[ui.h2, { marginTop: 8 }]}>What happened</Text>
      {flagged.length === 0 && <Text style={ui.muted}>No phone use or high speed on this drive.</Text>}
      {flagged.map((e) => (
        <View key={e.id} style={[ui.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <View>
            <Text style={[ui.body, { fontWeight: '600', color: colors.danger }]}>{eventLabel(e.type)}</Text>
            <Text style={ui.muted}>{timeText(e.t)}</Text>
          </View>
          {e.speed_mps != null && <Text style={ui.body}>{speedText(e.speed_mps)}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

function region(coords: { latitude: number; longitude: number }[]) {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.4),
  };
}
