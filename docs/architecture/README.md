# Architecture of the current code

Nekotype is a high-performance, keyboard-first Japanese kana speed trainer engineered around a Non-deterministic Finite Automaton (NFA) romaji engine, fine-grained Preact signals, and strict Feature-Sliced Design (FSD) architecture.

> **Scope.** Describes the code as it stands after phase P5 (backend and sync): the application in `apps/web/src/`, the two packages it uses, `packages/engine` and `packages/shared`, the content pipeline `packages/content`, whose generated files the application reads, and the API in `apps/api` with its measurement tool `apps/bench`. Where it disagrees with the [MVP specification](../spec/README.md), the specification applies. These files are updated in the pull request that changes the code they describe.

> **Direction.** [ADR 058](../adr/058-learning-first.md) made learning the core of the MVP. Since P3, `/` is the learning screen and the typing trainer (words and phrases) lives on `/type`; single kana and the row selection were removed. Since P4 the typing screen reads the generated words and phrases and saves its results, records and statistics in IndexedDB. Since P5 a signed-in user's data syncs through Pages Functions and D1 ([sync.md](sync.md)).

## Contents

| File                                         | Covers                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [layout.md](layout.md)                       | Workspace, FSD layers, import rules, the IndexedDB layer, routing and the shell, styles                |
| [romaji-model.md](romaji-model.md)           | Strict IME and learner spellings, ー, っ, ん, skip tokens, reading hints                               |
| [engine.md](engine.md)                       | The matcher: positions, the public API of `packages/engine`                                            |
| [training-session.md](training-session.md)   | `createSession()` and `createTrainer()`: test end, saving, repeat, the stream windows                  |
| [input.md](input.md)                         | Input sources and `KeyIntent`s; adding an on-screen keyboard                                           |
| [entities.md](entities.md)                   | The stores of `entities/stats`, `settings`, `learn` and `prompt`                                       |
| [pages.md](pages.md)                         | The test, learning, statistics, about and settings screens; presentational `shared/ui`                 |
| [sync.md](sync.md)                           | The sync engine and the account flows of `features/sync`, `entities/user`, `shared/api`, `requestSync` |
| [extension-recipes.md](extension-recipes.md) | Adding a kana row, changing the vocabulary, adding a locale or a test mode                             |
| [quality-gates.md](quality-gates.md)         | What `pnpm run verify` runs, the budgets as measured, the e2e tests                                    |

Until November 2026 this was one file, `baseline-v1.md`; older ADRs and plans name it. "Baseline" in the [specification](../spec/README.md) means the v1 code at commit 0f4927d, not these files.
