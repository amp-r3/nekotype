# ADR 101: The Model Package: Pure Rules in `packages/model`, Items From the Kana Table, Grades as One Function

- **Status:** In force.
- **Context:** [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), point 10, asks for one model that the app and `packages/sim` both run. The P7 plan ([decisions D1, D3, D4](../../p7-plan.md)) leaves the shape of that package open. The sim's FSRS-6 and kana items were written for research.
- **Decision:**
  1. **A package.** `packages/model` holds every rule of ADR 100 that is not storage, sync or a screen. It is pure TypeScript for the browser, a Worker and Node, and lint forbids DOM, storage, network, clock, timers and `Math.random`, and any import beyond relative paths, `@nekotype/engine` and types of `@nekotype/shared/types`. A package keeps the app's layer rules out of the sim, which cannot import `apps/web`.
  2. **FSRS-6 moves, it is not copied.** `packages/sim/src/fsrs.ts` becomes `packages/model/src/fsrs.ts`; the sim imports it from the model, so the sim runs the production formulas. The sim keeps FSRS-7 with its own `Memory` (adds `fast`). The model's `Memory` has `stability` and `difficulty` only.
  3. **Items** come from `kanaRows` of the engine, keyed as the app keys them. Dependencies (`parts`) follow the rule of the spec and `pair` links the two tracks. `index` is the position in the track.
  4. **Grades are one function**, `effectsOf`, the table of ADR 100 point 4. The grade of an answer is computed when the log is folded and never stored. A word answer gives no main effect.
  5. **Log event types** (`LogEvent` and parts, `TaskKind`, `WordKey`) are types in `packages/shared`, read by the client, the server and the model.
  6. **Reference check.** FSRS-6 is tested against ts-fsrs 6.0.0 to 6 digits on steps of a day or more and to 5 digits on a history with gaps of minutes (the reference rounds the recall probability to 8 digits).
- **Consequences:** `@nekotype/model` is never in the initial chunk (budget in the P7 plan, D22). The fold, planner and forecast join the package in later pull requests of P7.
