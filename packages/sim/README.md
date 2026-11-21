# @nekotype/sim

The learner simulation of the P7 research on the knowledge model. It is a tool run by hand: nothing in `apps/web` or `apps/api` imports it, and its results are copied into the research notes [docs/research/2026-11-21-p7-knowledge-model.md](../../docs/research/2026-11-21-p7-knowledge-model.md) and its parts 2 and 3.

- `src/learner.ts` — the reference learner, the "truth" the candidates are measured against: exponential forgetting with a difficulty per kana, of another family than FSRS. Its parameters (`REFERENCE`) are assumptions, listed in the note.
- `src/run.ts` — the harness: two sittings a day of about 5 minutes, sometimes one skipped, and the metrics.
- `src/policies/current.ts` — the current rule of `docs/spec/learning.md` (confidence, one kana at a time, Leitner boxes).
- `src/policies/fsrs-planner.ts` — candidate A: FSRS-6 with default parameters per kana and a session planner.
- `src/policies/fsrs-planner.ts` also holds A2 (`PLANNER_A2`: learning steps in time) and candidate B's memory (`HALF_LIFE_MODEL`).
- `src/policies/fsrs-planner.ts` also holds the part 3 options: the look-ahead to the next session (`horizon`), adaptation to the observed review retention (`adapt`), fitting a memory model by likelihood (`fit`, with `FSRS_GRID` and `HALF_LIFE_GRID`), and A4 (`PLANNER_A4`).
- `src/part3.ts` — the tables of part 3: planners, fitting and forecast accuracy (`pnpm --filter @nekotype/sim run part3`, `PART=planner|fit|forecast` for one table).
- `src/sensitivity.ts` — the reference constants moved by ±50%, one at a time (`pnpm --filter @nekotype/sim run sensitivity`, about 6 minutes).
- `src/fsrs.ts` — FSRS-6, tested against values of ts-fsrs 6.0.0.

```bash
pnpm --filter @nekotype/sim run sim          # 50 seeds per learner and policy, about 5 minutes
SEEDS=200 pnpm --filter @nekotype/sim run sim
```

The same seed gives the same run. The kana come from `@nekotype/engine` (the hiragana track, its dependencies and the visually-similar table).
