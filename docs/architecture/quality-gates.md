# Verification gates

Part of the [architecture description](README.md) of the current code.

Every commit and pull request must satisfy `pnpm run verify`, which CI also runs. The root script runs each step in every package that defines it (`pnpm -r --if-present`):

1. **`pnpm run typecheck` (`tsc --noEmit`)**: Maximum strictness TypeScript checks. Zero `any`, zero `as T`, zero `!`.
2. **`pnpm run lint`**: ESLint AST inspection in every package; in `apps/web` also Steiger FSD architectural boundaries and the import restrictions of the [workspace](layout.md).
3. **`pnpm run format:check` (`prettier --check .`)**: Formatting of the whole repository.
4. **`pnpm run test` (`vitest run`)**: Unit, integration, property and render-isolation tests. `packages/engine` runs with a v8 coverage threshold of 95% for statements, branches, functions and lines (the spec target; the package measures 100%).
5. **`pnpm run build` (`vite build`)**: Production client bundle into `apps/web/dist`, with the Vite manifest. Everything the entry loads statically is one chunk (Rolldown `codeSplitting` group with the `$initial` tag); the app's own modules are declared side-effect free in `apps/web/package.json`, so a barrel does not pull lazy-only modules into it; there is no `modulepreload` polyfill (ADR 067).
6. **`pnpm run budget` (`node scripts/check-budget.mjs`)**: Reads the manifest and enforces hard budget limits (gzip unless stated; brotli is reported next to it). Figures at the end of P5 (commit 753df9f):
   - Initial HTML: ≤ 5 KB (actual 0.42 KB)
   - Initial JS, the entry and its static imports: ≤ 35 KB (actual 32.64 KB)
   - Initial CSS: ≤ 10 KB (actual 8.83 KB)
   - Fonts (woff2, read from `dist`): ≤ 45 KB per file (actual 20.38 KB Noto Sans JP 400, 10.79 and 10.61 KB JetBrains Mono 400/500, 9.42 and 9.56 KB Golos Text 400/500)
   - Total first load: ≤ 160 KB, including the SVG of the initial chunk, the logo (actual 102.65 KB)
   - Lazy route chunk: ≤ 25 KB; content chunk (the generated JSON in `entities/prompt/content/`): ≤ 40 KB (actual 24.15 KB for `words-hiragana`, the largest; the largest route chunk is the typing screen, 12.46 KB; the sync engine is 5.44 KB and the report dialog 2.09 KB)
   - Since ADR 067 (initial JS 28.24 KB) it also fails when the initial JS is more than one file, when a lazily imported module is folded into it, or when it lacks the Preact integration of `@preact/signals`.
7. **`pnpm run e2e` (`playwright test`)**: Chromium and WebKit (iPhone 13 emulation) against the production bundle (`vite build` into `dist-e2e`, served by `vite preview` on a port of its own, 5273; ADR 045), then the sync tests (`playwright.sync.config.ts`, `e2e/sync/`: Chromium against `wrangler pages dev` with the real API, a local D1 and a fake OAuth provider, on port 5274; ADR 091), then the latency test (`playwright.latency.config.ts`): it runs a probe build (`pnpm run build:probe`, `vite preview`) with 4× CPU throttling and checks, for Words and Phrases, the keystroke p95 budgets and a ceiling on the worst keystroke (ADR 043, 048). `check-budget` fails when `dist` contains the probe.

`apps/api` takes part in every step that applies to it: its tests run in the Workers runtime on a local D1 (`@cloudflare/vitest-plugin`, [ADR 083](../adr/083-api-package-and-pages-configuration.md)), so `pnpm test` needs no network and no Cloudflare account. In CI, the migrations are applied to the preview database before a preview deployment and to production before the production deployment, and the smoke test requests `/api/unknown` and `/api/me` on every deployment, and `/api/auth/google`: a redirect to Google on production (`--production`), a `404` on a preview.

Git hooks run the same checks earlier (`pre-commit`: staged formatting, typecheck, lint, unit tests; `pre-push`: `verify:quick`, which is `verify` without the browser tests).

## End-to-end tests (`e2e/`)

- `@playwright/test` is a `devDependency` of `apps/web`, invoked via `pnpm run e2e` and run as the last step of `pnpm run verify`, locally and in CI (Chromium, and WebKit in mobile emulation; CI installs and caches the browser).
- The tests in `apps/web/e2e/` cover browser-native focus restoration, click coordinate physics, cross-reload local storage synchronization and the results panel animation.
