# The P5 acceptance measurement on Cloudflare (P5 PR 13)

Measured on 2026-11-19 with `apps/bench` against the Pages project `nekotype-bench`: the real application of `apps/api` at commit 753df9f (the last pull request of the phase, #175) on the year-long row of [ADR 078](../adr/078-user-stats-targeted-updates.md), signed in with a seeded session. The method is that of [the PR 5 note](2026-11-18-p5-sync-endpoint.md): `cpuTime` from `wrangler pages deployment tail`, a whole number of milliseconds; cold is the first request after each of 5 deployments, warm 50 requests to the last one. The pass line is [ADR 086](../adr/086-sync-endpoint-cpu-line.md) for CPU and the acceptance of P5 in [phases.md](../spec/phases.md) for D1.

## What changed in the method since PR 5

- **Every statement is counted.** The database binding is wrapped in `countingDb` of the API tests, so the statements include the session lookup and every statement run outside `batch()`. PR 5 counted the statements of `batch()` only.
- **Results are new on every request.** The ids of the results come from a seed that changes with `seq`. In PR 5 every request carried the same 50 ids, so only the first one inserted rows and the warm figures of `results` timed the duplicate path.
- **Two more batches.** `finished` is one finished test of 60 seconds: one result, the typing counters, 20 kana statistics and newer settings (the user has a settings row, as after any first sync). `largest` is the caps of the learning delta (both tracks, every kana, the cap of days) with 50 results and their kana statistics in one batch: the largest body the schema accepts.

## Result

| request    | cold cpuTime (ms)  | warm median | warm p95 | warm max | statements | rows read | rows written |
| ---------- | ------------------ | ----------- | -------- | -------- | ---------- | --------- | ------------ |
| `learning` | 21, 22, 33, 22, 15 | 6           | 20       | 24       | 6          | 5         | 1            |
| `capped`   | 27, 45, 38, 28, 34 | 9           | 20       | 29       | 6          | 5         | 1            |
| `results`  | 20, 19, 21, 21, 16 | 6           | 20       | 29       | 4          | 52        | 151          |
| `finished` | 18, 37, 16, 18, 27 | 4           | 9        | 18       | 5          | 4         | 5            |
| `largest`  | 32, 51, 26, 53, 48 | 12          | 27       | 45       | 7          | 55        | 151          |

Statements and rows were the same on every request of a kind. Each acknowledgement was 27 bytes. All 275 requests were answered `200`. The tail reported an event, with the outcome `ok`, for 255 of them; it missed 4 warm requests of each kind, always at the same places in the run. The warm figures are those 46 events. None of the 275 was answered with error 1102.

## Against the lines

| Item                                                   | Line                         | Measured                               | Pass |
| ------------------------------------------------------ | ---------------------------- | -------------------------------------- | ---- |
| 13: CPU of a learning sync                             | warm median ≤ 8 ms (ADR 086) | 6 ms                                   | yes  |
| 13: CPU of 50 results on the year-long row             | warm median ≤ 8 ms           | 6 ms                                   | yes  |
| 13: CPU at the caps                                    | warm median ≤ 12 ms          | 9 ms                                   | yes  |
| 13: no request cut off                                 | no error 1102, outcome `ok`  | all `200`; every reported outcome `ok` | yes  |
| Learning sync reads                                    | ≤ 250 rows (ADR 086)         | 5                                      | yes  |
| 12: one finished test                                  | ≤ 6 rows written             | 5                                      | yes  |
| 16: a sync with only learning progress                 | ≤ 2 rows written             | 1                                      | yes  |
| 18: D1 queries of the largest batch                    | ≤ 50                         | 7                                      | yes  |
| Cold requests and the warm p95 (recorded, do not gate) | —                            | cold 15–53 ms, warm p95 9–27 ms        | —    |

The warm medians are 2 ms under those of PR 5 for `learning` and `capped`. The `results` batch now inserts its 50 rows on every request and still has a median of 6 ms. `largest` is not a batch of ADR 086: it combines the cap batch with 50 results and has a warm median of 12 ms, the line of the cap batch. The client splits a delta by the caps (ADR 085), so a batch this large is sent only while the outbox catches up, for example after a guest with a long history signs in.

50 results write 151 rows: each result is one row plus one entry in each of its two indexes (the primary key and `results_user_time`), and the `user_stats` row adds one. That is the bound the local test asserts (`50 × 3 + 2`). The finished test writes 5 rows: the result with its two index entries, `user_stats` and `user_settings`.

## Verdict

P5 passes items 12, 13, 16 and 18 on Cloudflare. Cold requests are still over the 10 ms limit (up to 53 ms for the largest batch) and are not cut off. That is the platform's tolerance that ADR 082 relies on, observed again; the risk and the choice if error 1102 appears stay as ADR 086 records them.
