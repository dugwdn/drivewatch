// DriveWatch API on Cloudflare Workers + D1.

import { alertFor } from '../../shared/alerts';
import { distanceM } from '../../shared/drive';
import type { EventIn, FamilyRules, IngestBody, LocationPermission, PointIn } from '../../shared/types';
import { DEFAULT_RULES } from '../../shared/types';
import { cleanUsage, type UsageAction } from '../../shared/usage';
import { hashToken, memberFromRequest, newId, newInviteCode, newToken, type Env, type Member } from './auth';
import { page } from './pages';
import { pushToParents } from './push';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SIGNAL_LOST_AFTER_MS = 6 * 60 * 1000;
const CLOSE_STALE_TRIP_AFTER_MS = 2 * 60 * 60 * 1000;
const PERMISSIONS: LocationPermission[] = ['always', 'when_in_use', 'denied', 'unknown'];
/** Driving routes (GPS points) older than this are deleted. Trip summaries and alerts stay. */
const ROUTE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await route(req, env);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Something went wrong.' }, 500);
    }
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const now = Date.now();
    await checkQuietPhones(env, now);
    // Once a day (the 07:00 UTC run), not every 5 minutes, to keep D1 reads low.
    if (isDailyRun(controller.scheduledTime || now)) await deleteOldRoutes(env, now);
  },
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Expected JSON.');
  }
}

