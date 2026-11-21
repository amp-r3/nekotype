# @nekotype/sim

The learner simulation of the P7 research on the knowledge model. It is a tool run by hand: nothing in `apps/web` or `apps/api` imports it, and its results are copied into the research note [docs/research/2026-11-21-p7-knowledge-model.md](../../docs/research/2026-11-21-p7-knowledge-model.md).

- `src/learner.ts` — the reference learner, the "truth" the candidates are measured against: exponential forgetting with a difficulty per kana, of another family than FSRS. Its parameters (`REFERENCE`) are assumptions, listed in the note.
- `src/run.ts` — the harness: two sittings a day of about 5 minutes, sometimes one skipped, and the metrics.
- `src/policies/current.ts` — the current rule of `docs/spec/learning.md` (confidence, one kana at a time, Leitner boxes).
- `src/policies/fsrs-planner.ts` — candidate A: FSRS-6 with default parameters per kana and a session planner.
- `src/fsrs.ts` — FSRS-6, tested against values of ts-fsrs 6.0.0.

```bash
pnpm --filter @nekotype/sim run sim          # 50 seeds per learner and policy, about 3.5 minutes
SEEDS=200 pnpm --filter @nekotype/sim run sim
```

The same seed gives the same run. The kana come from `@nekotype/engine` (the hiragana track, its dependencies and the visually-similar table).
