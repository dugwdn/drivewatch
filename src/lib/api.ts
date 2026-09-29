import type { FamilyRules, IngestBody, Role } from '../../shared/types';
import type { UsageIn } from '../../shared/usage';
import { API_URL } from './config';
import { getSession } from './session';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const auth = token ?? (await getSession())?.token;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export interface JoinResult {
  token: string;
  member: { id: string; role: Role; name: string; familyId: string };
}

export interface LiveDriver {
  id: string;
  name: string;
  location_permission: string;
  last_seen_at: number | null;
  last_fix_at: number | null;
  last_lat: number | null;
  last_lng: number | null;
  last_speed_mps: number | null;
  last_heading: number | null;
  active_trip_id: string | null;
  phone_events_today: number;
}

export interface TripRow {
  id: string;
  member_id: string;
  driver_name: string;
  started_at: number;
  ended_at: number | null;
  distance_m: number;
  max_speed_mps: number;
  phone_events: number;
  passenger: number;
}

export interface EventRow {
  id: string;
  member_id?: string;
  driver_name?: string;
  trip_id: string | null;
  type: string;
  t: number;
  lat: number | null;
  lng: number | null;
  speed_mps: number | null;
  detail: string | null;
}

export interface TripDetail {
  trip: TripRow & { last_lat: number | null; last_lng: number | null };
  points: { t: number; lat: number; lng: number; speed_mps: number | null }[];
  events: EventRow[];
}

export interface FamilyInfo {
  family: { id: string; name: string };
  rules: FamilyRules;
  me: { id: string; role: Role; name: string };
  members: { id: string; role: Role; name: string; location_permission: string; last_seen_at: number | null }[];
}

export const api = {
  createFamily: (familyName: string, parentName: string) =>
    call<JoinResult>('POST', '/v1/families', { familyName, parentName }),
  join: (code: string, name: string, platform: string) =>
    call<JoinResult>('POST', '/v1/join', { code, name, platform }),
  family: () => call<FamilyInfo>('GET', '/v1/family'),
  updateRules: (rules: Partial<FamilyRules>) => call<{ rules: FamilyRules }>('PATCH', '/v1/family', rules),
  invite: (role: Role) => call<{ code: string; role: Role; expiresAt: number }>('POST', '/v1/invites', { role }),
  removeMember: (id: string) => call<{ ok: true }>('DELETE', `/v1/members/${id}`),
  savePushToken: (pushToken: string) => call<{ ok: true }>('POST', '/v1/push-token', { pushToken }),
  ingest: (body: IngestBody, token: string) => call<{ rules: FamilyRules }>('POST', '/v1/ingest', body, token),
  live: () => call<{ drivers: LiveDriver[] }>('GET', '/v1/live'),
  trips: (member?: string) =>
    call<{ trips: TripRow[] }>('GET', `/v1/trips${member ? `?member=${encodeURIComponent(member)}` : ''}`),
  trip: (id: string) => call<TripDetail>('GET', `/v1/trips/${encodeURIComponent(id)}`),
  events: () => call<{ events: EventRow[] }>('GET', '/v1/events'),
  markPassenger: (id: string, passenger: boolean) =>
    call<{ ok: true }>('POST', `/v1/trips/${encodeURIComponent(id)}/passenger`, { passenger }),
  usage: (events: UsageIn[]) => call<{ saved: number }>('POST', '/v1/usage', { events }),
};