function text(v: unknown, field: string, max = 60): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${field} is required.`);
  return v.trim().slice(0, max);
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;

  if (method === 'GET' && path === '/health') return json({ ok: true });
  if (method === 'GET' && (path === '/privacy' || path === '/support' || path === '')) return page(path, env);

  // No sign-in needed for these two.
  if (method === 'POST' && (path === '/v1/families' || path === '/v1/join')) {
    await limitSignUps(req, env);
    return path === '/v1/join' ? join(req, env) : createFamily(req, env);
  }

  const me = await memberFromRequest(req, env);
  if (!me) throw new HttpError(401, 'Please sign in again.');

  if (method === 'GET' && path === '/v1/family') return getFamily(env, me);
  if (method === 'PATCH' && path === '/v1/family') return updateFamily(req, env, me);
  if (method === 'POST' && path === '/v1/invites') return createInvite(req, env, me);
  if (method === 'POST' && path === '/v1/push-token') return savePushToken(req, env, me);
  if (method === 'POST' && path === '/v1/ingest') return ingest(req, env, me);
  if (method === 'POST' && path === '/v1/usage') return saveUsage(req, env, me);
  if (method === 'DELETE' && path === '/v1/me') return deleteMe(env, me);
  if (method === 'GET' && path === '/v1/live') return live(env, me);
  if (method === 'GET' && path === '/v1/trips') return listTrips(url, env, me);
  if (method === 'GET' && path === '/v1/events') return listEvents(url, env, me);

  const trip = /^\/v1\/trips\/([\w-]+)$/.exec(path);
  if (method === 'GET' && trip) return getTrip(trip[1], env, me);
  const passenger = /^\/v1\/trips\/([\w-]+)\/passenger$/.exec(path);
  if (method === 'POST' && passenger) return markPassenger(req, passenger[1], env, me);
  const member = /^\/v1\/members\/([\w-]+)$/.exec(path);
  if (method === 'DELETE' && member) return removeMember(member[1], env, me);

  throw new HttpError(404, 'Not found.');
}

function requireParent(me: Member) {
  if (me.role !== 'parent') throw new HttpError(403, 'Only a parent can do that.');
}

/**
 * The App Review sample family (migration 0003) can be joined by anyone with
 * the public code APPREVIEW, so people in it can only look around.
 */
export function isSampleFamily(familyId: string): boolean {
  return familyId.startsWith('demo-');
}

function requireRealFamily(me: Member) {
  if (isSampleFamily(me.family_id)) {
    throw new HttpError(403, "This is a sample family for looking around. Start your own family to change things.");
  }
}

/**
 * 10 sign-up tries (new family or join code) per minute per network address,
 * so join codes can't be guessed by brute force and spam can't burn D1 writes.
 * Skipped when the binding is missing (local tests).
 */
async function limitSignUps(req: Request, env: Env): Promise<void> {
  if (!env.SIGNUP_LIMITER) return;
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.SIGNUP_LIMITER.limit({ key: ip });
  if (!success) throw new HttpError(429, 'Too many tries. Wait a minute and try again.');
}

async function rulesFor(env: Env, familyId: string): Promise<FamilyRules> {
  const row = await env.DB.prepare('SELECT phone_speed_mph, max_speed_mph FROM families WHERE id = ?')
    .bind(familyId)
    .first<{ phone_speed_mph: number; max_speed_mph: number }>();
  if (!row) return DEFAULT_RULES;
  return { phoneSpeedMph: row.phone_speed_mph, maxSpeedMph: row.max_speed_mph };
}

// ---- Families, invites, members ----

async function createFamily(req: Request, env: Env): Promise<Response> {
  const b = await body<{ familyName?: string; parentName?: string }>(req);
  const familyName = text(b.familyName, 'Family name');
  const parentName = text(b.parentName, 'Your name');
  const now = Date.now();
  const familyId = newId();
  const memberId = newId();
  const token = newToken();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO families (id, name, phone_speed_mph, max_speed_mph, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(familyId, familyName, DEFAULT_RULES.phoneSpeedMph, DEFAULT_RULES.maxSpeedMph, now),
    env.DB.prepare(
      "INSERT INTO members (id, family_id, role, name, token_hash, created_at) VALUES (?, ?, 'parent', ?, ?, ?)",
    ).bind(memberId, familyId, parentName, await hashToken(token), now),
  ]);
  await track(env, { id: memberId, family_id: familyId, role: 'parent' }, 'family_created');
  return json({ token, member: { id: memberId, role: 'parent', name: parentName, familyId } });
}

async function join(req: Request, env: Env): Promise<Response> {
  const b = await body<{ code?: string; name?: string }>(req);
  const code = text(b.code, 'Code', 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = text(b.name, 'Your name');
  const now = Date.now();
  const invite = await env.DB.prepare(
    'SELECT code, family_id, role, expires_at, used_by, reusable FROM invites WHERE code = ?',
  )
    .bind(code)
    .first<{
      code: string;
      family_id: string;
      role: 'parent' | 'driver';
      expires_at: number;
      used_by: string | null;
      reusable: number;
    }>();
  if (!invite || invite.used_by || invite.expires_at < now) {
    throw new HttpError(400, 'That code is not valid. Ask a parent for a new one.');
  }
  const memberId = newId();
  const token = newToken();
  if (invite.reusable) {
    // Only the App Review sample family has a code like this.
    await env.DB.prepare('INSERT INTO members (id, family_id, role, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(memberId, invite.family_id, invite.role, name, await hashToken(token), now)
      .run();
    await track(env, { id: memberId, family_id: invite.family_id, role: invite.role }, 'member_joined', invite.role);
    return json({ token, member: { id: memberId, role: invite.role, name, familyId: invite.family_id } });
  }
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO members (id, family_id, role, name, token_hash, created_at)
       SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM invites WHERE code = ? AND used_by IS NULL)`,
    ).bind(memberId, invite.family_id, invite.role, name, await hashToken(token), now, code),
    env.DB.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL').bind(
      memberId,
      now,
      code,
    ),
  ]);
  if (!results[0].meta.changes || !results[1].meta.changes) {
    // Someone else used the code at the same moment; undo this sign-up.
    await env.DB.prepare('DELETE FROM members WHERE id = ?').bind(memberId).run();
    throw new HttpError(400, 'That code was just used. Ask for a new one.');
  }
  await track(env, { id: memberId, family_id: invite.family_id, role: invite.role }, 'member_joined', invite.role);
  return json({ token, member: { id: memberId, role: invite.role, name, familyId: invite.family_id } });
}

async function getFamily(env: Env, me: Member): Promise<Response> {
  const family = await env.DB.prepare('SELECT id, name FROM families WHERE id = ?').bind(me.family_id).first();
  const { results: members } = await env.DB.prepare(
    'SELECT id, role, name, location_permission, last_seen_at FROM members WHERE family_id = ? ORDER BY role, name',
  )
    .bind(me.family_id)
    .all();
  return json({
    family,
    rules: await rulesFor(env, me.family_id),
    me: { id: me.id, role: me.role, name: me.name },
    members,
  });
}

