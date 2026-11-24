# Repository layout, layers and import boundaries

Part of the [architecture description](README.md) of the current code.

## Workspace (ADR 027)

```
apps/web/          @nekotype/web: the Preact SPA, Feature-Sliced Design (below)
packages/engine/   @nekotype/engine: NFA romaji engine, kana tables, track composition (`kanaOf`, `kanaRows`) and the visually-similar kana table (`similarKana`); imports nothing
packages/model/    @nekotype/model: the knowledge model of P7 (see model.md); pure TypeScript, relative imports, `@nekotype/engine` and types of `@nekotype/shared/types` only
packages/content/  @nekotype/content: the content pipeline, a build tool; the application reads the files it generates
packages/shared/   @nekotype/shared: /types (Clock, Rng, Scheduler, Valid* types, the learning data model), /runtime (re-exports only, so the modules behind it split between chunks; the settings guards in `settings-runtime.ts`; `log-codec.ts`: the log page, its guard and `isLearnKanaKey`; `sync-runtime.ts`: the sync constants, the guards of the responses and `mergeSettings`; `sync-format.ts`: the format version; ADR 100, 102), /schemas (the valibot schemas of the API: batch, settings, report; server only), /testing (the kana keys and a seeded generator, for tests and measurements only; `apps/web` imports it from test files)
apps/api/          @nekotype/api: the Hono application behind /api/* (Pages Functions), D1 migrations (migrations/), API tests in the Workers runtime; routes: `/api/auth/*` and `/api/me` (P5 PR 3, ADR 084; `DELETE /api/me` deletes the account, PR 11), `/api/reports` (P5 PR 12: `routes/reports.ts`, Turnstile in `lib/turnstile.ts`; ADR 092) and `/api/sync` (`routes/sync.ts`; format 3: `sync/apply-log.ts`, the SQL in `db/batches.ts`; ADR 102). functions/api/[[route]].ts mounts it; wrangler.toml at the root configures the Pages project
apps/bench/        @nekotype/bench: the measurement of the real `/api/sync` on Cloudflare (CPU time, D1 statements and rows), run by hand against the Pages project `nekotype-bench` (P5 PR 1, 5, 13; P7 PR 7), which is deleted between measurements; see its README
```

Packages are consumed as TypeScript source (no build step). Each package has its own `tsconfig.json`, ESLint config, scripts and tests; the root holds Prettier, `tsconfig.base.json`, `eslint.base.js` (`createBaseConfig`) and scripts that run `pnpm -r`. Enforced by lint:

- `packages/engine/src` may use only relative imports and no browser globals (`window`, `document`, `localStorage`, …), so it runs in the browser and in a Worker.
- `packages/model/src` may use only relative imports, `@nekotype/engine` and `import type` from `@nekotype/shared/types`, and no browser globals, `fetch`, timers, `Date` or `Math.random` (`@typescript-eslint/no-restricted-imports`, `no-restricted-globals`, `no-restricted-properties`).
- `apps/web` must not import `@nekotype/shared/schemas`, `@nekotype/content` or `@nekotype/api`; `shared/runtime` must not import schemas or valibot. `@nekotype/content` is a build tool: the application reads the files it generates and never imports it. `@nekotype/shared/schemas` is imported by `apps/api` only.

## Application layers (FSD)

`apps/web` strictly adheres to **Feature-Sliced Design (v2.1)** conventions and is continuously validated by `steiger` alongside TypeScript compiler checks:

```
apps/web/src/
├── app/                  # Application root: shell (navigation, footer), routes, initialization, styles
├── pages/                # Full-page views: learn, progress, settings, about
├── features/             # User interaction workflows (sync, kana-details)
├── entities/             # Core domain models and business state (kana, session, stats, learn)
└── shared/               # Reusable primitives, UI components, i18n, storage, and utility libraries
```

### IndexedDB layer (`shared/lib/idb`)

- **Layer.** `shared/lib/idb` holds the IndexedDB layer (P3, ADR 061): a promise wrapper (`get`, `put`, `delete`, `write`, `update(reads, compute, scope?)` (a read-modify-write in one `readwrite` transaction: the synchronous `compute` gets the values read and returns the writes; a throw or a write outside the declared stores aborts it); the memory fallback, `memory-db.ts`, has the same methods and is a chunk of its own, loaded only when the database cannot be opened), `getDatabase()` (one connection per page load, or an in-memory store with a "data will not be saved" notice when the database cannot be opened) and the schema reset on a `SCHEMA_VERSION` mismatch (schema 6, P7: stores `settings`, `log`, `outbox` and `meta`; a device of an older schema is reset at its first start, ADR 061, ADR 096, ADR 103).
- **Settings.** Settings are stored there (`settings` store, key `current`); `app/init.ts` deletes the legacy `kanaflow:settings:v1` key once the database has opened.
- **Learning data.** The learning log is stored there too (the store `log`, P7); only `nekotype:locale` stays in `localStorage`, and `app/init.ts` deletes the legacy `kanaflow:progress:v1` once the database has opened.
- **Change channels.** `ChangeChannel.post(message?)` posts `change` or `reset` (settings); `typedChannel(name, isMessage)` carries the structured `LearnMessage` of `nekotype:learn` and drops messages that fail the guard.
- **Writes.** A `Write` is a put, a delete or a clear of a store, so a reset empties the stores in one transaction.

## Import rules and layer hierarchy

1. **Unidirectional Dependency Flow:** Slices in higher layers may import slices from lower layers only (`app` → `pages` → `features` → `entities` → `shared`). Lower layers NEVER import from higher layers.
2. **No Same-Layer Cross-Slice Imports:** Slices within the same layer (e.g. `entities/learn` and `entities/settings`) must never import from each other. They interact through compositional coordination in higher layers (`pages` or `features`).
3. **Public API Facades:** All inter-slice imports must resolve through the target slice's root `index.ts` public re-export file. Deep internal imports (e.g. `@/entities/learn/model/log`) are forbidden and rejected by lint checks.
4. **Zero-Assertion TypeScript:** The entire codebase operates under maximum strictness: zero `any`, zero `as T` type assertions, zero non-null assertions (`!`), and zero `@ts-ignore` or `eslint-disable` directives.

## Widgets layer consolidation

Under standard FSD, the `widgets/` layer hosts multi-slice compositional blocks. The FSD linter (`steiger`) enforces `fsd/insignificant-slice`, requiring slices to have more than one consumer across the application, so the layer is not used: a block with one consumer lives in that consumer. The kana table and the binding of the engine to it (`pages/learn/lib/prompt`, which `entities/prompt` held until P6, ADR 096) are an example: `pages/learn` is their only consumer. The generated word and phrase chunks stay in `entities/prompt/content/`, data without code that steiger ignores; P12 gives it a home.

> [!NOTE]
> **When to Extract Widgets:** If a second full-page view is introduced (such as a historical stats dashboard, custom word list editor, or flashcard review page) that reuses these UI blocks, extract them back into `apps/web/src/widgets/<widget-name>/` with their own public APIs.

## Routing and the application shell (ADR 037)

- `shared/lib/router.ts` is a router on the History API: `currentPath` (a signal), `navigate()`, `startRouter(redirects)` for the back button and the replacement of a retired path (`/stats`) by its target, on start and on `popstate`. It knows paths only.
- `app/route-paths.ts` lists the screens (`/`, `/progress`, `/settings`, `/about`) and `ROUTE_REDIRECTS` (`/stats` → `/progress`); `app/routes.tsx` maps each to a loader. `/` is the learning screen and is in the initial chunk; `/learn` and `/type` answer 404 (P3 PR 14, P6 PR 1); the others are dynamic imports (separate chunks, checked by `check-budget.mjs` as route chunks). A lazy route loads its page chunk and its dictionary part together (`loadDictionaryPart`, ADR 067), so a screen never renders before its strings. `app/route-state.ts` holds the loaded screens and the failed ones; `RouteView` renders the screen, a loading line, a retry notice or the not-found screen.
- `app/App.tsx` is the shell: `Nav` and `Footer` from `shared/ui` (they take their strings and the navigation handler as props), the language switch, `<main>`. The pages carry no frame of their own.
- `public/_redirects` rewrites the three non-root routes (with and without a trailing slash) to `/` with status 200 (not `/index.html`, ADR 039) and redirects `/stats` to `/progress` with status 301; `redirects.test.ts` keeps it equal to `ROUTE_PATHS` and `ROUTE_REDIRECTS`. There is no catch-all, so `404.html` still answers unknown paths and missing assets; it is a static twin of the app's not-found screen (ADR 077).
- `app/prefetch.ts` fetches the lazy screens on `requestIdleCallback` (a timer where it is missing) after the first render. The same pass loads the session runtime, the session summary, the kana details dialog and both whole dictionaries (core and every screen part, en and ru), which are chunks of their own (ADR 057, ADR 067). The tab title follows the screen and the language (`initApp`).

## Styles and design tokens (ADR 034)

- `shared/styles/tokens.css` holds the design-system tokens by hand (colours under `[data-theme='dark']`, scales and text styles in `@theme`); `tokens.test.ts` compares it with `docs/design/source/tokens.json`. The Tailwind default scales are cleared, so only token-based classes (`text-fur`, `text-ui-label`, `font-jp`, `h-control`, …) produce CSS.
- `shared/styles/fonts.css` declares the five faces (Golos Text 400/500, JetBrains Mono 400/500, Noto Sans JP 400); `font-synthesis: none`.
- E2E and DOM tests select by role, label or `data-testid`, not by class. The DOM carries no answers: an e2e test works out the romaji of a task from the kana on screen with the kana table (`e2e/lib/learn.ts`, ADR 045).
