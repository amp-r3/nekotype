# The knowledge model

Part of the [architecture description](README.md) of the current code. [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md) decides the model; [ADR 101](../adr/101-model-package.md) its package. After P7 PR 1 the package holds FSRS-6, the kana items and the grade table. The fold, the planner, the statistics and the forecast are added by the next pull requests; nothing in `apps/web` imports the package yet.

## The package

`packages/model` (`@nekotype/model`) is consumed as source, like the engine. Entry points: `.` and `./testing` (event builders for tests: `intro`, `answer`, `start`, `end`). It runs in the browser, in a Worker and in Node (`packages/sim`). Lint enforces it: relative imports, `@nekotype/engine` and types of `@nekotype/shared/types` only; no `window`, `document`, `navigator`, storage, `fetch`, timers or `Date`; no `Math.random`. Time is passed as numbers and randomness as `Rng`. Coverage thresholds: 95% statements, functions and lines, 90% branches.

| File           | Holds                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts` | The constants of candidate A4, as simulated; a change needs a `sim` run and the maintainer's consent                                          |
| `fsrs.ts`      | FSRS-6 with the default weights (moved from `packages/sim`), `Memory`, `Grade`, `intervalFactor`                                              |
| `items.ts`     | `ITEMS`: the 229 kana of both tracks with row, category, `index` in the track, `parts` and `pair`; `trackItems`, `trackRows`, `kanaOfReading` |
| `grade.ts`     | `effectsOf(answer, targetMs, learned)`: the table of ADR 100, point 4, as memory updates and confusion changes; a grade is never stored       |

## FSRS-6

`createFsrs(weights)` gives `retrievability`, `intervalFor`, `firstMemory` and `nextMemory`; the default instance is exported. A review on the same day (`sameDay`) uses the short-term formula. `fsrs.test.ts` checks it against `FSRS6Algorithm` of ts-fsrs 6.0.0 (a dev dependency): to 6 digits on steps a day or more apart and same-day steps, to 5 digits on a history with gaps of minutes, because ts-fsrs rounds the recall probability to 8 digits and that moves a stability by about 4e-7 a step. `intervalFactor(retention)` is `intervalFor(1, retention)`.

## Items and grades

Items are derived from `kanaRows` of the engine and keyed as the app keys them (`hiragana:か`). `parts` follow [Learning](../spec/learning.md#unlocking) (が → か, きゃ → き and や, ヴァ → ヴ and ア, ヴ → ウ); `pair` links a katakana and its hiragana both ways.

`effectsOf` returns `grade` effects (`main`: the kana asked, whose phase follows; credit and pair reviews are not main) and `confusion` effects. Easy is never given. The log event types (`LogEvent` and its parts) are in `packages/shared/src/types.ts`.
