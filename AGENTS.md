# AGENTS.md

Rules for AI coding agents in this repository. `CLAUDE.md` is a symlink to this file. The pre-commit hook rejects it over 100 lines (ADR 024, ADR 105): put details in `docs/` and link them.

## Project

Nekotype is a keyboard-first web app for learning Japanese from zero, starting with kana; production is <https://nekotype.pages.dev>.
A pnpm monorepo: a Preact SPA in `apps/web`, a Hono API on Cloudflare Pages Functions with D1 in `apps/api`, pure TypeScript packages in `packages/` (`README.md`, "Repository Layout").
The spec in `docs/spec/` wins over every other document. Start at `docs/README.md`: it maps each question to the file that answers it.

## Commands

Root scripts run in every package (`pnpm -r`); one package: `pnpm --filter @nekotype/web run <script>`. All scripts are in `README.md`; the ones with a catch:

```bash
pnpm run dev:api      # API on :8788 with a local D1; `pnpm run dev` (Vite) proxies /api to it
pnpm run format       # Prettier --write; pre-commit rejects unformatted staged files
pnpm run e2e          # not in pre-push: run it when a change touches the browser (focus, IME, layout)
pnpm run e2e:latency  # about 1 min; CI is the gate: a slower machine can fail the ceilings locally
```

One unit test file: `cd <package> && pnpm exec vitest run src/path/file.test.ts`. One e2e file: `cd apps/web && pnpm exec playwright test e2e/<file>.spec.ts --project=chromium`.

## Git workflow

- Work in the current branch. If it is `main` or its PR is already merged, create a branch from `origin/main`, one per logical change (`pN-...`, `fix/...`, `docs/...`). Never commit to `main`: every push to it deploys to production.
- Conventional Commits in English: `feat(scope): ...`, `fix(...)`, `chore: ...`, `docs: ...`. No AI attribution: no `Co-Authored-By` trailer for an assistant, no "Generated with …" line.
- Hooks in `.githooks/` run the checks: pre-commit the fast ones, pre-push `pnpm run verify:quick`. Do not run `verify:quick` by hand. Never bypass a hook with `--no-verify` unless the maintainer asks; if one fails, fix the cause.
- When the task is done, commit, push and open a PR without asking (with an advisor, push after its review: see below). The description lists what changed, why, anything touched outside the task's scope and what to check on the preview URL.
- Never merge: merging deploys to production and is the maintainer's review step. When the maintainer says to merge: `gh pr merge --squash --delete-branch`.

## Advisor

When an `advisor` tool is available (ADR 105):

- On a task longer than a few steps, call it after reading the code and before the first edit, to choose the approach. Not on small edits.
- Call it when an error repeats or before you change the approach.
- Before the final call: run the tests of the change, commit locally and print `git diff <base>...HEAD` (`<base>`: the PR's target branch, usually `origin/main`) so it sees the real change. Then call it as a reviewer, fix what it finds, and only then push.
- If its advice contradicts what you saw in the code or the test output, do not switch silently: describe the conflict and ask it again; if that does not settle it, ask the maintainer.

## Architecture

- Feature-Sliced Design in `apps/web/src`: `app → pages → (widgets) → features → entities → shared`. A layer imports only from layers below it; slices of one layer never import each other; cross-slice imports go through the slice's `index.ts`. Lint enforces it; a slice with a single consumer is merged into that consumer instead of disabling a rule (ADR 015).
- Store state is exported as `ReadonlySignal`; mutations go through exported actions (ADR 020).
- Time, timers and randomness are injected (`Clock`, `Scheduler`, `Rng`) so tests are deterministic.
- `packages/engine` is pure TypeScript: no DOM, signals, storage or app aliases; it runs in the browser and in a Worker.
- `packages/model` is pure too: no DOM, storage, network, clock, timers or `Math.random` (time comes as numbers, randomness as `Rng`). It is never in the initial chunk.
- Which package may import which: `docs/spec/architecture.md`.

## Input engine

- Two modes, relaxed (`learner`) and strict IME (`ime`). Invariant, checked by a property test: relaxed accepts every input strict accepts.
- The accepted-input table in `docs/spec/engine.md` is normative; every row is a golden test. Change the spec and the test together.
- The kana table format (`ime[]` + `learner[]` spellings per entry) is shared by the engine, the content build and the font subset.

## Code

- Strictness lives in `tsconfig.base.json` and `eslint.base.js` (no `any`, `as`, `!`, inline disables, `export default`, `export *`): fix the cause, never work around a rule. Narrow `unknown` with the type guards of `@nekotype/shared/runtime`.
- User-visible strings, `aria-label` included, come from `shared/i18n`, also in `.ts` files that lint does not check; `en` and `ru` keep the same keys (a test checks it). Kana row names are romaji in every language (ADR 044).
- No new runtime dependency without a clear need: it counts against the JS budget.

## Performance

- Hot path: a keystroke of a recall task MUST NOT trigger a component render (0 renders; at most 1 when it finishes the answer). Update the DOM through signals as text nodes, `useSignalEffect` and refs; `session-screen.test.tsx` checks it.
- No IndexedDB write inside a keystroke handler.
- Budgets (`pnpm run budget` fails the build): HTML ≤ 5 KB; initial JS ≤ 35 KB gzip; CSS ≤ 10 KB gzip; each font ≤ 45 KB; first load ≤ 160 KB. All budgets: `docs/spec/quality.md`.

## Testing

- E2E only for what needs a real browser (focus, IME, layout, the production bundle); a rule a unit test covers is not repeated there.
- Fix the code, not the test, unless the test encodes behaviour the spec has changed; then cite the spec item in the commit message.
- Report test results as they are; never claim a check passed without running it.

## Data and deployment

- Production is the Pages project `nekotype` at `nekotype.pages.dev` (ADR 025). Keep the origin stable: localStorage data is bound to it (A6).
- Until the P14 release tag nobody but the maintainer uses production (ADR 061): an IndexedDB schema change raises `SCHEMA_VERSION` and resets the local data; no migration is written. From P14 every schema change needs a migration and a test (`docs/spec/storage-sync.md`).
- The raw keystroke log must never be persisted.
- Free tiers only (Pages Functions, D1): check the limits in `docs/spec/backend.md` before adding server work.
- Content (words, phrases) comes from the content pipeline, never from hand edits (D19). Tatoeba phrases keep per-sentence author credit (A19).
- Licences (ADR 064): code AGPL-3.0-only; the name, logos and cat all rights reserved (`BRAND.md`); fonts OFL-1.1. A new brand file or font goes into the lists in `NOTICE.md`.

## Decisions and docs

- A new architectural or process decision is the next file in `docs/adr/` with a row in its index. Old ADRs are never rewritten: they get a Status line. Rules for documents: `docs/README.md`.
- When behaviour defined in `docs/spec/` changes, update the spec in the same PR. `README.md` and `docs/architecture/` describe the code after the latest finished phase: update them in the PR that changes that code.
- Design: variants are drawn in a workbench artifact, never in the design system, which holds only approved design; `docs/design/source/` is its export, never edited by hand (`docs/design/workflow.md`).

## Communication

- The maintainer writes in Russian: reply in Russian. Code, comments, documentation and commit messages are in English.
- If a requirement is ambiguous or contradicts the spec, ask before implementing.
