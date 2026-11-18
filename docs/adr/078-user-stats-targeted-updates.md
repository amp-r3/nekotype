# ADR 078: `user_stats` Updated per Touched Key

- **Status:** In force. Amended by [ADR 082](082-sync-acknowledgement-without-snapshot.md): reads by `json_extract` paths instead of `json_each`, `learn` updated per key, no snapshot in the response (points 2–4).
- **Context:** `backend.md` keeps all statistics of a user in one `user_stats` row of JSON columns, and `POST /api/sync` parsed the row, merged the batch and wrote the row back whole. Before P5 the handler was benchmarked with the merge functions of `shared/runtime` on a year of daily learning on both tracks (229 kana with 10 recall answers each, 365 days of answer-time buckets per track with about 25 buckets a day), in Node 24 on a desktop CPU:
  - the `learn` column is about 300 KB, not the 200 KB the spec estimated: about 140 KB of buckets and 95 KB of recent answers; the whole row is about 350 KB;
  - a learning sync (30 kana, no results) takes 7.9 ms in the median, 13.6 ms at p95 and 15 ms in a cold isolate;
  - a batch of 200 results takes 10.4 ms warm and 24 ms cold;
  - most of the time is `JSON.parse` and `JSON.stringify` of the whole row (4–5 ms) and `addBuckets`, which rebuilds the whole year to add one day (2 ms).

  The Free plan allows 10 ms of CPU per request ([decisions.md](../spec/decisions.md), O4). The cost grows with the user's history, so the most frequent request would cross the limit for the most active learners.

- **Decision:**
  1. The learning state is stored in three columns: `learn` (`unlocked`, `entries`, `stats`, `activeDays`), `learn_recent` (kana → recent recall answers) and `learn_buckets` (track → day → bucket → count).
  2. The worker never parses `learn_recent` or `learn_buckets` whole. It reads only the keys the batch touches, with `json_each` filtered by one bound parameter that holds the JSON array of keys, so a batch of any size stays within D1's 100 parameters per query. It merges those keys with the pure functions of `shared/runtime` and writes them back with `SET col = json_patch(col, ?)`, one JSON Merge Patch (RFC 7396) per column. A `null` in the patch deletes a key: the bucket days that fall more than 365 days behind the newest day of a track are deleted this way, found with a `json_each` over that track's day keys.
  3. The small columns (`learn`, `kana_stats`, `counters`, `typing_records`, `device_seq`) are still parsed, merged and written whole.
  4. The `UPDATE` returns the new column values (`RETURNING`), and the response snapshot is assembled by concatenating those strings, so the response is not parsed and serialized again.
  5. Optimistic concurrency on `version` (A26) is unchanged, and the update of `user_stats` stays one statement, so the row budget is unchanged.
  6. A batch carries at most 50 results instead of 200, and they are inserted by one statement, `INSERT OR IGNORE INTO results … SELECT … FROM json_each(?)`. The Free plan allows 50 D1 queries per invocation and every statement of `batch()` counts, so one `INSERT` per result would not fit even 50 results.
- **Justification:** The CPU cost of a sync depends on the size of the batch, not on the history: the history is processed by SQLite inside D1, whose query time is not the worker's CPU time. The merge rules stay pure functions with their property tests; the server only applies them to fewer keys. At 50 results the largest batch costs about a quarter of the 200-result case, and catch-up batches are rare (a guest's first sign-in, a long offline period).
- **Consequences:**
  - An equivalence test: for any stored state and batch, the per-key patch applied to the stored columns gives the same state as the full merge.
  - The first P5 pull request deploys a minimal Pages Function with a year-long row to a test project and measures CPU time (`wrangler pages deployment tail`) in a cold and a warm isolate, and `rows_read` and `rows_written` from D1's `meta`. The documentation does not say how `json_each` counts toward rows read; if the measurement shows a cost that the daily budget cannot carry, or CPU still above the limit, this ADR gets a follow-up before the sync endpoint is written.
  - The client keeps the whole state in IndexedDB and merges it whole to build the local view; it has no CPU limit, and the snapshot it receives has the same shape as before.
  - A guest with 1,000 results needs 20 batches 5 seconds apart instead of 5.
