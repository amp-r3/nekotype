-- P6, learning only (p6-plan.md, D9; ADR 096): drops what 0002 emptied. The code deployed before
-- this migration (PR 4) neither reads nor writes these, except that creating a user still inserts
-- '{}' into the two columns; only a first sign-in in the minutes before the deploy meets this.

-- The typing history; its index goes with the table.
DROP TABLE results;

ALTER TABLE user_stats DROP COLUMN kana_stats;
ALTER TABLE user_stats DROP COLUMN typing_records;
