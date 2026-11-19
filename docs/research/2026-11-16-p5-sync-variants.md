# P5: three variants of the sync against the 10 ms limit

Measured on 2026-11-16 by `apps/bench` ([README](../../apps/bench/README.md)) against the Pages project `nekotype-bench` (region EEUR, Workers Free), with the method of the [first measurement](2026-11-16-p5-sync-cpu.md): 5 cold requests (the first after each of 5 fresh deployments) and 50 warm ones for every row. It is the input to the follow-up of [ADR 081](../adr/081-sync-measurement-p5.md); it decides nothing.

## Verdict

**The per-key variant removes the row cost and two thirds of the warm CPU time, and still fails the pass line of the plan.** No variant brings a cold request under 8 ms, and the warm p95 stays above it. The line itself is not reachable at the warm p95 with a margin: a handler that does nothing reads 0 ms in the median, 3 ms at p95 and 5 ms at the maximum.

| Condition of [p5-plan.md](../archive/p5-plan.md) | ADR 078 as built (this run) | `keyed`                  |
| ------------------------------------------------ | --------------------------- | ------------------------ |
| Every cold request at most 8 ms                  | Failed: 15–50 ms            | Failed: 9–23 ms          |
| Warm p95 at most 8 ms                            | Failed: 16, 31 and 14 ms    | Failed: 11, 15 and 10 ms |
| A learning sync reads at most 250 rows           | Failed: 630                 | Passed: 6                |
| Warm median (learning, capped, results), ms      | 9, 14, 8                    | 3, 6, 4                  |
| A request cut off with error 1102                | None                        | None                     |

## Variants

Chosen by `?variant=` of the bench endpoint.

- **`base`.** ADR 078 as built: the rows of the first measurement, repeated as the control of this run.
- **`ack`.** The same reads and merge; the response is `{"lastSeq", "version"}` and the `UPDATE` returns no column. It isolates the cost of the snapshot in the response.
- **`keyed`** (`apps/bench/src/apply-keyed.ts`). `ack`, and also:
  - the touched keys are read with `json_extract(column, ?, ?, …)`, one bound path per key, instead of `json_each`; a statement carries at most 98 paths (D1 allows 100 parameters);
  - `learn` is not parsed whole: `unlocked` and `activeDays` are read by path, the touched `entries` and `stats` too, and the column is written with `json_patch`;
  - `kana_stats`, `counters`, `typing_records` and `device_seq` stay whole.
- **`empty`, `floor`.** A `GET` that does not touch D1, and one that reads `version` by the key: the least a request can cost.
- **`get-recent`, `get-buckets`, `get-rest`.** A `GET` of one part of the snapshot (`learn_recent`, `learn_buckets`, everything else), for a client that asks for the snapshot only when another device wrote.

`scripts/compare-local.ts` applies the three batches to a local D1 through `base` and through `keyed`: the stored rows and the `results` table are equal.

## Results

`cpuTime` in milliseconds. A `?` is a cold request without a tail event; each warm column is of the 45–46 requests whose tail event arrived.

| Request        | Cold               | Warm median | Warm p95 | Warm max | Statements | `rows_read` | Response |
| -------------- | ------------------ | ----------- | -------- | -------- | ---------- | ----------- | -------- |
| learning       | 32, 17, 17, 19, 15 | 9           | 16       | 26       | 5          | 630         | 311 KB   |
| capped         | 22, 31, 17, 17, 50 | 14          | 31       | 42       | 6          | 1,087       | 317 KB   |
| results        | 15, 15, 16, 23, ?  | 8           | 14       | 27       | 5          | 283         | 309 KB   |
| get            | 9, 11, 6, 7, 8     | 5           | 8        | 12       | 2          | 1           | 309 KB   |
| empty          | 1, 5, 1, 2, 2      | 0           | 3        | 5        | 0          | 0           | 2 B      |
| floor          | ?, ?, 4, 7, ?      | 1           | 4        | 6        | 1          | 1           | 13 B     |
| ack-learning   | 13, 15, 12, 30, 15 | 5           | 12       | 24       | 5          | 630         | 27 B     |
| ack-capped     | 17, 23, ?, 28, 16  | 8           | 18       | 27       | 6          | 1,087       | 27 B     |
| keyed-learning | 20, 13, 17, 23, 11 | 3           | 11       | 16       | 5          | 6           | 27 B     |
| keyed-capped   | 13, 22, 17, 13, 13 | 6           | 15       | 16       | 5          | 6           | 27 B     |
| keyed-results  | 9, 10, 14, 19, 10  | 4           | 10       | 26       | 3          | 53          | 27 B     |
| get-recent     | 4, 6, 8, 4, 7      | 3           | 6        | 13       | 1          | 1           | 98 KB    |
| get-buckets    | 4, 5, 4, 7, 4      | 2           | 3        | 4        | 1          | 1           | 138 KB   |
| get-rest       | 4, 4, 4, 9, 10     | 2           | 6        | 11       | 1          | 1           | 73 KB    |

