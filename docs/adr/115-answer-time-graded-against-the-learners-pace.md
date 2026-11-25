# ADR 115: Answer Time Graded Against the Learner's Own Pace per Device, Not a Target Setting

- **Status:** In force.
- **Context:**
  - A48 and [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), point 4, grade a correct recall good within the target answer time `settings.learn.targetMs` (1500 ms by default, 1000–3000 on `/settings`) and hard when slower or with a hint. Build, fluency and dictation use the same line.
  - The [adaptive answer-time note](../research/2026-11-25-adaptive-answer-time.md) simulated the production model with learners of different typing speeds, a phone, practice, distractions and a weaker link of time to memory. Its findings:
    - **The outcome depends on the share of hard grades, not on which answers get them.** An adaptive line gives the same results as a placebo that marks the same share hard at random. An oracle that knows the true recall probability gains under one kana of 104 after a 30-day break.
    - **The fixed line ties that share to the keyboard.** A fast typist gets 4% hard, a slow one 63% (96–97% on a phone). The slow typist reads the hiragana track on day 21 instead of 16, and a knower who types slowly practises 7.5 minutes a day instead of 5.4.
  - The maintainer wants time to stay in the grade, with a line that follows the learner, and the target answer time to leave `/settings`. The maintainer accepted the note's recommendation on 2026-11-25: a share of 10%, and no target line on the answer-time chart. A change to the knowledge model needs a run of `pnpm --filter @nekotype/sim run p7` and the maintainer's consent (P7 plan, rule 3b).
- **Decision:**
  1. **Pace.**
     - For each task graded by time (recall, build, fluency, dictation) and each device (`dev` of the log), the fold keeps a pace: a streaming 90th percentile of the log answer time of the correct answers without a hint.
     - The first such answer sets the level to `ln ms`; each next one raises it by `0.05 × 0.9` when slower than the level and lowers it by `0.05 × 0.1` otherwise. The constants are `PACE_QUANTILE` = 0.9, `PACE_STEP` = 0.05 and `PACE_MIN` = 20 in `packages/model/src/constants.ts`.
     - The fold keeps the same pace over every device of the task.
  2. **The line.**
     - A timed answer's line is the pace of its device before the answer, once that pace has `PACE_MIN` answers. Until then it is the pace of every device of the task, once that one has `PACE_MIN`. Before either, every correct answer is good.
     - "Good within the target time" of ADR 100, point 4, now reads "good within its line" for every row. A hint still makes an answer hard. A correct fluency answer slower than its line has no effect, as it had when slower than the target.
     - About one correct recall in ten is hard, whatever the typing speed and the device.
  3. **Fold state.** The paces are part of the fold's state (`LearnerState.pace`, two numbers per key) and are rebuilt from the log. They depend on the log's order, which is the same on every device after a sync, so every device folds the same grades. `FoldOptions` loses `targetMs`, and `ModelState` loses it too.
  4. **The `line` option.** `FoldOptions.line` replaces the line of a timed answer. The pace still follows the answers.
     - The forecast's plays use it to grade every correct answer good, as they did under the default target: their answers have a fixed time.
     - The seeded log of the model-cost test uses it too, so it stays the same log.
     - `packages/sim` uses it for the research rules of the note.
  5. **Settings.**
     - `settings.learn.targetMs` and its row on `/settings` go.
     - Documents written before this decision keep the key: a device's local document, a batch waiting in its `outbox` and the account's document in D1. The client reads each of them without it (`readSettings` of `@nekotype/shared/runtime`), so a learner keeps their track and strictness and a waiting batch is still sent.
     - The API stays strict ([A28](../spec/decisions.md)): a batch of the earlier code that still carries the key is refused with a `400`, kept, and sent without the key once the app is updated.
     - No D1 migration. A migration that removed the key would break the code deployed before it, on the preview database that every pull request shares and in production between the migration and the deploy. An account's document loses the key when a device sends newer settings.
     - A tab of the earlier code cannot read a pulled page whose settings lack the key, and blocks its sync until it reloads (ADR 061: before P14 only the maintainer uses production).
  6. **The answer-time chart of `/progress`** loses its target line: the line between good and hard is now the learner's own. The y axis covers the bars only.
