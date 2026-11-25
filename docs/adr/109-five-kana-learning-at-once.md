# ADR 109: Five Kana Learning at Once, So a Row of Five Opens Whole

- **Status:** In force.
- **Context:**
  - [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), point 2, introduces a new kana when fewer than 4 kana are learning; pressure lowers the limit from 4 towards 1 (`learningLimit`, `round(LEARN_MAX − p × (LEARN_MAX − 1))`, at least 1). The constant is `LEARN_MAX` in `packages/model/src/constants.ts`, simulated for candidate A4 in the P7 research.
  - Most basic rows hold five kana (the vowels, k, s, t, n, h, m, r). With 4, a first session introduces あ い う え and leaves お until one of them is learned, so the first row a learner meets opens in two steps. P8 shows the learner the path by rows ([ADR 108](108-p8-design-export.md), point 1: `next: the vowels`), and the maintainer asked on 2026-11-24 that a row of five open in one go.
  - A model constant changes only with a run of `pnpm --filter @nekotype/sim run p7` and the maintainer's consent (P7 plan, rule 3b); rule 3c of [p8-plan.md](../archive/p8-plan.md) keeps it out of the phase's pull requests, so this is a pull request of its own before P8 PR 1. The maintainer gave the consent on 2026-11-24.
- **Decision:**
  1. `LEARN_MAX` is 5: the planner introduces a new kana when fewer than 5 kana are learning. A first session introduces あ い う え お one after another.
  2. Pressure works as before on the new maximum: the limit is `max(1, round(5 − 4p))`, so 5 at no pressure, 3 at `p` = 0.4 and 0.5, 1 at full pressure.
  3. Nothing else of the model changes. The research policy A4 in `packages/sim` (`PLANNER.learnMax`) stays at 4, so parts 1–5 still reproduce; the `p7` tables run on the production model.
- **Justification:** the `p7` script on the production model, before (4) and after (5), in Node 24 on the same tree:

  | Measure (criterion of ADR 100, point 10)                                            | Line                            | `LEARN_MAX` = 4   | `LEARN_MAX` = 5   |
  | ----------------------------------------------------------------------------------- | ------------------------------- | ----------------- | ----------------- |
  | Beginner reads the 46 basic hiragana, day (median, 10–90%)                          | ≤ 8                             | 7 (6–8)           | 7 (6–8)           |
  | Beginner unlocks the 46 basic, day                                                  | —                               | 6 (4–7)           | 5 (5–7)           |
  | Review retention                                                                    | ≥ 90.0%                         | 94.6 (94.0–95.1)% | 95.2 (94.6–95.7)% |
  | Next-day recall of a new kana                                                       | —                               | 48 (40–56)%       | 44 (38–51)%       |
  | Minutes a day, days 1–14                                                            | ≤ 10.0                          | 8.2 (7.8–8.8)     | 8.2 (7.8–8.7)     |
  | Slow learners (`recallGain ×0.5`, `gainExponent ×1.5`, `lapseKeep ×0.5`), retention | 87.6–91.6, 84.7–88.7, 91.9–95.9 | 89.2, 86.6, 93.5  | 89.8, 87.0, 93.8  |
  | Forecast of the next row, reference learner, median \|error\| (corrected)           | ≤ 1 session                     | 1 (signed 0)      | 1 (signed 0)      |

  Every criterion still holds, and none moves by more than 0.6 points. The basic 46 are introduced a day earlier (median day 5 against 6) and read on the same day; the fifth learning kana spreads the steps a little thinner, so the next-day recall of a new kana falls by 4 points, while review retention rises by 0.6 points and the time a day stays the same. The forecast within ±1 session rose from 58% to 63%. The full output is in the pull request.

- **Rejected alternatives:**
  - _Keep 4 and let the vowels open in two steps:_ the path names the vowels as one step, and the first session would end with one of them still locked.
  - _A limit per row (introduce the whole row, whatever its size):_ the yōon and the voiced rows differ in size, and the planner would need a rule the sim has not measured; 5 covers every basic row but y (3) and w_n (3), which already fit.
  - _6 or more:_ more learning kana at once thin the steps further with no row to complete; not simulated.
- **Consequences:**
  - [learning.md](../spec/learning.md) (Unlocking, Memory, Constants) and A47 in [decisions.md](../spec/decisions.md) say 5. ADR 100 gets a Status line.
  - Tests: `learner.test.ts` (the limit 5, 3, 1), `planner.test.ts` (introductions stop at five), `forecast.test.ts` (the outline of an empty log: 2 reviews, 22 learning tasks, 6 introductions), `index.test.ts` (the exported constants); in `apps/web`, `session.test.ts` checks that a first session introduces the five vowels in a row, and the confusion test takes the seed 1, since its seed 2 drew no recognition of あ in a session with five learning kana.
  - Before P14 nobody but the maintainer uses production ([ADR 061](061-schema-reset-before-release.md)); the log is not touched, and a fold of an existing log simply allows one more learning kana from the next task on.
