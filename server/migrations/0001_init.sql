-- DriveWatch starting tables. Every row belongs to a family so more
-- families can join later without changing the shape.

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_speed_mph INTEGER NOT NULL DEFAULT 25,
  max_speed_mph INTEGER NOT NULL DEFAULT 80,
  created_at INTEGER NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  role TEXT NOT NULL CHECK (role IN ('parent', 'driver')),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  push_token TEXT,
  location_permission TEXT NOT NULL DEFAULT 'unknown',
  active_trip_id TEXT,
  last_seen_at INTEGER,
  last_fix_at INTEGER,
  last_lat REAL,
  last_lng REAL,
  last_speed_mps REAL,
  last_heading REAL,
  signal_lost_alerted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX members_family ON members(family_id);

CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  role TEXT NOT NULL CHECK (role IN ('parent', 'driver')),
  created_by TEXT NOT NULL REFERENCES members(id),
  expires_at INTEGER NOT NULL,
  used_by TEXT REFERENCES members(id),
  used_at INTEGER
);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  distance_m REAL NOT NULL DEFAULT 0,
  max_speed_mps REAL NOT NULL DEFAULT 0,
  phone_events INTEGER NOT NULL DEFAULT 0,
  passenger INTEGER NOT NULL DEFAULT 0,
  last_lat REAL,
  last_lng REAL
);
CREATE INDEX trips_member ON trips(member_id, started_at DESC);
CREATE INDEX trips_family ON trips(family_id, started_at DESC);

CREATE TABLE points (
  trip_id TEXT NOT NULL REFERENCES trips(id),
  t INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  speed_mps REAL,
  heading REAL,
  accuracy REAL,
  PRIMARY KEY (trip_id, t)
) WITHOUT ROWID;

-- Typed events: who, what, where, how fast, when.
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  trip_id TEXT,
  type TEXT NOT NULL,
  t INTEGER NOT NULL,
  lat REAL,
  lng REAL,
  speed_mps REAL,
  detail TEXT,
  alerted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX events_family ON events(family_id, t DESC);
CREATE INDEX events_trip ON events(trip_id, t);