Every batch wrote 1 row as D1 reports it, as in the first measurement. Every request with a tail event had the outcome `ok`; the three cold `floor` requests without one were answered `404` before the deployment was served and are left out.

## Findings

1. **The snapshot in the response costs about 4 ms warm.** `ack` against `base`: 9 → 5 ms (learning) and 14 → 8 ms (capped) in the median.
2. **Reading by path and patching `learn` take another 2 ms off.** `keyed` against `ack`: 5 → 3 ms and 8 → 6 ms. The whole change is 9 → 3 ms for a learning sync and 14 → 6 ms for the batch at the caps.
3. **`json_extract` with bound paths is one row read per statement.** A learning sync reads 6 rows instead of 630, so the daily read budget stops being a limit. The `results` batch reads 53: the `json_each` of its `INSERT … SELECT` over the 50 results.
4. **Cold requests are not fixed by the data model.** `keyed-learning` takes 11–23 ms cold against 3 ms warm, while `empty` takes 1–5 ms cold: this points to the first run of the handler's code in a new isolate, not to the start of the isolate or the size of the data. The cause was not isolated further.
5. **The warm tail is the platform's, not the handler's.** `empty` has a p95 of 3 ms and a maximum of 5 ms; `get-recent`, which passes 98 KB through, has a maximum of 13 ms. In `keyed-learning` 42 of 46 requests take at most 5 ms and the other four take 9–16 ms. A p95 line of 8 ms leaves a typical request about 3–4 ms.
6. **The limit was never enforced.** The 770 requests of this run and the 220 of the first, 50 ms the slowest: none was answered with error 1102. O4 records that the platform tolerates a Worker that exceeds the limit infrequently and that the design does not rely on it.
7. **A `GET` by parts fits warm.** Each part takes 2–3 ms in the median; the whole row takes 5 ms.

## What the endpoint still has to solve in `keyed`

- **The 365-day window.** The variant deletes "a touched day minus 366", which is right only when the days are contiguous. The rule needs the newest stored day of the track; reading the day keys with `json_each` costs 365 rows, so the endpoint would store that day as a number.
- **Removed keys.** A merge patch merges objects key by key, so a key that the merge removes inside an entry or a `mixups` object (the decay) stays stored unless the patch names it with `null`. The local comparison did not meet the case.
- **More statements for long batches.** Three objects of 60 kana are three statements; the batch at the caps used 5 of the 50 queries.
- The real endpoint adds the session, the validation and the routing, as before.

## Options for the follow-up

The measurement narrows the choice of ADR 081 to how the limit is treated, since no model passes the line as written.

1. **`keyed`, and a pass line of the typical request.** Warm median at most 5 ms for a learning sync and no error 1102 in the measurement; cold requests and the tail are left to the platform's tolerance. A sync is idempotent by `seq`, so a request that is cut off is sent again. It changes O4, which says the design does not rely on the tolerance.
2. **Workers Paid.** The CPU limit stops mattering; it breaks the free-tier rule of the project.
3. **`keyed` with lower caps.** It lowers the batch at the caps (6 ms in the median) and does nothing for cold requests, so it is an addition to option 1, not a replacement.
