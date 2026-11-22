# CPU of sync format 3 on Cloudflare (P7 PR 7)

Measured on 2026-11-23 with `apps/bench` against the Pages project `nekotype-bench`: the real application of `apps/api` at commit 39f59e4 (P7 PR 6, #211, format 3 on the server) on a year of log. The method is that of [the P5 acceptance note](2026-11-19-p5-acceptance.md): `cpuTime` from `wrangler pages deployment tail`, a whole number of milliseconds; cold is the first request after each of 5 deployments, warm 50 requests to the last one. The pass line is [D24 of the P7 plan](../../p7-plan.md) on [ADR 086](../adr/086-sync-endpoint-cpu-line.md).

## What was measured

- **The seed:** `syntheticLog({ answers: 40_000, seed: 1 })` of another device: 43,746 events cut into 700 rows of `sync_batches` (2,059,355 bytes of log), a user, a session, a settings row, `device_seq` of the seeding device. The measured device has no `device_seq` entry; it sends `after` 700, as a device that has pulled everything. The `settings` request changes settings on every request. `SYNC_MIN_INTERVAL_MS` is 0 on the bench.
- **`session`:** one session of 30 tasks: `start`, an introduction, 29 answers, `end` (32 events, 1,744 bytes).
- **`capped`:** as many answers as the body limit allows: 5,195 events, 262,100 bytes of the 262,144.
- **`settings`:** a batch without a log, 208 bytes.
- **`pull`:** the first `GET ?after=0` page of a new device: 100 rows, 263,680 bytes. Recorded, not gated.
- Every statement of a request is counted, the session lookup included (`countingDb`).

## Result

| request    | cold cpuTime (ms)  | warm median | warm p95 | warm max | statements | rows read     | rows written | response  | not ok                   | pass     |
| ---------- | ------------------ | ----------- | -------- | -------- | ---------- | ------------- | ------------ | --------- | ------------------------ | -------- |
| `session`  | 23, 14, 15, 14, 11 | 3           | 8        | 15       | 4          | 703 (max 757) | 2            | 26 B      | 0 of 55, 4 without event | yes      |
| `capped`   | 17, 31, 23, 29, 15 | 10          | 21       | 36       | 4          | 703 (max 757) | 2            | 26 B      | 0 of 55, 4 without event | yes      |
| `settings` | 9, 19, 9, 11, 9    | 2           | 4        | 9        | 4          | 1 (max 2)     | 1 (max 2)    | 26 B      | 0 of 55, 4 without event | yes      |
| `pull`     | 21, 14, 12, 17, 13 | 6           | 12       | 28       | 3          | 102           | 0            | 263,680 B | 0 of 55, 4 without event | recorded |

All 220 requests were answered `200`. The tail reported an event, with the outcome `ok`, for 204 of them; it missed 4 warm requests of each kind, as in P5 (the warm figures are the other 46). None was answered with error 1102.

## Against the line of D24

| Item                           | Line                  | Measured                        | Pass |
| ------------------------------ | --------------------- | ------------------------------- | ---- |
| Warm median, `capped` (256 KB) | ≤ 12 ms               | 10 ms                           | yes  |
| Warm median, `session`         | ≤ 8 ms                | 3 ms                            | yes  |
| Warm median, `settings`        | ≤ 8 ms                | 2 ms                            | yes  |
| No error 1102, every outcome   | `ok`                  | all `200`, all `ok`             | yes  |
| `rows_written` of each POST    | ≤ 3                   | 2 (settings: 1, 2 at most)      | yes  |
| `pull` page                    | recorded              | warm median 6 ms, 102 rows read | —    |
| Cold requests, warm p95        | recorded, do not gate | cold 9–31 ms, warm p95 4–21 ms  | —    |

## Observation: rows read grow with the table

A batch reads 703 rows on the first request and one more on each next one (757 at the end of 55 requests). The seeded table has 700 rows, so a `POST` reads about every row of the user: the `MAX(id) + 1` of the insert is not answered from the end of the primary key. D24 gates no read count and the free tier allows 5 million rows read a day, so this passes; but the cost grows by one row per batch for the life of an account. If it matters, the candidate is a counter in `user_stats` instead of `MAX(id)`, a change of ADR 102 for the maintainer to decide.

## Verdict

Format 3 passes D24 on Cloudflare: the 256 KB batch has a warm median of 10 ms against 12, the session and settings batches 3 and 2 ms against 8, a `POST` writes at most 2 rows, and no request was cut off.

## Run summary

```json
[
  {
    "kind": "session",
    "cold": [23, 14, 15, 14, 11],
    "warmCpu": [
      3,
      3,
      2,
      2,
      2,
      2,
      3,
      2,
      4,
      3,
      null,
      8,
      2,
      2,
      2,
      2,
      1,
      1,
      2,
      2,
      2,
      2,
      null,
      15,
      4,
      3,
      3,
      4,
      4,
      5,
      6,
      4,
      4,
      5,
      null,
      2,
      2,
      3,
      2,
      2,
      11,
      3,
      5,
      2,
      3,
      4,
      null,
      7,
      1,
      3
    ],
    "statuses": [200],
    "outcomes": ["None", "ok"],
    "rowsWritten": [2],
    "rowsRead": [703, 757],
    "statements": [4]
  },
  {
    "kind": "capped",
    "cold": [17, 31, 23, 29, 15],
    "warmCpu": [
      8,
      12,
      7,
      8,
      6,
      7,
      6,
      9,
      5,
      8,
      null,
      36,
      12,
      20,
      10,
      12,
      13,
      13,
      13,
      16,
      11,
      10,
      null,
      11,
      10,
      11,
      9,
      10,
      12,
      9,
      14,
      8,
      12,
      8,
      null,
      29,
      14,
      21,
      8,
      8,
      7,
      7,
      8,
      8,
      10,
      12,
      null,
      9,
      6,
      6
    ],
    "statuses": [200],
    "outcomes": ["None", "ok"],
    "rowsWritten": [2],
    "rowsRead": [703, 757],
    "statements": [4]
  },
  {
    "kind": "settings",
    "cold": [9, 19, 9, 11, 9],
    "warmCpu": [
      4,
      3,
      2,
      2,
      2,
      4,
      2,
      4,
      1,
      1,
      null,
      2,
      2,
      2,
      2,
      1,
      1,
      1,
      2,
      1,
      1,
      1,
      2,
      null,
      9,
      3,
      2,
      2,
      3,
      1,
      2,
      2,
      3,
      1,
      1,
      null,
      4,
      3,
      2,
      2,
      1,
      1,
      2,
      1,
      2,
      1,
      2,
      null,
      3,
      1
    ],
    "statuses": [200],
    "outcomes": ["None", "ok"],
    "rowsWritten": [1, 2],
    "rowsRead": [1, 2],
    "statements": [4]
  },
  {
    "kind": "pull",
    "cold": [21, 14, 12, 17, 13],
    "warmCpu": [
      6,
      4,
      6,
      6,
      7,
      4,
      5,
      4,
      4,
      3,
      null,
      23,
      8,
      7,
      7,
      8,
      9,
      6,
      6,
      6,
      6,
      5,
      null,
      28,
      8,
      7,
      10,
      8,
      8,
      7,
      9,
      7,
      5,
      5,
      null,
      7,
      7,
      6,
      7,
      6,
      5,
      5,
      6,
      6,
      6,
      5,
      null,
      12,
      12,
      4
    ],
    "statuses": [200],
    "outcomes": ["None", "ok"],
    "rowsWritten": [0],
    "rowsRead": [102, 102],
    "statements": [3]
  }
]
```

The full JSON of the run (every sample) is not kept; the arrays above are the cold and warm `cpuTime` in order, `null` where the tail had no event.
