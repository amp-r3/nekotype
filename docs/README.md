# Documentation

Start here. Each folder has its own `README.md` with an index.

| Folder                                        | Contents                                             | Status                                              |
| --------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| [spec/](spec/README.md)                       | MVP specification, one file per area                 | Normative: wins over every other document           |
| [design/](design/README.md)                   | Design system: tokens, components, assets            | Visual reference; the spec wins                     |
| [adr/](adr/README.md)                         | Architecture decision records, one file per decision | Append-only log                                     |
| [architecture/](architecture/baseline-v1.md)  | Architecture of the current code                     | Describes the v1 baseline; rewritten during the MVP |
| [archive/](archive/v1-implementation-plan.md) | Historical documents                                 | Not maintained; kept for context                    |

## Where to find

| Question                                                          | Go to                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| What does the MVP include and what changes from v1?               | [spec/README.md](spec/README.md)                                             |
| Which romaji inputs are accepted? How does the engine work?       | [spec/engine.md](spec/engine.md)                                             |
| How are answer time, confidence, KPM and personal bests computed? | [spec/metrics.md](spec/metrics.md)                                           |
| Monorepo layout and dependency rules                              | [spec/architecture.md](spec/architecture.md)                                 |
| Input source, text stream, hot path, keyboard                     | [spec/frontend.md](spec/frontend.md)                                         |
| Learning: unlocking, sessions, reviews, Leitner boxes             | [spec/learning.md](spec/learning.md)                                         |
| Word and phrase sources, licences, attribution                    | [spec/content.md](spec/content.md)                                           |
| IndexedDB, sync batches, merge rules                              | [spec/storage-sync.md](spec/storage-sync.md)                                 |
| API, D1 schema, auth, free-tier limits                            | [spec/backend.md](spec/backend.md)                                           |
| Size and latency budgets, tests, CI                               | [spec/quality.md](spec/quality.md)                                           |
| What is built in which phase, and acceptance criteria             | [spec/phases.md](spec/phases.md)                                             |
| What does the interface look like? Tokens, components, logo       | [design/README.md](design/README.md)                                         |
| Why was something decided?                                        | [spec/decisions.md](spec/decisions.md) (A-items), then [adr/](adr/README.md) |
| How the current v1 code is structured                             | [architecture/baseline-v1.md](architecture/baseline-v1.md)                   |
| Licences of the code, brand and fonts                             | [../NOTICE.md](../NOTICE.md), [../BRAND.md](../BRAND.md)                     |
| Setup, scripts, git hooks, deployment                             | [../README.md](../README.md)                                                 |
| Rules for AI agents                                               | [../AGENTS.md](../AGENTS.md)                                                 |

## Conventions

- File and folder names are lowercase kebab-case. Every folder has a `README.md` index, except single-file folders.
- One topic per file. When a file passes about 300 lines, split it and update the folder index.
- Link instead of copying: a fact lives in one place.
- New kinds of documents get their own folder, created when the first document appears:
  - `guides/` — how-to instructions (adding a kana row, running the content pipeline, releasing);
  - `research/` — investigations and benchmarks that informed a decision;
  - `reports/` — point-in-time reports, such as state audits. Name them `YYYY-MM-DD-topic.md`.
- When a document stops being maintained, move it to `archive/` and add a note at the top saying what replaced it.
