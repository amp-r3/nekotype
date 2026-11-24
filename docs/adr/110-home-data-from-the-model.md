# ADR 110: The Home's Data From the Model: the Reason From the First Task, Weak Kana, `introducedIn`, Seeded Plays

- **Status:** In force.
- **Context:**
  - The P8 home ([ADR 108](108-p8-design-export.md)) answers "what now" with one Continue and the reason for what the session does first, and later settles each forecast it showed once its row is introduced ([p8-plan.md](../../p8-plan.md), D1 and D10). The model gives neither a reason nor the session in which a kana was introduced, and the app has no seeded generator, so the same state would give a different outline and forecast on each run.
  - [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), point 3, says the first task of a session follows the planner; a label that named a mode could promise something the session does not do.
- **Decision:** `@nekotype/model` gains four things; none of them changes a rule or a constant of ADR 100.
  1. **`reasonOf(state, view, { now, track })`** returns `review` (with `due`), `weak` (with `keys`), `learning` (with `learning`), `new` (with `key` and `row`) or `none` (with `nextAt`). It is read from `nextTask` with `previous: null` and an `rng` that always draws recall, so the label cannot promise what the planner does not offer. `none` holds exactly when the planner offers nothing.
  2. **`isWeak(kana)`:** a learning kana with at least `WEAK_MIN_RECALLS` (5) recall answers among its last 10 and accuracy under `WEAK_ACCURACY` (0.8), or confusions summing to `WEAK_CONFUSIONS` (2). The constants label and never choose a task, so a change needs no sim run.
  3. **`introducedIn`:** `LogStats.introducedIn` (kana → the number of `start` events folded when the fold introduced it) and `KanaView.introducedIn` (null while locked), copied by `snapshot()` and `clone()`. `KanaView.stability` is now the memory's stability for every introduced kana, not only learned and mastered ones, for the details dialog; `nextReviewAt` stays null while learning and `strongerSince` still compares learned and mastered kana only.
  4. **`seededRng(seed)`** (mulberry32) in the package, used by `syntheticLog`, which gives the same log as before.
- **Justification:** the reason is a function of the first task, so a property test against `nextTask` (for both draws) is a complete check; `introducedIn` is a fold of the log, so it converges across devices like the rest of the statistics; the seeded generator makes the outline and the forecast the same for the same state.
- **Rejected alternatives:**
  - _A reason chosen by its own rules (due count, then new, …):_ it could disagree with the first task.
  - _Settling forecasts by timestamps of introductions:_ clock skew between devices; the session number comes from the log's order.
  - _A seeded generator in `@nekotype/shared`:_ the model package may not import the testing helpers, and the app needs it at run time.
- **Consequences:**
  - [metrics.md](../spec/metrics.md) defines weak kana and `introducedIn`; [architecture/model.md](../architecture/model.md) describes the module.
  - The home (P8 PR 4) and the forecast history (PR 3) read these; nothing in the app calls them yet.
