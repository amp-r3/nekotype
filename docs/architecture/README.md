# Architecture of the current code

Nekotype is a keyboard-first web app for learning Japanese kana, engineered around a Non-deterministic Finite Automaton (NFA) romaji engine, fine-grained Preact signals, and strict Feature-Sliced Design (FSD) architecture.

> **Scope.** Describes the code as it stands after phase P8 (the learning home and progress): the application in `apps/web/src/`, the packages it uses, `packages/engine`, `packages/shared` and `packages/model`, the pure knowledge model the application loads lazily, the content pipeline `packages/content`, whose generated files are committed into the application's tree but not shipped before P9, and the API in `apps/api` with its measurement tool `apps/bench`. Where it disagrees with the [MVP specification](../spec/README.md), the specification applies. These files are updated in the pull request that changes the code they describe.

> **Direction.** [ADR 058](../adr/058-learning-first.md) made learning the core of the MVP. Since P3, `/` is the learning screen. [ADR 093](../adr/093-learning-only-words-in-learning.md) removed the typing trainer in P6: the `/type` route, the trainer, its data in the client, the sync and D1, and the content chunks of the build; words come back as part of learning in P9 (ADR 116). [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md) replaced confidence, unlocking and the Leitner boxes in P7 with FSRS-6 and a planner over an answer log, which syncs as sync format 3 ([model.md](model.md)). In P8 `/` became the learning home that shows what the model computes (the reason, the outline, the forecast, what got stronger), and the kana table and the statistics moved to `/progress` ([pages.md](pages.md)). Since P5 a signed-in user's data syncs through Pages Functions and D1 ([sync.md](sync.md)).

## Contents

| File                                         | Covers                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [layout.md](layout.md)                       | Workspace, FSD layers, import rules, the IndexedDB layer, routing and the shell, styles                |
| [romaji-model.md](romaji-model.md)           | Strict IME and learner spellings, ー, っ, ん, skip tokens, reading hints                               |
| [engine.md](engine.md)                       | The matcher: positions, the public API of `packages/engine`                                            |
| [input.md](input.md)                         | Input sources and `KeyIntent`s; adding an on-screen keyboard                                           |
| [model.md](model.md)                         | The knowledge model: FSRS-6, items, grades, the log event types; the rules of `packages/model`         |
| [entities.md](entities.md)                   | The stores of `entities/settings` and `learn`                                                          |
| [pages.md](pages.md)                         | The learning, statistics, about and settings screens; presentational `shared/ui`                       |
| [sync.md](sync.md)                           | The sync engine and the account flows of `features/sync`, `entities/user`, `shared/api`, `requestSync` |
| [extension-recipes.md](extension-recipes.md) | Adding a kana row, changing the vocabulary, adding a locale                                            |
| [quality-gates.md](quality-gates.md)         | What `pnpm run verify` runs, the budgets as measured, the e2e tests                                    |

Until November 2026 this was one file, `baseline-v1.md`; older ADRs and plans name it. "Baseline" in the [specification](../spec/README.md) means the v1 code at commit 0f4927d, not these files.
