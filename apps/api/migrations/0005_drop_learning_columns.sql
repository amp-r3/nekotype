-- Sync format 2 left the server in P7 PR 13 and nothing reads or writes these columns any more:
-- the learning state is a fold of the log in `sync_batches` (ADR 100). What is left of `user_stats`
-- is `user_id`, `device_seq`, `last_sync_at` and `version`.
ALTER TABLE user_stats DROP COLUMN counters;
ALTER TABLE user_stats DROP COLUMN learn;
ALTER TABLE user_stats DROP COLUMN learn_recent;
ALTER TABLE user_stats DROP COLUMN learn_buckets;
ALTER TABLE user_stats DROP COLUMN bucket_newest;
