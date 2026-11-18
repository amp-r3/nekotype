# The real `/api/sync` on Cloudflare (P5 PR 5)

Measured on 2026-11-18 with `apps/bench` against the Pages project `nekotype-bench`: the real application of `apps/api` on the year-long row of [ADR 078](../adr/078-user-stats-targeted-updates.md), signed in with a seeded session. `cpuTime` is read from `wrangler pages deployment tail` and is a whole number of milliseconds. Cold: the first request after each of 5 deployments; warm: 50 requests to the last one. The decision is [ADR 086](../adr/086-sync-endpoint-cpu-line.md).

| request    | cold cpuTime (ms)        | warm median | warm p95 | warm max | statements | rows read |
| ---------- | ------------------------ | ----------- | -------- | -------- | ---------- | --------- |
| `learning` | 21, 20, 27, 31, 21       | 8           | 21       | 29       | 5          | 5         |
| `capped`   | 29, 39, 33, no event, 49 | 11          | 32       | 45       | 5          | 5         |
| `results`  | 20, 33, 31, 19, 26       | 8           | 17       | 44       | 3          | 52        |
| `get`      | 7, 13, 11, 14, 10        | 2           | 9        | 24       | 0          | 0         |
| `get-rest` | 13, 10, 10, 16, 9        | 3           | 9        | 15       | 0          | 0         |

(Statements and rows are those of `batch()` calls; the session lookup is not counted. Every measured request had the outcome `ok`; none was answered with error 1102.)

Where the time is not, measured in Node on the same data, warm: validation of the batch 0.15 ms (`learning`), 0.71 (`capped`), 0.31 (`results`); parsing the small columns 0.16 ms; their guards 0.03; the merges and serialization 0.14; `patchLearn` 0.08. A `GET` with a session and nothing else is 2 ms.
