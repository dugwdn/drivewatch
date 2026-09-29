-- App use counts. Typed rows: who, which family, what action, on what, when.
-- No location and no free text, so this can be read without exposing drives.

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL CHECK (role IN ('parent', 'driver')),
  action TEXT NOT NULL,
  object TEXT,
  source TEXT NOT NULL CHECK (source IN ('app', 'server')),
  t INTEGER NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX usage_events_t ON usage_events(t);
CREATE INDEX usage_events_family_t ON usage_events(family_id, t);
