# AGENTS.md

Instructions for AI coding agents working in this repository. `CLAUDE.md` is a symlink to this file. Keep it under 250 lines: the pre-commit hook rejects longer versions. Put details in the documents linked below, not here.

## Project

Nekotype is a keyboard-first web app for learning Japanese, starting with hiragana and katakana from zero, with progress tracking (ADR 058, ADR 093). The typing trainer is being removed (P6): `/type` is gone and answers 404 and its data are gone from the client, the sync and the API (sync format 2; the D1 table and columns go in the last pull requests of the phase); words join learning instead. Production: <https://nekotype.pages.dev> (Cloudflare Pages).

- **Current code** is the v1 baseline in a pnpm monorepo (ADR 027; phases P0–P5 done): a Preact SPA in `apps/web/` (learning on `/`), the stream input engine and kana tables in `packages/engine`, shared types, guards, merge and patch functions and the API schemas in `packages/shared`, the content pipeline in `packages/content` (a build tool, run by hand; its generated chunks are committed), the API in `apps/api` (Hono on Pages Functions with a D1 database: sign-in with Google and GitHub, sessions, `/api/sync`, account deletion, `/api/reports` with Turnstile), and `apps/bench`, the sync measurement on a test Pages project. Settings and learning state are in IndexedDB, the language in localStorage; for a signed-in user a lazy sync engine sends them to D1 and merges what other devices sent.
- **Target** is the learning MVP in `docs/spec/`, delivered in phases P0–P12 (ADR 093): kana learning on `/` with IndexedDB (done in P3), the content pipeline (done in P4), Pages Functions + D1 sync (done in P5); still to come: removing the typing trainer (P6), an adaptive knowledge model (P7), kana audio with listening tasks (P8), a placement test and kana mnemonics (P9), words in learning (P10), vocabulary with English meanings (P11), polish and release (P12).
- Where documents disagree, `docs/spec/` wins over everything else. `README.md` and `docs/architecture/` describe the code after the latest finished phase; when a phase changes the code, update them in the same PR.

## Documents

Start at `docs/README.md`: it maps each question to the file that answers it. Open only the file you need.

| Path                 | Purpose                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `docs/spec/`         | MVP requirements, one file per area (`engine.md`, `metrics.md`, `storage-sync.md`, …); `README.md` lists them |
| `docs/design/`       | Design system: tokens, components, assets; start at `README.md`                                               |
| `docs/adr/`          | Decision records, one file per decision; `README.md` is the index with statuses                               |
| `docs/architecture/` | Architecture of the current code, one file per area; start at `README.md`                                     |
| `docs/archive/`      | Historical documents; not maintained                                                                          |
| `README.md`          | Setup, scripts, git hooks, deployment                                                                         |

## Commands

The repository is a pnpm workspace (`apps/*`, `packages/*`; Node ≥ 24, pnpm ≥ 10; ADR 026, 027). Root scripts delegate to the packages with `pnpm -r`; run a package script directly with `pnpm --filter @nekotype/web run <script>`.

```bash
pnpm install        # install; also enables the git hooks (prepare script)
pnpm run dev          # Vite dev server on http://localhost:5173
pnpm run dev:api      # API on :8788 (wrangler pages dev, local D1); Vite proxies /api to it
pnpm run typecheck    # tsc --noEmit
pnpm run lint         # eslint . && steiger ./src, per package
pnpm test             # vitest run in every package (engine: with a coverage threshold)
pnpm run build        # production build into apps/web/dist/
pnpm run budget       # size budgets on apps/web/dist/
pnpm run verify:quick # typecheck + lint + format:check + docs:check + test (coverage) + build + budget (what pre-push runs)
pnpm run verify       # verify:quick + e2e (what CI runs on a pull request)
pnpm run docs:check   # relative links and anchors in Markdown; lists files over the size rule
pnpm run e2e          # Playwright; one-time: pnpm --filter @nekotype/web exec playwright install --with-deps chromium webkit
pnpm run e2e:sync     # the sync e2e only: wrangler pages dev, local D1, fake OAuth (ADR 091); `e2e` runs it too
pnpm run e2e:latency  # keystroke latency test on recall (about 1 min); CI runs it on main, by hand and on pull requests that touch input, the learning session or loading code (ADR 052, 074, 095)
```

Run a single test file from its package: `cd apps/web && pnpm exec vitest run src/path/file.test.ts`. Run one e2e file on Chromium: `cd apps/web && pnpm exec playwright test e2e/<file>.spec.ts --project=chromium`. Do it when a change touches browser behaviour (focus, IME, layout); CI runs the whole suite.

## Git workflow

- Never commit directly to `main`. Every push to `main` deploys to production.
- One branch per phase or logical change (`p1-engine`, `fix/...`, `docs/...`), merged through a pull request with squash merge. Each PR gets a Cloudflare preview URL.
- Commit messages follow Conventional Commits: `feat(scope): ...`, `fix(...)`, `chore: ...`, `docs: ...`.
- No AI attribution in commits or PRs: no `Co-Authored-By` trailer for an assistant, no "Generated with …" line.
- When a task is done and `pnpm run verify:quick` passes, commit, push the branch and open a PR
  without asking. Do not commit to a branch the maintainer did not ask for.
- The PR description lists: what changed, why, anything touched outside the task's scope,
  and what to check manually on the preview URL.
- Never merge on your own: merging deploys to production and is the maintainer's review step.
  When the maintainer says to merge, squash-merge with `gh pr merge --squash --delete-branch`.
