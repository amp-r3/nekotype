-- ADR 115: the line between a good and a hard answer is the learner's pace, which the fold works
-- out from the log, so the settings lose the target answer time. The settings schema is strict,
-- and the code of this release rejects a document that still has the key.
UPDATE user_settings SET json = json_remove(json, '$.learn.targetMs');
