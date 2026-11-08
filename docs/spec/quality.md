# Budgets and quality

The baseline budgets are retained and extended with latency and lazy-chunk budgets. Every budget in the table is checked by `verify`, and exceeding any of them fails CI.

## Budgets

| Item                                                                | Budget                      | Baseline     | End of P2    | Checked by                                                       |
| ------------------------------------------------------------------- | --------------------------- | ------------ | ------------ | ---------------------------------------------------------------- |
| HTML                                                                | ≤ 5 KB                      | 0.27 KB      | 0.45 KB      | `check-budget.mjs`                                               |
| Initial JS (gzip)                                                   | ≤ 35 KB                     | 24.0 KB      | 32.67 KB     | `check-budget.mjs`                                               |
| Initial CSS (gzip)                                                  | ≤ 10 KB                     | 5.0 KB       | 6.13 KB      | `check-budget.mjs`                                               |
| Noto Sans JP (kana only)                                            | ≤ 45 KB                     | 16.4 KB      | 20.77 KB     | `check-budget.mjs`                                               |
| JetBrains Mono                                                      | ≤ 45 KB                     | 14.9 KB      | 10.69 KB     | `check-budget.mjs`                                               |
| Golos Text                                                          | ≤ 45 KB                     | —            | 9.55 KB      | `check-budget.mjs`                                               |
| Total first load                                                    | ≤ 160 KB                    | 60.6 KB      | 101.74 KB    | `check-budget.mjs`                                               |
| Lazy route chunk (gzip)                                             | ≤ 25 KB                     | —            | 1.98 KB      | `check-budget.mjs`                                               |
| Content chunk (gzip)                                                | ≤ 40 KB                     | —            | 2.05 KB      | `check-budget.mjs`                                               |
| Kana sound file (from P6)                                           | ≤ 10 KB, not in first load  | —            | —            | `check-budget.mjs`                                               |
| Keystroke work (handler + style + layout), p95 at 4× CPU throttling | ≤ 8 ms                      | not measured | 1.7 ms       | Playwright latency test                                          |
| Keystroke → next frame, p95 at 4× CPU throttling                    | ≤ 2 frames (33 ms at 60 Hz) | not measured | 21.9 ms      | Playwright latency test                                          |
| Keystroke work, worst of 200 (median of 3 runs), 4× CPU throttling  | ≤ 25 ms                     | not measured | 12.9 ms      | Playwright latency test                                          |
| Keystroke → next frame, worst of 200 (median of 3 runs), 4×         | ≤ 50 ms                     | not measured | 25.5 ms      | Playwright latency test                                          |
| Component renders per keystroke                                     | 0; ≤ 1 on prompt completion | 5            | 0; 1         | Vitest render test                                               |
| Lighthouse Performance, mobile profile                              | ≥ 95, median of 3 runs      | not measured | not measured | `@lhci/cli` on the production build served by vite preview in CI |

"End of P2" is commit e33484a: sizes from `check-budget.mjs`, the largest lazy chunk of each kind, and the latency from the CI run on that commit, the highest value of the three content kinds. Latency depends on the machine: the same build measures roughly twice as slow on a slower developer machine, where the worst-keystroke ceilings can fail; the gate is defined by the CI run (ADR 048, ADR 052).

Sign-in and sync do not count toward the initial budget: the sync client and account screens are lazy-loaded. Neither do kana sounds, which are loaded when a learning session starts.

**`check-budget.mjs` changes**: check HTML; read fonts from `dist` instead of `src`; detect lazy chunks from the Vite manifest instead of a filename substring; report brotli alongside gzip.

## Latency measurement

The Event Timing API is not used: by default it reports only events longer than 16 ms and rounds durations to 8 ms. A test build exposes a probe that records two values per keystroke:

1. **Work:** `performance.now()` on handler entry, and again after all state updates followed by a forced style and layout read (`getBoundingClientRect()` on the romaji buffer). The difference is the time the application spends on the keystroke and does not include waiting for a frame.
2. **Next frame:** the time from handler entry to a `MessageChannel` task posted from the next `requestAnimationFrame` callback. It includes the wait for the next frame, which alone ranges from 0 to one frame interval, hence the 2-frame budget.