async function updateFamily(req: Request, env: Env, me: Member): Promise<Response> {
  requireParent(me);
  requireRealFamily(me);
  const b = await body<{ name?: string; phoneSpeedMph?: number; maxSpeedMph?: number }>(req);
  const current = await rulesFor(env, me.family_id);
  const phone = clampInt(b.phoneSpeedMph, 5, 60, current.phoneSpeedMph);
  const max = clampInt(b.maxSpeedMph, 30, 120, current.maxSpeedMph);
  const newName = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 60) : null;
  await env.DB.prepare(
    'UPDATE families SET phone_speed_mph = ?, max_speed_mph = ?, name = COALESCE(?, name) WHERE id = ?',
  )
    .bind(phone, max, newName, me.family_id)
    .run();
  if (phone !== current.phoneSpeedMph) await track(env, me, 'rules_changed', 'phone_speed');
  if (max !== current.maxSpeedMph) await track(env, me, 'rules_changed', 'max_speed');
  if (newName) await track(env, me, 'rules_changed', 'family_name');
  return json({ rules: { phoneSpeedMph: phone, maxSpeedMph: max } });
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

async function createInvite(req: Request, env: Env, me: Member): Promise<Response> {
  requireParent(me);
  requireRealFamily(me);
  const b = await body<{ role?: string }>(req);
  const role = b.role === 'parent' ? 'parent' : 'driver';
  const expiresAt = Date.now() + INVITE_TTL_MS;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    const res = await env.DB.prepare(
      'INSERT OR IGNORE INTO invites (code, family_id, role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(code, me.family_id, role, me.id, expiresAt)
      .run();
    if (res.meta.changes) {
      await track(env, me, 'invite_created', role);
      return json({ code, role, expiresAt });
    }
  }
  throw new HttpError(500, 'Could not make a code. Try again.');
}

async function savePushToken(req: Request, env: Env, me: Member): Promise<Response> {
  const b = await body<{ pushToken?: string }>(req);
  const token = typeof b.pushToken === 'string' ? b.pushToken.slice(0, 200) : null;
  await env.DB.prepare('UPDATE members SET push_token = ? WHERE id = ?').bind(token, me.id).run();
  return json({ ok: true });
}

async function removeMember(id: string, env: Env, me: Member): Promise<Response> {
  requireParent(me);
  requireRealFamily(me);
  if (id === me.id) throw new HttpError(400, "You can't remove yourself.");
  if (id.startsWith('demo-')) throw new HttpError(400, 'This is a sample person and stays in the sample family.');
  // Keep their trips and events; just sign the phone out for good.
  const res = await env.DB.prepare(
    "UPDATE members SET token_hash = 'removed:' || id, push_token = NULL WHERE id = ? AND family_id = ?",
  )
    .bind(id, me.family_id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Not found.');
  await track(env, me, 'member_removed');
  return json({ ok: true });
}

/**
 * Deletes the signed-in person and everything recorded about them. If they are
 * the family's last parent, the whole family goes with them, since a family
 * with no parent has no one to see its drives.
 */
async function deleteMe(env: Env, me: Member): Promise<Response> {
  const others = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM members
     WHERE family_id = ? AND role = 'parent' AND id != ? AND token_hash NOT LIKE 'removed:%'`,
  )
    .bind(me.family_id, me.id)
    .first<{ n: number }>();
  // The sample family is never erased; a reviewer deleting their account removes only themselves.
  const wholeFamily = me.role === 'parent' && !others?.n && !isSampleFamily(me.family_id);

  if (me.role === 'driver') {
    await pushToParents(env, me.family_id, {
      title: `${me.name} deleted their DriveWatch account`,
      body: 'Drives from their phone are no longer logged.',
    }).catch(() => 0);
  }

  const db = env.DB;
  if (wholeFamily) {
    const f = me.family_id;
    await db.batch([
      db.prepare('DELETE FROM points WHERE trip_id IN (SELECT id FROM trips WHERE family_id = ?)').bind(f),
      db.prepare('DELETE FROM events WHERE family_id = ?').bind(f),
      db.prepare('DELETE FROM usage_events WHERE family_id = ?').bind(f),
      db.prepare('DELETE FROM trips WHERE family_id = ?').bind(f),
      db.prepare('DELETE FROM invites WHERE family_id = ?').bind(f),
      db.prepare('DELETE FROM members WHERE family_id = ?').bind(f),
      db.prepare('DELETE FROM families WHERE id = ?').bind(f),
    ]);
  } else {
    const m = me.id;
    await db.batch([
      db.prepare('DELETE FROM points WHERE trip_id IN (SELECT id FROM trips WHERE member_id = ?)').bind(m),
      db.prepare('DELETE FROM events WHERE member_id = ?').bind(m),
      db.prepare('DELETE FROM usage_events WHERE member_id = ?').bind(m),
      db.prepare('DELETE FROM trips WHERE member_id = ?').bind(m),
      db.prepare('DELETE FROM invites WHERE created_by = ? OR used_by = ?').bind(m, m),
      db.prepare('DELETE FROM members WHERE id = ?').bind(m),
    ]);
  }
  return json({ ok: true, familyDeleted: wholeFamily });
}

// ---- App use counts (our own analytics; nothing goes to Google) ----

type Actor = Pick<Member, 'id' | 'family_id' | 'role'>;

/** Records one server-side use row. Never fails the request it rides on. */
async function track(env: Env, who: Actor, action: UsageAction, object: string | null = null): Promise<void> {
  const now = Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO usage_events (id, family_id, member_id, role, action, object, source, t, received_at)
       VALUES (?, ?, ?, ?, ?, ?, 'server', ?, ?)`,
    )
      .bind(newId(), who.family_id, who.id, who.role, action, object, now, now)
      .run();
  } catch (err) {
    console.error('usage', err);
  }
}

