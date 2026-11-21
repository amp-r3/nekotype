# The knowledge model

Part of the [architecture description](README.md) of the current code. [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md) decides the model; [ADR 101](../adr/101-model-package.md) its package. After P7 PR 2 the package holds FSRS-6, the kana items, the grade table and the fold. The planner, the statistics and the forecast are added by the next pull requests; nothing in `apps/web` imports the package yet.

## The package

`packages/model` (`@nekotype/model`) is consumed as source, like the engine. Entry points: `.` and `./testing` (event builders for tests: `intro`, `answer`, `start`, `end`). It runs in the browser, in a Worker and in Node (`packages/sim`). Lint enforces it: relative imports, `@nekotype/engine` and types of `@nekotype/shared/types` only; no `window`, `document`, `navigator`, storage, `fetch`, timers or `Date`; no `Math.random`. Time is passed as numbers and randomness as `Rng`. Coverage thresholds: 95% statements, functions and lines, 90% branches.

| File           | Holds                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts` | The constants of candidate A4, as simulated; a change needs a `sim` run and the maintainer's consent                                           |
| `fsrs.ts`      | FSRS-6 with the default weights (moved from `packages/sim`), `Memory`, `Grade`, `intervalFactor`                                               |
| `items.ts`     | `ITEMS`: the 229 kana of both tracks with row, category, `index` in the track, `parts` and `pair`; `trackItems`, `trackRows`, `kanaOfReading`  |
| `order.ts`     | `compareEvents` (by `at`, `dev`, `n`), `eventKey` (`dev:n`), `localDay(at, tz)` in plain arithmetic (no `Date`)                                |
| `learner.ts`   | The learner values of candidate A4 over the state: `pressure`, `requestedRetention`, `learningLimit`, `recallsToLearn`, `horizonMs`, `dueFrom` |
| `fold.ts`      | `createFold`, `foldLog`: the state as a fold of the log (below)                                                                                |
| `grade.ts`     | `effectsOf(answer, targetMs, learned)`: the table of ADR 100, point 4, as memory updates and confusion changes; a grade is never stored        |

## FSRS-6

`createFsrs(weights)` gives `retrievability`, `intervalFor`, `firstMemory` and `nextMemory`; the default instance is exported. A review on the same day (`sameDay`) uses the short-term formula. `fsrs.test.ts` checks it against `FSRS6Algorithm` of ts-fsrs 6.0.0 (a dev dependency): to 6 digits on steps a day or more apart and same-day steps, to 5 digits on a history with gaps of minutes, because ts-fsrs rounds the recall probability to 8 digits and that moves a stability by about 4e-7 a step. `intervalFactor(retention)` is `intervalFor(1, retention)`.

## Items and grades

Items are derived from `kanaRows` of the engine and keyed as the app keys them (`hiragana:か`). `parts` follow [Learning](../spec/learning.md#unlocking) (が → か, きゃ → き and や, ヴァ → ヴ and ア, ヴ → ウ); `pair` links a katakana and its hiragana both ways.

`effectsOf` returns `grade` effects (`main`: the kana asked, whose phase follows; credit and pair reviews are not main) and `confusion` effects. Easy is never given. The log event types (`LogEvent` and its parts) are in `packages/shared/src/types.ts`.

## The fold

The state is never stored, synced or migrated: it is `foldLog(events, { targetMs })`, or a `Fold` that takes events one by one with `apply`. The result of `foldLog` depends on the set of events only: it drops repeated `dev:n`, sorts by `compareEvents` and applies. `apply` takes an event that sorts after the last one applied and returns `applied`; a key seen before gives `duplicate`, an earlier position `out-of-order`, and in both cases nothing changes (the caller folds the whole log again on `out-of-order`).

`ModelState` holds `items` (phase, FSRS-6 memory, `lastAt`, `lastDay`, `streak`, `lastTask` per kana), `learner` (task count, gaps, sittings, task intervals, `observed`, the last 200 outcomes, the `tz` of each device), `confusions` (asked → given → count above 0) and `targetMs`. `fold.state` is live and valid until the next `apply`; `snapshot()` copies the maps and lists, so a later `apply` does not change it; `clone()` gives an independent fold.

Each event is applied by the rules of D5 in the P7 plan: an event with an unknown kana is counted in `ignored` and skipped; a session start sets the device's zone; an introduction of a kana that is not new is ignored; an answer on a new kana introduces it first. A review is a `recall` on a kana that is learned before the answer; only reviews move `observed`. The same-day formula follows the local day of the writing device (`tz` of its last session start, 0 without one). A word answer has no outcome of its own (it is not on one kana) and grades the learned kana of its reading. Statistics (`stats` of the fold) come with PR 4.

`fold.properties.test.ts` runs 200 seeded logs of 2–3 devices: any order of delivery with repeats, incremental `apply`, and devices exchanging batches with 30% failed syncs all end in the snapshot of one `foldLog` of every event.
