# @nekotype/sim

The learner simulation of the P7 research on the knowledge model. It is a tool run by hand: nothing in `apps/web` or `apps/api` imports it, and its results are copied into the research notes [docs/research/2026-11-21-p7-knowledge-model.md](../../docs/research/2026-11-21-p7-knowledge-model.md), its parts 2–5 and the [P7 acceptance note](../../docs/research/2026-11-23-p7-acceptance.md).

- `src/learner.ts` — the reference learner, the "truth" the candidates are measured against: exponential forgetting with a difficulty per kana, of another family than FSRS. Its parameters (`REFERENCE`) are assumptions, listed in the note.
- `src/run.ts` — the harness: two sittings a day of about 5 minutes, sometimes one skipped, and the metrics.
- `src/policies/current.ts` — the rule of P3–P6 that P7 replaced (confidence, one kana at a time, Leitner boxes), kept as the baseline of the research notes.
- `src/policies/fsrs-planner.ts` — candidate A: FSRS-6 with default parameters per kana and a session planner.
- `src/policies/fsrs-planner.ts` also holds A2 (`PLANNER_A2`: learning steps in time) and candidate B's memory (`HALF_LIFE_MODEL`).
- `src/policies/fsrs-planner.ts` also holds the part 3 options: the look-ahead to the next session (`horizon`), adaptation to the observed review retention (`adapt`), fitting a memory model by likelihood (`fit`, with `FSRS_GRID` and `HALF_LIFE_GRID`), and A4 (`PLANNER_A4`).
- `src/part3.ts` — the tables of part 3: planners, fitting and forecast accuracy (`pnpm --filter @nekotype/sim run part3`, `PART=planner|fit|forecast` for one table).
- Part 4: the planner state is a fold of the answers (`apply`, `snapshot`, `adopt`, `clone`); `src/items.ts` holds both tracks (`bothTracks`, with hiragana–katakana pairs); the reference learner has `transfer` and `partsShare`; `src/run.ts` has the forward forecast (`SimOptions.forward`); `src/devices.ts` simulates one learner on two devices and the merge by answer log or by last state.
- `src/part4.ts` — the tables of part 4 (`pnpm --filter @nekotype/sim run part4`, `PART=forecast|grading|katakana|parts|devices` for one table).
- Part 5: `src/fsrs7.ts` is FSRS-7 with its default weights (two traces, fractional days), `FSRS7_MODEL` its memory model for the planner; `reviewGapMs` keeps a learned kana from being due again within that many ms of its last answer.
- `src/part5.ts` — the tables of part 5, A4 on FSRS-7 against FSRS-6 (`pnpm --filter @nekotype/sim run part5`, `PART=main|planner|calibration|forecast|rebuild|mastery` for one table).
- P7 (PR 3): `src/policies/production.ts` is `createProductionPolicy(track)`, A4 as it runs in the app: a `Fold` and `nextTask` of `@nekotype/model`, with the simulator's tasks and answers converted to keys and log events and no rule of its own. `src/options.ts` holds the recognition options both A4 planners use.
- `src/p7.ts` — the acceptance tables on the production model (`pnpm --filter @nekotype/sim run p7`, `PART=main|planner|forecast|cost` for one table; `forecast` is the production model's forecast of the next row against what happened, `cost` the Node time of the fold). The numbers of the P7 plan come from this script; the research policies stay so that parts 1–5 reproduce.
- Adaptive answer time ([note](../../docs/research/2026-11-25-adaptive-answer-time.md)): `src/timing.ts` is an answer-time model with the learner's motor speed, a phone, practice, distractions, a factor per kana and a signal strength; `createLearner` and `SimOptions.timing` take it, and without it the answer time is drawn exactly as before. `src/policies/answer-time.ts` holds the threshold rules (a window quantile, an EWMA, a streaming quantile; per device or track; a placebo and an oracle) and `withAnswerTime`, which wraps the production policy and hands its fold a time on the right side of its fixed target. `SimOptions.placement` runs a placement test before the first day; `RunResult.known` and `afterBreak` are the expected kana recalled each morning and 7 and 30 days after the last day; `createProductionPolicy` takes the selected track as a function of the state.
- `src/answer-time.ts` — the tables of that note (`pnpm --filter @nekotype/sim run answer-time`, `PART=frontier|motor|signal|level|source|profiles|devices|practice|cold|placement|tracks|final|cost` for one table; `SEEDS`, 100 by default).
- `src/sensitivity.ts` — the reference constants moved by ±50%, one at a time (`pnpm --filter @nekotype/sim run sensitivity`, about 6 minutes).
- FSRS-6 is `@nekotype/model` (`packages/model/src/fsrs.ts`, moved there in P7 PR 1; the research policies import it from there). `src/memory.ts` is the sim's `Memory`, FSRS-6's with the optional `fast` of FSRS-7.
- `src/fsrs7.test.ts` checks FSRS-7 against ts-fsrs 6.0.0, a dev dependency of this package only; nothing in the sim imports it at run time. The FSRS-6 check is in the model's tests.

```bash
pnpm --filter @nekotype/sim run sim          # 50 seeds per learner and policy, about 5 minutes
SEEDS=200 pnpm --filter @nekotype/sim run sim
```

The same seed gives the same run. The kana come from `@nekotype/engine` (the hiragana track, its dependencies and the visually-similar table).
