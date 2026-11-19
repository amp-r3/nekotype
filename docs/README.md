# Documentation

Start here. Each folder has its own `README.md` with an index.

| Folder                                        | Contents                                             | Status                                             |
| --------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| [spec/](spec/README.md)                       | MVP specification, one file per area                 | Normative: wins over every other document          |
| [design/](design/README.md)                   | Design system: tokens, components, assets            | Visual reference; the spec wins                    |
| [adr/](adr/README.md)                         | Architecture decision records, one file per decision | Append-only log                                    |
| [architecture/](architecture/README.md)       | Architecture of the current code                     | Describes the code after the latest finished phase |
| [archive/](archive/v1-implementation-plan.md) | Historical documents                                 | Not maintained; kept for context                   |

## Where to find

| Question                                                          | Go to                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| What does the MVP include and what changes from v1?               | [spec/README.md](spec/README.md)                                                   |
| Which romaji inputs are accepted? How does the engine work?       | [spec/engine.md](spec/engine.md)                                                   |
| How are answer time, confidence, KPM and personal bests computed? | [spec/metrics.md](spec/metrics.md)                                                 |
| Monorepo layout and dependency rules                              | [spec/architecture.md](spec/architecture.md)                                       |
| Input source, text stream, hot path, keyboard                     | [spec/frontend.md](spec/frontend.md)                                               |
| Learning: unlocking, sessions, reviews, Leitner boxes             | [spec/learning.md](spec/learning.md)                                               |
| Word and phrase sources, licences, attribution                    | [spec/content.md](spec/content.md)                                                 |
| IndexedDB, sync batches, merge rules                              | [spec/storage-sync.md](spec/storage-sync.md)                                       |
| API, D1 schema, auth, free-tier limits                            | [spec/backend.md](spec/backend.md)                                                 |
| Size and latency budgets, tests, CI                               | [spec/quality.md](spec/quality.md)                                                 |
| What is built in which phase, and acceptance criteria             | [spec/phases.md](spec/phases.md)                                                   |
| What comes after the MVP?                                         | [spec/backlog.md](spec/backlog.md)                                                 |
| What did a benchmark or investigation find? (P5 sync CPU)         | [research/2026-11-16-p5-sync-cpu.md](research/2026-11-16-p5-sync-cpu.md)           |
| What does the real `/api/sync` cost on Cloudflare? (P5 PR 5)      | [research/2026-11-18-p5-sync-endpoint.md](research/2026-11-18-p5-sync-endpoint.md) |
| Which variants of the sync were measured after ADR 081?           | [research/2026-11-16-p5-sync-variants.md](research/2026-11-16-p5-sync-variants.md) |
| Did P5 meet its sync limits on Cloudflare? (P5 PR 13)             | [research/2026-11-19-p5-acceptance.md](research/2026-11-19-p5-acceptance.md)       |
| What does the interface look like? Tokens, components, logo       | [design/README.md](design/README.md)                                               |
| Why was something decided?                                        | [spec/decisions.md](spec/decisions.md) (A-items), then [adr/](adr/README.md)       |
| How the current code is structured                                | [architecture/README.md](architecture/README.md)                                   |
| Licences of the code, brand and fonts                             | [../NOTICE.md](../NOTICE.md), [../BRAND.md](../BRAND.md)                           |
| Setup, scripts, git hooks, deployment                             | [../README.md](../README.md)                                                       |
| Rules for AI agents                                               | [../AGENTS.md](../AGENTS.md)                                                       |

## Decision logs

Decisions are recorded in three places, by where they were made. Each has its own numbering; cite an item with its prefix or its log's name, so the numbers never clash.

| Log                                                           | Cited as                    | Holds                                                                                       |
| ------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| [spec/README.md](spec/README.md), "Changes from the baseline" | D1…                         | What the MVP changes in the v1 code                                                         |
| [spec/decisions.md](spec/decisions.md)                        | A1… (decisions), O1… (open) | Decisions taken while writing the spec, and questions still open                            |
| [adr/](adr/README.md)                                         | ADR 001…                    | Decisions taken during implementation; the log for anything new                             |
| [design/source/decisions.md](design/source/decisions.md)      | design decision 1…          | How each design question was resolved; exported from the design artifact, never edited here |

- A new decision about code, architecture or process is an ADR. When it changes a requirement, the spec changes in the same pull request and gets a one-line A-item that links the ADR (as A46 links [ADR 078](adr/078-user-stats-targeted-updates.md)); an open question becomes an O-item and moves to "Resolved items" when answered.
- A design decision that changes the code or the spec gets an ADR that cites it (as [ADR 080](adr/080-design-system-clean-up.md) cites design decision 125). A purely visual one stays in the design log.
- Where two logs disagree, the spec wins, then the newest ADR.

## Conventions

- File and folder names are lowercase kebab-case. Every folder has a `README.md` index, except single-file folders.
- One topic per file. When a file passes about 300 lines or 20 KB, split it and update the folder index. A paragraph or list item that grows past a few sentences is split into a list.
- Link instead of copying: a fact lives in one place.
- New kinds of documents get their own folder, created when the first document appears:
  - `guides/` — how-to instructions (adding a kana row, running the content pipeline, releasing);
  - `research/` — investigations and benchmarks that informed a decision;
  - `reports/` — point-in-time reports, such as state audits. Name them `YYYY-MM-DD-topic.md`.
- When a document stops being maintained, move it to `archive/` and add a note at the top saying what replaced it.
- The working plan of a phase is `pN-plan.md` in the repository root, outside `docs/`: it tells the executor of each pull request what to build and is updated as the phase goes. Where it and the spec disagree, the spec wins. The last pull request of the phase moves it to `archive/`, and the row in "Where to find" points to the next plan or is removed.
- `pnpm run docs:check` (`scripts/check-docs.mjs`) fails on a relative link whose file or `#anchor` does not exist and lists the files and paragraphs over the size rule above. It runs in `verify:quick` and in the pre-push hook. `design/source/` is not checked; `archive/`, `adr/` and the phase plan are checked for links only.
