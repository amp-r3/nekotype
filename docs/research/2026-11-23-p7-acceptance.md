# The P7 acceptance (P7 PR 15)

Checked on 2026-11-23 against `main` at 7e03e8e, after every pull request of the [phase plan](../archive/p7-plan.md) was merged and the maintainer's production checks M2–M5 were done. The criteria are those of [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 10, in its order, as [phases.md](../spec/phases.md) lists them for P7. Each row names the test or the measurement that proves it; the numbers below come from three sources:

- **The sim** on the production model: `pnpm --filter @nekotype/sim run p7` (every part) on 7e03e8e, in Node 24; the full output is below.
- **CI** of P7 PR 12 (#220, the switch, run 45168728408 on acd390d): the latency gate (`latency.spec.ts` and `model-cost.spec.ts` in `playwright.latency.config.ts`), the browser e2e and the sync e2e. No later pull request of the phase changed `apps/web` or `packages/model`.
- **Cloudflare**: the [sync endpoint note](2026-11-23-p7-sync-endpoint.md) of PR 7 (`apps/bench` on `nekotype-bench`, since deleted).

## Against the criteria

| #   | Criterion                                                                               | Line                            | Measured                                                | Proved by                                                                                                                                                                                                       | Pass |
| --- | --------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Model and planner are pure TypeScript, time and randomness injected, browser and Worker | —                               | —                                                       | `packages/model/eslint.config.js` (restricted imports, globals and `Math.random`) and `tsconfig.json` without DOM; the tests run in Node workers; `model-cost.spec.ts` runs the same code in Chromium           | yes  |
| 2   | FSRS-6 matches ts-fsrs 6.0.0                                                            | 6 digits                        | equal on both reference histories                       | `packages/model/src/fsrs.test.ts`                                                                                                                                                                               | yes  |
| 3   | `packages/sim` runs A4 from the production code                                         | —                               | —                                                       | `packages/sim/src/policies/production.ts` and its test (every sim item maps to its key); `p7.ts` runs no research planner for its numbers                                                                       | yes  |
| 4   | The beginner reads the 46 basic hiragana by day 8 (median)                              | ≤ day 8                         | day 7 (6–8)                                             | `PART=main` of `p7`                                                                                                                                                                                             | yes  |
| 5   | Review retention at least 90%                                                           | ≥ 90.0%                         | 94.6% (94.0–95.1)                                       | `PART=main` of `p7`                                                                                                                                                                                             | yes  |
| 6   | At most 10 minutes a day over days 1–14                                                 | ≤ 10.0                          | 8.2 (7.8–8.8)                                           | `PART=main` of `p7`                                                                                                                                                                                             | yes  |
| 7   | Slow learners of part 3 within 2 points                                                 | 87.6–91.6, 84.7–88.7, 91.9–95.9 | 89.2%, 86.6%, 93.5%                                     | `PART=planner` of `p7` (`recallGain ×0.5`, `gainExponent ×1.5`, `lapseKeep ×0.5`)                                                                                                                               | yes  |
| 8   | The state is a pure function of the log; devices converge                               | —                               | 200 seeded logs of 2–3 devices                          | `packages/model/src/fold.properties.test.ts`: any order of delivery with repeats, incremental apply against `foldLog`, devices exchanging batches with 30% failed syncs; the statistics converge with the state | yes  |
| 9   | Every row of point 4 tested on synthetic answers                                        | —                               | 10 task types, correct and wrong                        | `packages/model/src/grade.test.ts`, `fold.test.ts`                                                                                                                                                              | yes  |
| 10  | A sync writes at most 3 rows, indexes included                                          | ≤ 3                             | locally ≤ 3 with settings, 2 without; Cloudflare 2      | `apps/api/src/routes/sync-log.test.ts` (counting wrapper); the bench's `rows_written`                                                                                                                           | yes  |
| 11  | `POST /api/sync` with 256 KB within ADR 086's line                                      | warm median ≤ 12 ms             | 10 ms; no error 1102                                    | the [sync endpoint note](2026-11-23-p7-sync-endpoint.md)                                                                                                                                                        | yes  |
| 12  | Sync e2e: two devices, one offline for a while                                          | —                               | CI job `e2e-sync` passed                                | `apps/web/e2e/sync/two-devices.spec.ts`                                                                                                                                                                         | yes  |
| 13  | Fold of 40,000 answers on both tracks, Chromium 4×                                      | median ≤ 100 ms                 | 64.9 ms (85.1, 80.4, 63.2, 64.9, 61.9)                  | `apps/web/e2e/model-cost.spec.ts`, CI job `latency`                                                                                                                                                             | yes  |
| 14  | Forecast at the same slowdown                                                           | median ≤ 200 ms                 | 131.8 ms (146.2, 131.8, 129.4, 124.4, 141.5)            | `apps/web/e2e/model-cost.spec.ts`, CI job `latency`                                                                                                                                                             | yes  |
| 15  | Neither in a keystroke handler; hot path, budgets and latency hold                      | budgets of `quality.md`         | work p95 2.7 ms, frame p95 16.8 ms; initial JS 30.38 KB | `pages/learn/model/session.test.ts` ("calls nothing of the store inside a key handler"), `session-screen.test.tsx` (0 renders, 1 at most), `check-budget.mjs` (the `model` chunk), `latency.spec.ts` in CI      | yes  |
| 16  | Forecast of the next row off by at most 1 session (median), reference learner           | ≤ 1                             | 1 (signed 0 after the correction)                       | `PART=forecast` of `p7`                                                                                                                                                                                         | yes  |
| 17  | The spec describes the model, the log and the screens of P7                             | —                               | —                                                       | S1–S12 of the plan in PRs 206–224 and PR 15; the leftovers audit of PR 15                                                                                                                                       | yes  |

The latency gate on #220 measured two sessions of 30 tasks, 115 keys: work p95 2.70 ms (budget 8, max 3.50, ceiling 25), frame p95 16.80 ms (budget 33.3, max 19.70, ceiling 50). The budgets of the closing tree are the "End of P7" column of [Budgets and quality](../spec/quality.md#budgets).

## The sim on the production model

```
## Main table

50 seeds, 60 days.

| policy | learner | reads 46 basic, day | reads 104, day | unlocked 46, day | unlocked by day 7 | review retention | next-day recall of a new kana | min/day, days 1–14 | reviews |
| production model | beginner | 7 (6–8), 100% | 13 (11–15), 100% | 6 (4–7), 100% | 61 (51–74) | 94.6 (94.0–95.1)% | 48 (40–56)% | 8.2 (7.8–8.8) | 1534 |
| production model | knower | 1 (1–1), 100% | 1 (1–1), 100% | 2 (2–3), 100% | 104 (104–104) | 99.5 (99.1–99.9)% | 99 (98–100)% | 4.1 (3.9–4.5) | 744 |
| production model | forgot | 3 (3–4), 100% | 6 (6–8), 100% | 2 (2–3), 100% | 104 (104–104) | 98.8 (98.3–99.3)% | 99 (97–100)% | 4.1 (4.0–4.7) | 770 |

## Planner

The beginner, 30 seeds, 30 days. Cells: day the basic 46 are read / review retention / min a day (medians).

| reference learner | A4, research policy | production model |
| reference | 7 / 94.4% / 8.3 | 7 / 94.3% / 8.1 |
| recallGain ×0.5 | 15 / 89.4% / 9.8 | 15 / 89.2% / 9.7 |
| gainExponent ×1.5 | >30 / 86.6% / 9.7 | >30 / 86.6% / 9.7 |
| lapseKeep ×0.5 | 8 / 93.6% / 8.9 | 8 / 93.5% / 8.8 |
| recallGain ×1.5 | 6 / 96.2% / 6.9 | 6 / 95.8% / 6.7 |

## Forecast

The production model's forecast of the next row, 20 seeds, 30 days, made at the first session of each day.
Cells: median |error| in sessions / median signed error / within ±1 / within ±25% / actual inside the 10–90% range.

| learner | target | forward, observed | forward, corrected |
| reference | next row | 1 / -1 / 58% / 40% / — | 1 / 0 / 58% / 41% / 53% |
| recallGain ×0.5 | next row | 5 / -4 / 15% / 11% / — | 3 / 0 / 30% / 33% / 48% |

## Cost

foldLog of 43746 events (40,000 answers, both tracks) in Node: 32.9, 35.9, 27.9, 26.0, 26.9 ms (median 27.9).
```

The production model reproduces the research policy A4 of part 3 within 0.4 points of retention and 0.2 minutes a day on every learner. The known differences ([plan, D6](../archive/p7-plan.md#d6-the-planner)) are the `previous` fallback, local days, introductions from the selected track only and the sim's options; none moves a figure past its line.

## What the numbers do not show

- **The slow learner's forecast.** For `recallGain ×0.5` the forecast is off by 5 sessions before the correction and 3 after it. The criterion is set on the reference learner only; [part 4](2026-11-21-p7-knowledge-model-part-4.md) measured the same learner at 3 sessions after the correction, which needs a history of settled forecasts on the device. That history has no format until P8 shows the forecast.
- **Real learners.** The sim's learner is an assumption. The risk that real learners gain less from reviews within a sitting ([part 5](2026-11-21-p7-knowledge-model-part-5.md#what-this-means-for-adr-100)) shows only in `observed` after the release; the first lever stays `RETENTION` = 0.93, by an ADR with a sim run.
- **Cold requests.** As in P5, cold requests on Cloudflare take 9–31 ms of CPU and are not cut off; ADR 086 records the risk.

## Verdict

P7 meets the 17 criteria of ADR 100, point 10.
