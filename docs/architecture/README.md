# Architecture of the current code

Nekotype is a high-performance, keyboard-first Japanese kana speed trainer engineered around a Non-deterministic Finite Automaton (NFA) romaji engine, fine-grained Preact signals, and strict Feature-Sliced Design (FSD) architecture.

> **Scope.** Describes the code as it stands after phase P5 (backend and sync): the application in `apps/web/src/`, the two packages it uses, `packages/engine` and `packages/shared`, the content pipeline `packages/content`, whose generated files the application reads, and the API in `apps/api` with its measurement tool `apps/bench`. Where it disagrees with the [MVP specification](../spec/README.md), the specification applies. These files are updated in the pull request that changes the code they describe.

> **Direction.** [ADR 058](../adr/058-learning-first.md) made learning the core of the MVP. Since P3, `/` is the learning screen. [ADR 093](../adr/093-learning-only-words-in-learning.md) removes the typing trainer: in P6 PR 1 the `/type` route and the trainer are gone, and the typing data and the content chunks follow in later pull requests of the phase. Since P5 a signed-in user's data syncs through Pages Functions and D1 ([sync.md](sync.md)).

## Contents

| File                                         | Covers                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [layout.md](layout.md)                       | Workspace, FSD layers, import rules, the IndexedDB layer, routing and the shell, styles                |
| [romaji-model.md](romaji-model.md)           | Strict IME and learner spellings, ー, っ, ん, skip tokens, reading hints                               |
| [engine.md](engine.md)                       | The matcher: positions, the public API of `packages/engine`                                            |
| [input.md](input.md)                         | Input sources and `KeyIntent`s; adding an on-screen keyboard                                           |
| [entities.md](entities.md)                   | The stores of `entities/settings` and `learn`                                                          |
| [pages.md](pages.md)                         | The learning, statistics, about and settings screens; presentational `shared/ui`                       |
| [sync.md](sync.md)                           | The sync engine and the account flows of `features/sync`, `entities/user`, `shared/api`, `requestSync` |
| [extension-recipes.md](extension-recipes.md) | Adding a kana row, changing the vocabulary, adding a locale                                            |
| [quality-gates.md](quality-gates.md)         | What `pnpm run verify` runs, the budgets as measured, the e2e tests                                    |

Until November 2026 this was one file, `baseline-v1.md`; older ADRs and plans name it. "Baseline" in the [specification](../spec/README.md) means the v1 code at commit 0f4927d, not these files.
