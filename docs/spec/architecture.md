# Architecture

The repository is a pnpm monorepo with two applications and three packages. The frontend keeps Feature-Sliced Design with the baseline boundary linters.

```
nekotype/
├── apps/
│   ├── web/        Preact + Vite + Tailwind v4, FSD: app → pages → features → entities → shared
│   └── api/        Hono app (OAuth, sync, reports), mounted by Pages Functions
├── functions/
│   └── api/[[route]].ts   Pages Functions entry point; imports apps/api
├── packages/
│   ├── engine/     @nekotype/engine: input engine, kana tables (with the sound of each kana from P6), visually-similar kana table; zero dependencies
│   ├── content/    @nekotype/content: dictionary build scripts → JSON chunks; not part of the runtime
│   └── shared/     @nekotype/shared; entry points: /types, /runtime (decay, merge rules, personal-best rule and key, constants), /schemas (valibot, server only)
├── docs/           spec/, adr/, architecture/, archive/ (index: docs/README.md)
├── pnpm-workspace.yaml
└── .github/workflows/
```

The engine and all user data live in the browser. Pages Functions handle sign-in, sync and content reports only; content is built ahead of time and served as static assets.

## Dependency rules

| Package          | May import                                                                | Must not import                             |
| ---------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| `engine`         | nothing                                                                   | DOM, signals, storage, any package          |
| `shared/types`   | types from `engine`                                                       | runtime code                                |
| `shared/runtime` | `shared/types`                                                            | `shared/schemas`, valibot, application code |
| `shared/schemas` | `shared/types`, valibot                                                   | application code                            |
| `content`        | `engine` (compile check for every item), `shared/types`, `shared/runtime` | `apps/*`                                    |
| `apps/web`       | `engine`, `shared/types`, `shared/runtime`                                | `shared/schemas`, `content`, `apps/api`     |
| `apps/api`       | `shared/*`; `engine` from v2 for server-side result validation            | `apps/web`                                  |

The `apps/web` restriction on `shared/schemas` is enforced by an ESLint import rule, so valibot never reaches the client bundle.

The prompt picker and weight functions are not part of the engine: they live in `apps/web` (`entities/prompt`) and take `Rng` from `shared`. Nor are the rules of the learning mode (see "Learning logic" below).

## Key technical decisions

- **Deployment goes to the Cloudflare Pages project `nekotype`, origin `nekotype.pages.dev`.** The origin changed from `kana-flow.pages.dev` before launch (ADR 025): there were no users, so no data is carried over. The API runs as Pages Functions: `functions/api/[[route]].ts` mounts the Hono app with a D1 binding. Single origin: no CORS; session cookie `HttpOnly; Secure; SameSite=Lax`.
- **Routing of requests.** `_routes.json` includes only `/api/*`, so static requests never invoke Functions. `_redirects` rewrites each known SPA route (`/type`, `/stats`, `/settings`, `/about`) to `/` with status 200 ([ADR 039](../adr/039-redirects-rewrite-to-root.md)): Pages redirects `/index.html` to `/`, so a rewrite to `/index.html` would send every route to `/`. Any other unknown path, including a missing `/assets/*` file, returns the baseline `404.html` with status 404.
- **Router:** a dependency-free client router on the History API. All routes except `/` are lazy-loaded.
- **Sessions:** factories instead of global stores (D17): `createSession(deps)` for typing and `createLearnSession(deps)` for learning. `Clock`, `Scheduler`, `Rng`, storage and, for learning, `AudioProvider` are injected, keeping tests deterministic.
- **Learning logic** lives in `apps/web`. `entities/learn` holds the learning state and its pure rules: confidence, unlocking with the dependencies derived from the kana table, boxes and due dates, the streak. `features/learn-session` composes a session and chooses its tasks by weight with `Rng`. The merge functions of the learning state and of the typing records live in `shared/runtime` next to decay, because the server applies the same rules.
- **Input source.** The hybrid input source moves from `features/training` to `shared` in P3: the typing session and the learning session both use it, and slices on one layer do not import each other.
- **Audio.** `AudioProvider` (`play(key: KanaKey): void`) is a type in `shared/types`, injected like `Clock`. Until P6 a provider that plays nothing is used. From P6 the provider in `apps/web/src/shared/lib/audio` is loaded with a dynamic `import()` when a learning session starts, prefetches the sounds of the track's unlocked kana and plays the file named by the `sound` field of the kana's table entry. The engine never reads that field. The hiragana and katakana of one entry share its sound, and entries with the same pronunciation share a file (じ/ぢ, ず/づ, お/を). Sound files are static assets and never part of the first load ([Budgets and quality](quality.md)).
- **Validation:** valibot schemas in `shared` are used by the server only. The client imports shared/types and shared/runtime only, so schemas and valibot are not bundled.
- **TypeScript and ESLint strictness**: TypeScript strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitReturns, noFallthroughCasesInSwitch, noImplicitOverride, verbatimModuleSyntax; ESLint strictTypeChecked with no any, no type assertions, no non-null assertions, no inline disable comments, and FSD boundary rules; configuration moves to a root base config inherited by each package.
- **Versions:** Node ≥ 24, pnpm ≥ 10. Baseline versions of Preact, Vite, Tailwind, TypeScript and Vitest are retained.