- **Justification:**
  - **The note.** On every simulated learner the rule holds the share of hard at 90% good. It is within one day of "no time" on every outcome, and a slow typist reads the track 5–8 days earlier than with the fixed line, at 0.2–1.0 points more review retention than no time.
  - **The model implements the rule exactly.** A sim test (`policies/answer-time.test.ts`) runs the production model with its own pace against the note's rule applied from outside, on one device and on two: the runs are equal.
  - **The `p7` tables on the production model, before and after:**

    | Measure (criterion of ADR 100, point 10)                                   | Line                            | Target 1500 ms    | Pace (this ADR)   |
    | -------------------------------------------------------------------------- | ------------------------------- | ----------------- | ----------------- |
    | Beginner reads the 46 basic hiragana, day (median, 10–90%)                 | ≤ 8                             | 7 (6–8)           | 7 (6–8)           |
    | Beginner reads all 104, day                                                | —                               | 12 (11–14)        | 13 (11–15)        |
    | Review retention                                                           | ≥ 90.0%                         | 93.0 (92.4–93.9)% | 93.6 (92.8–94.4)% |
    | Next-day recall of a new kana                                              | —                               | 42 (36–53)%       | 44 (36–49)%       |
    | Minutes a day, days 1–14                                                   | ≤ 10.0                          | 7.7 (7.4–8.3)     | 8.0 (7.6–8.5)     |
    | Reviews in 60 days                                                         | —                               | 1246              | 1354              |
    | Knower, minutes a day                                                      | —                               | 3.8 (3.7–4.2)     | 4.0 (3.9–4.3)     |
    | Slow learners (`recallGain ×0.5`, `gainExponent ×1.5`, `lapseKeep ×0.5`)   | 87.6–91.6, 84.7–88.7, 91.9–95.9 | 81.5, 76.4, 91.1  | 82.3, 76.8, 91.7  |
    | Forecast of the next row, reference learner, within ±1 session (corrected) | median \|error\| ≤ 1            | 69%, 1 (signed 0) | 78%, 1 (signed 0) |
    | `foldLog` of the seeded 40,000 answers, Node                               | —                               | 30.1 ms           | 30.8 ms           |

    The reference learner of `p7` answers with P7's time model: fast and close to its recall probability, so the 1500 ms target graded about 98% of its correct recalls good. The pace grades 90% good, which moves it as the note's 10% share does: review retention +0.6 points, the whole track one day later, 0.3 minutes a day more. The slow learners of criterion 7 have been below their lines since `REVIEW_WAIT_MS` ([#243](https://github.com/amp-r3/nekotype/pull/243), a cost accepted there); the pace moves them 0.4–0.8 points up. The full output is in the pull request.

- **Rejected alternatives:**
  - _Every correct answer good:_ in the simulation it is equal or better on every outcome, and simpler. Time stays in the grade until real logs can show whether it carries information. The share is one constant (`PACE_QUANTILE`), and grades derived at the fold reinterpret the whole history when it changes.
  - _The median of the last 50 correct recalls × 1.2:_ 30% hard, and 2–4 days slower on both tracks. Its share depends on the spread of the learner's times.
  - _One pace for every device:_ a phone's recalls would be graded hard twice as often as a desktop's.
  - _A per-kana offset, a soft line, a pace from reviews only:_ more state, with no change in the simulation.
  - _A continuous grade:_ it needs a change to FSRS-6's formulas, away from the reference implementation.
  - _Keep the setting, with an "auto" value:_ the line a learner sets ties the share to their choice, and the screen loses nothing it needs.
- **Consequences:**
  - **Spec.**
    - [learning.md](../spec/learning.md) (Constants) has no learning setting left but the strictness and the sound.
    - [metrics.md](../spec/metrics.md): the Grade row says "within the device's pace"; the answer-time chart has no target line.
    - [frontend.md](../spec/frontend.md): `/settings` loses the row.
    - [storage-sync.md](../spec/storage-sync.md): the settings document and its defaults lose `targetMs`; a document of an earlier version is read without it.
    - A48 in [decisions.md](../spec/decisions.md) and ADR 100 get Status lines.
  - **Architecture.** [model.md](../architecture/model.md), [entities.md](../architecture/entities.md) and [pages.md](../architecture/pages.md) describe the pace and `initLearn()` without a target.
  - **The design system** still shows the target answer time on `/settings` (decisions 79 and 151 of the design log), the target line on `ResultChart` (decisions 67 and 86) and the `Select` component for that row. A design session brings it in line ([ADR 106](106-design-sessions-in-a-workbench-artifact.md)). `Select` stays in `shared/ui`, out of the barrel, with no screen using it until then.
  - **The cost of the fold** gains a comparison and two additions per correct timed answer. The model-cost test of CI stays the gate.
  - **After release, an analysis of real logs** can raise the share (p80) or set it to zero, depending on whether a slow answer predicts a weaker next review. That is a constant, and the history follows it.
