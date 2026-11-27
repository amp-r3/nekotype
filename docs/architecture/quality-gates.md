# Verification gates

Part of the [architecture description](README.md) of the current code.

Every commit and pull request must satisfy `pnpm run verify`, which CI also runs. The root script runs each step in every package that defines it (`pnpm -r --if-present`):

1. **`pnpm run typecheck` (`tsc --noEmit`)**: Maximum strictness TypeScript checks. Zero `any`, zero `as T`, zero `!`.
2. **`pnpm run lint`**: ESLint AST inspection in every package; in `apps/web` also Steiger FSD architectural boundaries and the import restrictions of the [workspace](layout.md).
3. **`pnpm run format:check` (`prettier --check .`)**: Formatting of the whole repository.
4. **`pnpm run test` (`vitest run`)**: Unit, integration, property and render-isolation tests. `packages/engine` runs with a v8 coverage threshold of 95% for statements, branches, functions and lines (the spec target; the package measures 100%).
5. **`pnpm run build` (`vite build`)**: Production client bundle into `apps/web/dist`, with the Vite manifest. Everything the entry loads statically is one chunk (Rolldown `codeSplitting` group with the `$initial` tag); the app's own modules are declared side-effect free in `apps/web/package.json`, so a barrel does not pull lazy-only modules into it; there is no `modulepreload` polyfill (ADR 067).
6. **`pnpm run budget` (`node scripts/check-budget.mjs`)**: Reads the manifest and enforces hard budget limits (gzip unless stated; brotli is reported next to it). Figures at the end of P8 (PR 6 of the phase):
   - Initial HTML: ≤ 5 KB (actual 0.42 KB)
   - Initial JS, the entry and its static imports: ≤ 35 KB (actual 30.86 KB)
   - Initial CSS: ≤ 10 KB (actual 7.76 KB)
   - Fonts (woff2, read from `dist`): ≤ 45 KB per file (actual 20.38 KB Noto Sans JP 400, 10.79 and 10.61 KB JetBrains Mono 400/500, 9.42 and 9.56 KB Golos Text 400/500)
   - Total first load: ≤ 160 KB, including the SVG of the initial chunk, the logo (actual 99.79 KB)
   - Lazy route chunk: ≤ 25 KB; a content chunk (the generated JSON in `entities/prompt/content/`) fails the check: no content is shipped before P9, and the ≤ 40 KB rule returns with it (the largest lazy chunk is the learning session runtime, 10.41 KB; the model is 8.08 KB, `/progress` 7.11 KB, the sync engine 4.82 KB, the home's panels 1.85 KB, the insights 1.44 KB and the kana details dialog 1.30 KB)
   - It also fails when the chunk of `src/features/sync/index.ts` or of `src/features/kana-details/ui/kana-details-dialog.tsx` is missing from the manifest, is in the initial chunk or is a static import of a route chunk (the model's chunk has the same check).
   - Since ADR 067 (initial JS 28.24 KB) it also fails when the initial JS is more than one file, when a lazily imported module is folded into it, or when it lacks the Preact integration of `@preact/signals`.
7. **`pnpm run e2e` (`playwright test`)**: Chromium and WebKit (iPhone 13 emulation) against the production bundle (`vite build` into `dist-e2e`, served by `vite preview` on a port of its own, 5273; ADR 045), then the sync tests (`playwright.sync.config.ts`, `e2e/sync/`: Chromium against `wrangler pages dev` with the real API, a local D1 and a fake OAuth provider, on port 5274; ADR 091), then the latency test (`playwright.latency.config.ts`): it runs a probe build (`pnpm run build:probe`, `vite preview`) with 4× CPU throttling and checks, over two learning sessions of recall, the keystroke p95 budgets and a ceiling on the worst keystroke (ADR 043, 048, 095); the same configuration runs `model-cost.spec.ts` (the fold and the forecast of the model) and `home-cost.spec.ts` (P8: with 40,000 answers and katakana selected, the forecast and "since the last session" must be on the home within 300 ms of the model chunk, the median of three loads at 4×). `check-budget` fails when `dist` contains the probe.

`apps/api` takes part in every step that applies to it: its tests run in the Workers runtime on a local D1 (`@cloudflare/vitest-plugin`, [ADR 083](../adr/083-api-package-and-pages-configuration.md)), so `pnpm test` needs no network and no Cloudflare account. In CI, the migrations are applied to the preview database before a preview deployment and to production before the production deployment, and the smoke test requests `/api/unknown` and `/api/me` on every deployment, and `/api/auth/google`: a redirect to Google on production (`--production`), a `404` on a preview.

CI does not run the same steps for every change ([ADR 097](../adr/097-ci-scope-and-trees-verified-in-pull-requests.md)). A `scope` job (`apps/web/scripts/ci-scope.mjs`) reads the changed files: Markdown files only need `format:check` and `docs:check`; a change to `apps/api` alone skips the Chromium and WebKit tests; `apps/bench` and `packages/content` skip every browser test; any other path runs everything. A pull request run that passes uploads the artifact `verified-<git tree hash>`; a push to `main` whose tree has that artifact (from a run of this repository, not expired) builds, deploys and smoke-tests without repeating the tests and the latency test. A push to `main` with any other tree runs everything, and `workflow_dispatch` too. The steps in `deploy.yml` are the steps of `verify` one by one, and `app/ci-scope.test.ts` keeps them equal to the scripts. They run as parallel jobs ([ADR 098](../adr/098-parallel-ci-jobs.md)): `checks` (`verify:quick`, on the plain runner), `e2e-web`, `e2e-sync` and `latency` (in the Playwright image, each building the bundle it tests), and `deploy`, which waits for all of them and runs when none failed.

Git hooks run the same checks earlier (`pre-commit`: staged formatting, typecheck, lint, unit tests; `pre-push`: `verify:quick`, which is `verify` without the browser tests).

## End-to-end tests (`e2e/`)

- `@playwright/test` is a `devDependency` of `apps/web`, invoked via `pnpm run e2e` and run as the last step of `pnpm run verify`, locally and in CI (Chromium, and WebKit in mobile emulation; CI takes the browsers from the Playwright image, ADR 054).
- The tests in `apps/web/e2e/` cover browser-native behaviour: the input source on recall (layout and IME notices, keys that belong to the browser), a learning session by keyboard and by tap, routes and the lazy chunks, and the sync flows (`e2e/sync/`).