The Playwright test enables 4× CPU throttling via the Chrome DevTools Protocol and types 200 keystrokes in a 120 s timed test, with the settings written explicitly, and fails when the test is no longer running at the end. It does so for each kind of content (Words and Phrases; Single Kana too until P3 removes it, [ADR 058](../adr/058-learning-first.md)), 3 runs each. Two checks per kind: the median of the three p95 values is compared with each budget, and the median of the three worst keystrokes with a ceiling (work ≤ 25 ms, frame ≤ 50 ms). The ceiling exists because the redraw of the text stream happens about once in sixty keys and never reaches the p95; it is not loosened to make a run pass (ADR 048). The probe is excluded from the production build. The test runs in CI on a push to `main` and on a manual run, before anything is deployed, and a failure stops the workflow; it does not run on pull requests (ADR 052).

## Tests

- **`packages/engine`:** line and branch coverage ≥ 95% (`@vitest/coverage-v8`); the golden table from [Input engine rules](engine.md); the baseline property tests; stream tests for prompt boundaries.
- **`apps/web`:** unit tests for logic; render-isolation tests for the hot path; Playwright e2e only for what needs a real browser (focus, composition, layout, the production bundle, WebKit); the rules of the session, the settings and the key classification are unit tests, and a case a unit test already covers is not repeated in e2e (ADR 052). Unlocking and task choice in the learning mode are property tests with a seeded `Rng` and a fake `Clock` ([Phases](phases.md), P3). The e2e cover: full time, count and zen tests; idle end and a hidden tab; a restart leaving statistics unchanged; live conversion; layout and IME notices; a learning session with recall and recognition; results with the average and the personal best; the statistics page; guest → sign-in (mocked OAuth); offline → sync; two tabs syncing concurrently.
- **`apps/api`:** tests on a local D1: OAuth callback (mocked), `seq` handling (≤ last, = last + 1, > last + 1), merge rules, a lost `version` update retried without double counting, the error table, request limits, anonymous reports.
- **WebKit scope:** the `webkit-mobile` project runs only the tests tagged `@mobile` (`grep: /@mobile/`): focus after a tap, the keyboard layout notices, the number of lines on a phone, Restart on a touch screen, one full test and, from P3, a recognition choice by tap. Everything else runs on Chromium. Tag a new test `@mobile` only when it depends on the phone or on the WebKit engine (ADR 053).
- **Device matrix:** Android Chrome with Gboard and iOS Safari, manual pass required for P7. The P2 pass was deferred to P7 by the maintainer when P2 was closed (2026-11-06); it includes the open Gboard question of ADR 038 and the checks listed in ADR 051 and ADR 055. From P6 it also covers the kana sound played after a key press.

## CI

`verify` = typecheck + ESLint + Steiger + `prettier --check` + unit tests with coverage thresholds + build + `check-budget.mjs` + e2e (Chromium, and WebKit in mobile emulation for the tests tagged `@mobile`) + Lighthouse CI; the keystroke latency test runs next to it on `main` and by hand, not on pull requests (ADR 052). Prettier, e2e and coverage were not part of the baseline CI (D21); they are added in P0, with the engine coverage threshold set to the measured level in P0 and to the 95% target in P1. Until P2 the e2e run is Chromium-only without the latency test; WebKit and the latency test arrive in P2, Lighthouse CI in P7. The pre-push hook runs `verify:quick`, which is `verify` without the browser tests; CI is where e2e run (ADR 052). The e2e run against the production bundle (`vite build` served by `vite preview`), not the development server; the latency test has its own Playwright configuration (ADR 045). CI runs a smoke test (`apps/web/scripts/smoke-deploy.mjs`) against a deployment before it reaches users: every route answers 200 with the application, a missing asset and an unknown path answer 404, and the bundle loads. On `main` the build goes to the preview branch `release-candidate` first, and to production only after that smoke test passes; production is then smoke-tested again. New architectural decisions are recorded as ADRs in [`docs/adr/`](../adr/README.md).
