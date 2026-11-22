-- One row per accepted batch of sync format 3 (ADR 100, point 7). WITHOUT ROWID: the primary key is
-- the table, so an insert writes one row and no index row.
CREATE TABLE sync_batches (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id INTEGER NOT NULL,     -- per user, increasing: the user's MAX(id) + 1
  device_id TEXT NOT NULL, -- the sync deviceId of the batch
  seq INTEGER NOT NULL,
  log TEXT NOT NULL,       -- the batch's LogPage, as JSON
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
) WITHOUT ROWID;
