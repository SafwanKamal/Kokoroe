CREATE TABLE IF NOT EXISTS store_meta (
  key TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  counter INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_room_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_avatar_selections (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  avatar_id TEXT NOT NULL,
  PRIMARY KEY(user_id, room_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  avatar_id TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  tone TEXT NOT NULL,
  time_label TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  is_mine BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS room_memberships (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS messages_room_created_at_idx ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);
CREATE INDEX IF NOT EXISTS room_memberships_user_id_idx ON room_memberships(user_id);
CREATE INDEX IF NOT EXISTS room_memberships_room_id_idx ON room_memberships(room_id);

INSERT INTO store_meta (key, version, counter)
VALUES ('kokoroe', 1, 0)
ON CONFLICT (key) DO NOTHING;