async function saveUsage(req: Request, env: Env, me: Member): Promise<Response> {
  const b = await body<{ events?: unknown }>(req);
  const now = Date.now();
  const rows = cleanUsage(b.events, now);
  if (rows.length) {
    await env.DB.batch(
      rows.map((r) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO usage_events (id, family_id, member_id, role, action, object, source, t, received_at)
           VALUES (?, ?, ?, ?, ?, ?, 'app', ?, ?)`,
        ).bind(r.id, me.family_id, me.id, me.role, r.action, r.object ?? null, r.t, now),
      ),
    );
  }
  return json({ saved: rows.length });
}

// ---- Data from the driver's phone ----

const MAX_POINTS = 3000;
const MAX_EVENTS = 200;
const MAX_TRIPS = 20;
const POINT_COLS = 7; // D1 allows 100 bound values per statement
const POINT_ROWS_PER_INSERT = Math.floor(100 / POINT_COLS);

async function ingest(req: Request, env: Env, me: Member): Promise<Response> {
  if (me.role !== 'driver') throw new HttpError(403, 'Only a driver phone sends drives.');
  requireRealFamily(me);
  const b = await body<IngestBody>(req);
  const now = Date.now();
  const trips = Array.isArray(b.trips) ? b.trips.slice(0, MAX_TRIPS) : [];
  const points = Array.isArray(b.points) ? b.points.slice(0, MAX_POINTS).filter(validPoint) : [];
  const events = Array.isArray(b.events) ? b.events.slice(0, MAX_EVENTS) : [];
  const rules = await rulesFor(env, me.family_id);

  // 1. Trips. A trip id that belongs to someone else is never touched.
  if (trips.length) {
    await env.DB.batch(
      trips
        .filter((t) => typeof t.id === 'string' && Number.isFinite(t.startedAt))
        .map((t) =>
          env.DB.prepare(
            `INSERT INTO trips (id, family_id, member_id, started_at, ended_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET ended_at = COALESCE(excluded.ended_at, trips.ended_at)
             WHERE trips.member_id = excluded.member_id`,
          ).bind(t.id, me.family_id, me.id, t.startedAt, Number.isFinite(t.endedAt) ? t.endedAt : null),
        ),
    );
  }

  const tripIds = [...new Set([...points.map((p) => p.tripId), ...events.map((e) => e.tripId).filter(Boolean)])] as string[];
  const owned = await ownedTrips(env, me.id, tripIds);

  // 2. Points, plus running distance and top speed per trip.
  const myPoints = points.filter((p) => owned.has(p.tripId)).sort((a, b) => a.t - b.t);
  if (myPoints.length) {
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < myPoints.length; i += POINT_ROWS_PER_INSERT) {
      const chunk = myPoints.slice(i, i + POINT_ROWS_PER_INSERT);
      const sql = `INSERT OR IGNORE INTO points (trip_id, t, lat, lng, speed_mps, heading, accuracy) VALUES ${chunk
        .map(() => '(?, ?, ?, ?, ?, ?, ?)')
        .join(', ')}`;
      stmts.push(
        env.DB.prepare(sql).bind(
          ...chunk.flatMap((p) => [p.tripId, p.t, p.lat, p.lng, p.speedMps, p.heading, p.accuracy]),
        ),
      );
    }
    for (const [tripId, trip] of owned) {
      const tp = myPoints.filter((p) => p.tripId === tripId);
      if (!tp.length) continue;
      let dist = 0;
      let prev = trip.last_lat != null && trip.last_lng != null ? { lat: trip.last_lat, lng: trip.last_lng } : null;
      let maxSpeed = 0;
      for (const p of tp) {
        if (prev && (p.accuracy == null || p.accuracy < 50)) dist += distanceM(prev.lat, prev.lng, p.lat, p.lng);
        if (p.accuracy == null || p.accuracy < 50) prev = p;
        if (p.speedMps != null && (p.accuracy == null || p.accuracy < 50)) maxSpeed = Math.max(maxSpeed, p.speedMps);
      }
      stmts.push(
        env.DB.prepare(
          'UPDATE trips SET distance_m = distance_m + ?, max_speed_mps = MAX(max_speed_mps, ?), last_lat = ?, last_lng = ? WHERE id = ?',
        ).bind(dist, maxSpeed, prev?.lat ?? null, prev?.lng ?? null, tripId),
      );
    }
    await env.DB.batch(stmts);
  }

  // 3. Events. New ones may become alerts.
  for (const e of events) {
    if (!validEvent(e) || !PHONE_SENT_EVENTS.has(e.type)) continue;
    if (e.tripId && !owned.has(e.tripId)) continue;
    await recordEvent(env, me, rules, e);
  }

  // 4. Permission check: tell parents if "Always" was switched off.
  const permission = PERMISSIONS.includes(b.status?.permission) ? b.status.permission : 'unknown';
  const prev = await env.DB.prepare('SELECT location_permission FROM members WHERE id = ?')
    .bind(me.id)
    .first<{ location_permission: string }>();
  if (prev?.location_permission === 'always' && permission !== 'always' && permission !== 'unknown') {
    await recordEvent(env, me, rules, {
      id: newId(),
      tripId: null,
      type: 'permission_changed',
      t: now,
      lat: null,
      lng: null,
      speedMps: null,
      detail: { permission },
    });
  }

  // 5. Where they are now, and whether a drive is open.
  const last = myPoints[myPoints.length - 1];
  await env.DB.prepare(
    `UPDATE members SET
       last_seen_at = ?,
       location_permission = CASE WHEN ? = 'unknown' THEN location_permission ELSE ? END,
       last_fix_at = COALESCE(?, last_fix_at), last_lat = COALESCE(?, last_lat), last_lng = COALESCE(?, last_lng),
       last_speed_mps = CASE WHEN ? IS NULL THEN last_speed_mps ELSE ? END,
       last_heading = CASE WHEN ? IS NULL THEN last_heading ELSE ? END,
       signal_lost_alerted_at = NULL,
       active_trip_id = (SELECT id FROM trips WHERE member_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1)
     WHERE id = ?`,
  )
    .bind(
      now,
      permission,
      permission,
      last?.t ?? null,
      last?.lat ?? null,
      last?.lng ?? null,
      last?.t ?? null,
      last?.speedMps ?? null,
      last?.t ?? null,
      last?.heading ?? null,
      me.id,
      me.id,
    )
    .run();

  return json({ rules });
}

function validPoint(p: PointIn): boolean {
  return (
    !!p &&
    typeof p.tripId === 'string' &&
    Number.isFinite(p.t) &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

function validEvent(e: EventIn): boolean {
  return !!e && typeof e.id === 'string' && e.id.length <= 64 && typeof e.type === 'string' && Number.isFinite(e.t);
}

async function ownedTrips(env: Env, memberId: string, ids: string[]) {
  const owned = new Map<string, { last_lat: number | null; last_lng: number | null }>();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const { results } = await env.DB.prepare(
      `SELECT id, last_lat, last_lng FROM trips WHERE member_id = ? AND id IN (${chunk.map(() => '?').join(', ')})`,
    )
      .bind(memberId, ...chunk)
      .all<{ id: string; last_lat: number | null; last_lng: number | null }>();
    for (const r of results) owned.set(r.id, r);
  }
  return owned;
}

const PHONE_EVENTS = new Set(['phone_unlocked', 'phone_handling', 'handheld_call']);
/** Event types a driver's phone may send. The rest are made by the server. */
const PHONE_SENT_EVENTS = new Set(['trip_start', 'trip_end', 'over_speed', ...PHONE_EVENTS]);
/** Never push the same kind of alert for the same driver more often than this. */
const ALERT_REPEAT_MS = 60_000;

async function recordEvent(env: Env, me: Member, rules: FamilyRules, e: EventIn): Promise<void> {
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO events (id, family_id, member_id, trip_id, type, t, lat, lng, speed_mps, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      e.id,
      me.family_id,
      me.id,
      e.tripId,
      e.type,
      e.t,
      e.lat,
      e.lng,
      e.speedMps,
      e.detail ? JSON.stringify(e.detail).slice(0, 2000) : null,
    )
    .run();
  if (!res.meta.changes) return; // already have it; a retry

  if (e.tripId && PHONE_EVENTS.has(e.type)) {
    await env.DB.prepare('UPDATE trips SET phone_events = phone_events + 1 WHERE id = ?').bind(e.tripId).run();
  }

  const alert = alertFor(e, rules, me.name);
  const recent = alert
    ? await env.DB.prepare(
        'SELECT 1 FROM events WHERE member_id = ? AND type = ? AND alerted = 1 AND t > ? AND t <= ? AND id != ? LIMIT 1',
      )
        .bind(me.id, e.type, e.t - ALERT_REPEAT_MS, e.t, e.id)
        .first()
    : null;
  if (alert && !recent) {
    const sent = await pushToParents(env, me.family_id, alert);
    await env.DB.prepare('UPDATE events SET alerted = ? WHERE id = ?').bind(sent ? 1 : 0, e.id).run();
  }
}

// ---- Parent views ----

async function live(env: Env, me: Member): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.name, m.location_permission, m.last_seen_at, m.last_fix_at, m.last_lat, m.last_lng,
            m.last_speed_mps, m.last_heading, m.active_trip_id,
            (SELECT COUNT(*) FROM events e WHERE e.member_id = m.id AND e.t > ? AND e.type IN ('phone_unlocked','phone_handling','handheld_call')) AS phone_events_today
     FROM members m
     WHERE m.family_id = ? AND m.role = 'driver' AND m.token_hash NOT LIKE 'removed:%'
       AND (? = 'parent' OR m.id = ?)
     ORDER BY m.name`,
  )
    .bind(Date.now() - 24 * 60 * 60 * 1000, me.family_id, me.role, me.id)
    .all();
  return json({ drivers: results });
}

async function listTrips(url: URL, env: Env, me: Member): Promise<Response> {
  const limit = clampInt(Number(url.searchParams.get('limit') ?? 30), 1, 100, 30);
  const before = Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER);
  const memberFilter = me.role === 'driver' ? me.id : url.searchParams.get('member');
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.member_id, m.name AS driver_name, t.started_at, t.ended_at, t.distance_m, t.max_speed_mps,
            t.phone_events, t.passenger
     FROM trips t JOIN members m ON m.id = t.member_id
     WHERE t.family_id = ? AND t.started_at < ? AND (? IS NULL OR t.member_id = ?)
     ORDER BY t.started_at DESC LIMIT ?`,
  )
    .bind(me.family_id, before, memberFilter, memberFilter, limit)
    .all();
  return json({ trips: results });
}

async function getTrip(id: string, env: Env, me: Member): Promise<Response> {
  const trip = await env.DB.prepare(
    `SELECT t.*, m.name AS driver_name FROM trips t JOIN members m ON m.id = t.member_id
     WHERE t.id = ? AND t.family_id = ? AND (? = 'parent' OR t.member_id = ?)`,
  )
    .bind(id, me.family_id, me.role, me.id)
    .first();
  if (!trip) throw new HttpError(404, 'Not found.');
  await track(env, me, 'trip_viewed');
  const [{ results: points }, { results: events }] = await Promise.all([
    env.DB.prepare('SELECT t, lat, lng, speed_mps FROM points WHERE trip_id = ? ORDER BY t LIMIT 10000').bind(id).all(),
    env.DB.prepare('SELECT id, type, t, lat, lng, speed_mps, detail FROM events WHERE trip_id = ? ORDER BY t')
      .bind(id)
      .all(),
  ]);
  return json({ trip, points, events });
}

async function listEvents(url: URL, env: Env, me: Member): Promise<Response> {
  const limit = clampInt(Number(url.searchParams.get('limit') ?? 50), 1, 200, 50);
  const before = Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER);
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.member_id, m.name AS driver_name, e.trip_id, e.type, e.t, e.lat, e.lng, e.speed_mps, e.detail
     FROM events e JOIN members m ON m.id = e.member_id
     WHERE e.family_id = ? AND e.t < ? AND e.type NOT IN ('trip_start', 'trip_end')
       AND (? = 'parent' OR e.member_id = ?)
     ORDER BY e.t DESC LIMIT ?`,
  )
    .bind(me.family_id, before, me.role, me.id, limit)
    .all();
  return json({ events: results });
}

async function markPassenger(req: Request, id: string, env: Env, me: Member): Promise<Response> {
  requireRealFamily(me);
  const b = await body<{ passenger?: boolean }>(req);
  const res = await env.DB.prepare(
    `UPDATE trips SET passenger = ? WHERE id = ? AND family_id = ? AND (? = 'parent' OR member_id = ?)`,
  )
    .bind(b.passenger ? 1 : 0, id, me.family_id, me.role, me.id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Not found.');
  await track(env, me, 'passenger_marked', b.passenger ? 'on' : 'off');
  return json({ ok: true });
}

// ---- Every 5 minutes ----

export async function checkQuietPhones(env: Env, now: number): Promise<void> {
  // A drive is open but the phone went quiet: tell the parents once.
  const { results: quiet } = await env.DB.prepare(
    `SELECT id, family_id, role, name, active_trip_id, last_lat, last_lng FROM members
     WHERE role = 'driver' AND active_trip_id IS NOT NULL AND last_seen_at < ? AND signal_lost_alerted_at IS NULL`,
  )
    .bind(now - SIGNAL_LOST_AFTER_MS)
    .all<Member & { active_trip_id: string; last_lat: number | null; last_lng: number | null }>();
  for (const m of quiet) {
    await env.DB.prepare('UPDATE members SET signal_lost_alerted_at = ? WHERE id = ?').bind(now, m.id).run();
    await recordEvent(env, m, await rulesFor(env, m.family_id), {
      id: newId(),
      tripId: m.active_trip_id,
      type: 'signal_lost',
      t: now,
      lat: m.last_lat,
      lng: m.last_lng,
      speedMps: null,
    });
  }

  // Close drives that have been silent for hours so they don't stay "open".
  await env.DB.prepare(
    `UPDATE trips SET ended_at = COALESCE((SELECT MAX(t) FROM points WHERE trip_id = trips.id), started_at)
     WHERE ended_at IS NULL AND member_id IN (SELECT id FROM members WHERE last_seen_at < ?)`,
  )
    .bind(now - CLOSE_STALE_TRIP_AFTER_MS)
    .run();
  await env.DB.prepare(
    `UPDATE members SET active_trip_id = NULL
     WHERE active_trip_id IS NOT NULL AND active_trip_id IN (SELECT id FROM trips WHERE ended_at IS NOT NULL)`,
  ).run();
}

// ---- Once a day ----

export function isDailyRun(scheduledTime: number): boolean {
  const d = new Date(scheduledTime);
  return d.getUTCHours() === 7 && d.getUTCMinutes() < 5;
}

/**
 * Deletes GPS points from drives that started more than 90 days ago (a minor's
 * location; Doug's rule 2026-10-01). Trip summaries and alerts are kept. Goes
 * through trips so it uses the points primary key instead of scanning every
 * point. The sample family is left alone.
 */
export async function deleteOldRoutes(env: Env, now: number): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM points WHERE trip_id IN
       (SELECT id FROM trips WHERE started_at < ? AND family_id NOT LIKE 'demo-%')`,
  )
    .bind(now - ROUTE_RETENTION_MS)
    .run();
}