- Git hooks live in `.githooks/`:
  - `pre-commit`: `prettier --check` on staged files, then typecheck, lint, unit tests (code checks are skipped for Markdown-only commits); `AGENTS.md`/`CLAUDE.md` over 250 lines are rejected.
  - `pre-push`: `pnpm run verify:quick` (no e2e); when only Markdown files changed, `prettier --check` and `docs:check` instead. Do not run it by hand before pushing: the hook does it.
- Never bypass hooks with `--no-verify` unless the maintainer explicitly asks. If a hook fails, fix the cause.
- CI (`.github/workflows/deploy.yml`) runs `verify` (with e2e) on every push and PR, the latency test on `main` and by hand, and deploys with wrangler.

## Architecture rules (baseline, kept in the MVP)

- Feature-Sliced Design: `app → pages → (widgets) → features → entities → shared`. A layer imports only from layers below it.
- Slices on the same layer never import each other. Cross-slice imports go through the slice's `index.ts` only.
- Enforced by `eslint-plugin-boundaries` and `steiger`. A slice with a single consumer is merged into that consumer instead of disabling the rule (ADR 015).
- Store state is exported as `ReadonlySignal`; mutations go through exported actions (ADR 020).
- Time, timers and randomness are injected (`Clock`, `Scheduler`, `Rng`) so tests are deterministic.

## Code rules

- TypeScript is maximally strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …).
- Forbidden by lint: `any`, type assertions (`as T`), non-null assertions (`!`), `@ts-ignore` (and `@ts-expect-error` without a description), inline `eslint-disable`, `export default` (except config files), `export *`.
- Narrow `unknown` with type guards (`@nekotype/shared/runtime`); never cast.
- Prettier: single quotes, trailing commas, 100 columns. The whole repository is formatted and `verify` checks it; run `pnpm run format` before committing.
- Match the surrounding code: naming, comment density and idioms.
- All user-visible strings, including `aria-label` values, come from `shared/i18n` (`en` and `ru` must keep key parity; a test checks it). Exception: kana row names are romaji from the kana table, the same in every language (ADR 044).
- No new runtime dependency without a clear need: it counts against the JS budget.

## Input engine

- The engine (`packages/engine`; `apps/web/src/pages/learn/lib/prompt/engine.ts` only binds it to the kana table) is pure TypeScript: no DOM, signals, storage or app aliases. It must run in the browser and in a Worker.
- Two strictness modes: relaxed (`learner`) and strict IME (`ime`). Invariant: relaxed accepts every input strict accepts. It is a property test; do not break it.
- The accepted-input table in `docs/spec/engine.md` is normative. Every row is a golden test; change the spec and the test together.
- The kana table format (`ime[]` + `learner[]` spellings per entry) is shared by the engine, the content build and the font subset.

## Performance

- Hot path: a keystroke of a recall task MUST NOT trigger a component render (0 renders; at most 1 when the answer is finished). Update the DOM through signals as text nodes, `useSignalEffect` and refs. A render-isolation test (`session-screen.test.tsx`) enforces it.
- No IndexedDB writes inside a keystroke handler.
- Budgets: HTML ≤ 5 KB; initial JS ≤ 35 KB gzip; CSS ≤ 10 KB gzip; each font ≤ 45 KB; first load ≤ 160 KB. `pnpm run budget` fails the build when exceeded.

## Testing

- Unit tests: Vitest, colocated as `*.test.ts(x)`; DOM tests use `// @vitest-environment happy-dom`.
- E2E: Playwright in `e2e/`. Only for what needs a real browser (focus, IME, layout, the production bundle). A rule that a unit test covers is not repeated there.
- Fix the code, not the test, unless the test encodes behaviour the spec has changed. In that case cite the spec item in the commit message.
- Report test results as they are; never claim a check passed without running it.

## Data and deployment constraints

- Production is the Pages project `nekotype` at `nekotype.pages.dev` (ADR 025). Keep the origin stable from launch: localStorage data is bound to it (A6).
- Until the P12 release tag nobody but the maintainer uses production (ADR 061): a change to the IndexedDB schema resets the local data and no migration is written; raise `SCHEMA_VERSION` instead. The legacy `kanaflow:*` keys are deleted, never read. `nekotype:locale` is device data. P12 replaces this rule: after the release every schema change needs a migration and a test.
- The raw keystroke log must never be persisted.
- Licences (ADR 064): code is AGPL-3.0-only; the name, logos and cat are all rights reserved (`BRAND.md`); fonts are OFL-1.1. A new brand file or font goes into the lists in `NOTICE.md`.
- Content (words, phrases) is generated by the content pipeline, not edited by hand (D19). Tatoeba phrases must keep per-sentence author credit (A19).
- Free tiers only (Cloudflare Pages Functions, D1). Check the limits in the spec before adding server work.

## Decisions and docs

- Record a new architectural decision as the next file in `docs/adr/` and add it to the index there. Do not rewrite old ADRs; add a Status line when one is superseded.
- When behaviour defined in `docs/spec/` changes, update the spec in the same PR.
- Follow the conventions in `docs/README.md` for new documents: one topic per file, kebab-case names, a folder index.
- Keep this file short. If a rule needs more than a few lines, link to a document instead.

## Communication

- The maintainer writes in Russian; reply in Russian.
- Code, comments, documentation and commit messages are in English.
- If a requirement is ambiguous or contradicts the spec, ask before implementing.
