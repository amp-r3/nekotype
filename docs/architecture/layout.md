# Repository layout, layers and import boundaries

Part of the [architecture description](README.md) of the current code.

## Workspace (ADR 027)

```
apps/web/          @nekotype/web: the Preact SPA, Feature-Sliced Design (below)
packages/engine/   @nekotype/engine: NFA romaji engine, kana tables, track composition (`kanaOf`, `kanaRows`) and the visually-similar kana table (`similarKana`); imports nothing
packages/content/  @nekotype/content: the content pipeline, a build tool; the application reads the files it generates
packages/shared/   @nekotype/shared: /types (Clock, Rng, Scheduler, Valid* types, learning and typing data model), /runtime (re-exports only, so the modules behind it split between chunks; type guards (the settings guards in `settings-runtime.ts`), learning merge rules, typing records and personal-best rules; `learn-state.ts`: `mergeLearn` and the patch of `learn`; `learn-patch.ts`: the per-key patches of `learn_recent` and `learn_buckets` and the split of a delta; `sync-runtime.ts`: the sync constants, the guards of the responses and `applyBatch`; `sync-format.ts`: the format version and `outboxDelta`, the envelope check of a stored batch; ADR 078, 082, 085), /schemas (the valibot schemas of the API: batch, settings, result, report, results query; server only), /testing (a seeded generator of a year of learning and of sync batches, for tests and measurements only; `apps/web` imports it from test files)
apps/api/          @nekotype/api: the Hono application behind /api/* (Pages Functions), D1 migrations (migrations/), API tests in the Workers runtime; routes: `/api/auth/*` and `/api/me` (P5 PR 3, ADR 084; `DELETE /api/me` deletes the account, PR 11), `/api/reports` (P5 PR 12: `routes/reports.ts`, Turnstile in `lib/turnstile.ts`; ADR 092), `/api/results` (P5 PR 10: `routes/results.ts`, the query and the cursor in `db/results.ts`) and `/api/sync` (P5 PR 5: `routes/sync.ts`, the SQL in `db/sync.ts`, the merge in `sync/apply-batch.ts`; ADR 082). functions/api/[[route]].ts mounts it; wrangler.toml at the root configures the Pages project
apps/bench/        @nekotype/bench: the measurement of the real `/api/sync` on Cloudflare (CPU time, D1 statements and rows), run by hand against the Pages project `nekotype-bench` (P5 PR 1, 5, 13); see its README
```

Packages are consumed as TypeScript source (no build step). Each package has its own `tsconfig.json`, ESLint config, scripts and tests; the root holds Prettier, `tsconfig.base.json`, `eslint.base.js` (`createBaseConfig`) and scripts that run `pnpm -r`. Enforced by lint:

- `packages/engine/src` may use only relative imports and no browser globals (`window`, `document`, `localStorage`, …), so it runs in the browser and in a Worker.
- `apps/web` must not import `@nekotype/shared/schemas`, `@nekotype/content` or `@nekotype/api`; `shared/runtime` must not import schemas or valibot. `@nekotype/content` is a build tool: the application reads the files it generates and never imports it. `@nekotype/shared/schemas` is imported by `apps/api` only.

## Application layers (FSD)

`apps/web` strictly adheres to **Feature-Sliced Design (v2.1)** conventions and is continuously validated by `steiger` alongside TypeScript compiler checks:

```
apps/web/src/
├── app/                  # Application root: shell (navigation, footer), routes, initialization, styles
├── pages/                # Full-page views: trainer, learn, stats, settings, about
├── features/             # User interaction workflows (training)
├── entities/             # Core domain models and business state (kana, session, stats, learn)
└── shared/               # Reusable primitives, UI components, i18n, storage, and utility libraries
```

### IndexedDB layer (`shared/lib/idb`)

- **Layer.** `shared/lib/idb` holds the IndexedDB layer (P3, ADR 061): a promise wrapper (`get`, `put`, `delete`, `write`, `getAll` over an index (every value, ascending, one transaction), `count`, `update(reads, compute, scope?)` (a read-modify-write in one `readwrite` transaction: the synchronous `compute` gets the values read and returns the writes; a throw or a write outside the declared stores aborts it) and `getByIndex(store, index, value, limit)`; stores can declare indexes; the memory fallback, `memory-db.ts`, has the same methods and is a chunk of its own, loaded only when the database cannot be opened), `getDatabase()` (one connection per page load, or an in-memory store with a "data will not be saved" notice when the database cannot be opened) and the schema reset on a `SCHEMA_VERSION` mismatch (schema 4: stores `settings`, `delta`, `meta`, `results` with indexes `endedAt` and `synced`, `records`, and, from P5 PR 6, `snapshot` and `outbox`, which stay empty until the sync engine writes them; ADR 087).
- **Settings.** Settings are stored there (`settings` store, key `current`); `app/init.ts` deletes the legacy `kanaflow:settings:v1` key once the database has opened.
- **Typing data.** Typing results, statistics and records are stored there too (P4 PR 8, ADR 073); only `nekotype:locale` stays in `localStorage`, and `app/init.ts` deletes the legacy `kanaflow:progress:v1` once the database has opened.
- **Reading the sync base.** `readWithSyncBase(db, extra)` reads `snapshot/current`, `outbox/current` and the `extra` records in one `update` transaction with no writes; it returns the snapshot unchecked and the outbox's delta after `outboxDelta` checks the batch envelope. Each store checks the part it reads (a part that fails counts as absent), so the first screen does not carry the typing guards (ADR 087); both stores build their view with it. `ChangeChannel.post(message?)` posts `change` or `reset`.
- **Writes.** A `Write` is a put, a delete or a clear of a store, so a reset empties `results` in the same transaction as the other stores.

## Import rules and layer hierarchy

1. **Unidirectional Dependency Flow:** Slices in higher layers may import slices from lower layers only (`app` → `pages` → `features` → `entities` → `shared`). Lower layers NEVER import from higher layers.
2. **No Same-Layer Cross-Slice Imports:** Slices within the same layer (e.g. `entities/prompt` and `entities/settings`) must never import from each other. They interact through compositional coordination in higher layers (`features/training` or `pages/trainer`).
3. **Public API Facades:** All inter-slice imports must resolve through the target slice's root `index.ts` public re-export file. Deep internal imports (e.g. `@/entities/prompt/lib/picker`) are forbidden and rejected by lint checks.
4. **Zero-Assertion TypeScript:** The entire codebase operates under maximum strictness: zero `any`, zero `as T` type assertions, zero non-null assertions (`!`), and zero `@ts-ignore` or `eslint-disable` directives.

## Widgets layer consolidation

Under standard FSD, the `widgets/` layer hosts multi-slice compositional blocks. The FSD linter (`steiger`) enforces `fsd/insignificant-slice`, requiring slices to have more than one consumer across the application. Each screen is a separate page slice and the trainer is the only one with several components, so all trainer-specific widgets (`ModePanel`, `TestStage`, `ResultsPanel`, `LiveStatsStrip`, `WeakKanaList`) were consolidated into `apps/web/src/pages/trainer/ui/` as page-internal UI components.

> [!NOTE]
> **When to Extract Widgets:** If a second full-page view is introduced (such as a historical stats dashboard, custom word list editor, or flashcard review page) that reuses these UI blocks, extract them back into `apps/web/src/widgets/<widget-name>/` with their own public APIs.

## Routing and the application shell (ADR 037)

- `shared/lib/router.ts` is a router on the History API: `currentPath` (a signal), `navigate()`, `startRouter()` for the back button. It knows paths only.
- `app/route-paths.ts` lists the screens (`/`, `/type`, `/stats`, `/settings`, `/about`); `app/routes.tsx` maps each to a loader. `/` is the learning screen and is in the initial chunk; the typing trainer is the lazy route `/type`; `/learn` answers 404 (P3 PR 14); the others are dynamic imports (separate chunks, checked by `check-budget.mjs` as route chunks). A lazy route loads its page chunk and its dictionary part together (`loadDictionaryPart`, ADR 067), so a screen never renders before its strings. `app/route-state.ts` holds the loaded screens and the failed ones; `RouteView` renders the screen, a loading line, a retry notice or the not-found screen.
- `app/App.tsx` is the shell: `Nav` and `Footer` from `shared/ui` (they take their strings and the navigation handler as props), the language switch, `<main>`. The pages carry no frame of their own.
- `public/_redirects` rewrites the four non-root routes (with and without a trailing slash) to `/` with status 200 (not `/index.html`, ADR 039); `redirects.test.ts` keeps it equal to `ROUTE_PATHS`. There is no catch-all, so `404.html` still answers unknown paths and missing assets; it is a static twin of the app's not-found screen (ADR 077).
- `app/prefetch.ts` fetches the lazy screens and the content chunks of the selected content and script (`chunksFor`) on `requestIdleCallback` (a timer where it is missing) after the first render. The same pass loads the results screen and both whole dictionaries (core and every screen part, en and ru), which are chunks of their own (ADR 057, ADR 067). The tab title follows the screen and the language (`initApp`).

## Styles and design tokens (ADR 034)

- `shared/styles/tokens.css` holds the design-system tokens by hand (colours under `[data-theme='dark']`, scales and text styles in `@theme`); `tokens.test.ts` compares it with `docs/design/source/tokens.json`. The Tailwind default scales are cleared, so only token-based classes (`text-fur`, `text-ui-label`, `font-jp`, `h-control`, …) produce CSS.
- `shared/styles/fonts.css` declares the five faces (Golos Text 400/500, JetBrains Mono 400/500, Noto Sans JP 400); `font-synthesis: none`.
- E2E and DOM tests select by `data-testid` and by the attributes the stream keeps on `prompt-arena` (`data-phase`, `data-rejected`), not by class. `prompt-text` is a visually hidden element with the text of the prompt on display, which is also what assistive technology reads; e2e tests work out the canonical answer from it with the engine (`e2e/lib/prompt.ts`, ADR 045).
