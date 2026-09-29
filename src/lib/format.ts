import { mph } from '../../shared/types';

export function speedText(speedMps: number | null | undefined): string {
  return `${Math.round(mph(speedMps))} mph`;
}

export function milesText(meters: number): string {
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

export function timeText(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function dayTimeText(t: number): string {
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86_400_000).toDateString() === d.toDateString();
  const day = sameDay ? 'Today' : yesterday ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${timeText(t)}`;
}

export function agoText(t: number | null | undefined): string {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function durationText(start: number, end: number | null): string {
  const mins = Math.max(1, Math.round(((end ?? Date.now()) - start) / 60_000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

const EVENT_LABELS: Record<string, string> = {
  phone_unlocked: 'Phone unlocked',
  phone_handling: 'Phone picked up',
  handheld_call: 'Handheld call',
  over_speed: 'High speed',
  permission_changed: 'Tracking changed',
  signal_lost: 'Stopped reporting',
  trip_start: 'Drive started',
  trip_end: 'Drive ended',
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}
