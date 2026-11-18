-- The schema of docs/spec/backend.md ("D1 schema"), plus the index of p5-plan.md S1: without it,
-- linking an account by email scans `users`, and D1 counts every scanned row as a row read.

CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT, display_name TEXT, avatar_url TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX users_email ON users(email);

CREATE TABLE oauth_accounts (
  provider TEXT NOT NULL, provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (provider, provider_user_id)
);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  json TEXT NOT NULL, updated_at INTEGER NOT NULL
);

-- Typing statistics, counters, learning state, typing records and the last applied seq per device in
-- one row; the learning state is split so that its large parts are updated per key (ADR 078, 082).
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kana_stats TEXT NOT NULL, counters TEXT NOT NULL,
  learn TEXT NOT NULL,         -- unlocked, entries, stats, activeDays
  learn_recent TEXT NOT NULL,  -- kana → recent recall answers
  learn_buckets TEXT NOT NULL, -- track → day → bucket → count
  bucket_newest TEXT NOT NULL, -- track → newest day of learn_buckets
  typing_records TEXT NOT NULL, device_seq TEXT NOT NULL, last_sync_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE results (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ended_at INTEGER NOT NULL, content TEXT NOT NULL, script TEXT NOT NULL, strictness TEXT NOT NULL,
  config TEXT NOT NULL, kpm REAL NOT NULL, kana_accuracy REAL NOT NULL, json TEXT NOT NULL
);
CREATE INDEX results_user_time ON results(user_id, ended_at DESC);

CREATE TABLE content_reports (
  id TEXT PRIMARY KEY, user_id TEXT, item_id TEXT NOT NULL, content_version TEXT NOT NULL,
  reason TEXT NOT NULL, comment TEXT, created_at INTEGER NOT NULL
);
