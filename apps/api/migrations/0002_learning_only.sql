-- P6, learning only (p6-plan.md, D9; ADR 096): rewrites data and changes no schema. The code
-- deployed before this migration (P5) still reads the typing columns, so they stay until 0003.

-- The settings lose their `typing` block.
UPDATE user_settings SET json = json_remove(json, '$.typing');

-- Counters count learning sessions: the flat `{ started, finished }`. The typing columns are
-- emptied; a row of a user who never synced has both keys, so nothing here yields NULL.
UPDATE user_stats SET
  counters = json_object(
    'started', json_extract(counters, '$.started.learn'),
    'finished', json_extract(counters, '$.finished.learn')
  ),
  kana_stats = '{}',
  typing_records = '{}';

-- The typing history goes.
DELETE FROM results;
