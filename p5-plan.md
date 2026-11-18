# P5 plan: backend and sync

Working file of phase P5 ([phases.md](docs/spec/phases.md), item 6). It tells the executor of each pull request what to build, in which order, and which decisions are already made. It is not part of `docs/`: the last pull request of the phase moves it to `docs/archive/`.

- Written on 2026-11-15 against `main` at d70c954 (PR 154 merged).
- Where this plan and `docs/spec/` disagree, the spec wins until the pull request named here changes the spec. Every such change is listed under [Q5](#q5-spec-amendments); the maintainer approved the list on 2026-11-15.
- Sections: [status](#status), [goal and scope](#1-goal-and-scope), [what was checked](#2-what-was-checked), [decisions](#3-decisions), [questions](#4-questions-for-the-maintainer), [manual steps](#5-maintainers-manual-steps), [pull requests](#6-pull-requests), [executor instructions](#7-instructions-for-executor-agents), [risks](#8-risks).

## Status

The executor of a pull request fills its row (see [section 7](#7-instructions-for-executor-agents)).

| PR  | Branch                   | Status      | Pull request |
| --- | ------------------------ | ----------- | ------------ |
| 1   | `p5-01-sync-measurement` | done        | #162         |
| 2   | `p5-02-api-scaffold`     | done        | #164         |
| 3   | `p5-03-auth`             | done        | #165         |
| 4   | `p5-04-merge-patch`      | done        | #167         |
| 5   | `p5-05-api-sync`         | done        | #168         |
| 6   | `p5-06-local-view`       | done        | #169         |
| 7   | `p5-07-sync-engine`      | done        | #170         |
| D   | `docs/p5-design`         | done        | #157         |
| 8   | `p5-08-account`          | not started |              |
| 9   | `p5-09-sync-e2e`         | not started |              |
| 10  | `p5-10-history`          | not started |              |
| 11  | `p5-11-account-deletion` | not started |              |
| 12  | `p5-12-report`           | not started |              |
| 13  | `p5-13-acceptance`       | not started |              |

**Amended on 2026-11-16 by [ADR 082](docs/adr/082-sync-acknowledgement-without-snapshot.md)** after PR 1 failed its limits: a sync is acknowledged without the snapshot, `GET /api/sync` answers by parts, the learning columns are read by `json_extract` paths, and the CPU line is the warm median. D7, D12, PR 4, PR 5, PR 7 and section 8 carry the changes; where another line of this plan still speaks of a snapshot in the response, the ADR wins.

The maintainer answered every question of [section 4](#4-questions-for-the-maintainer) on 2026-11-15: the recommended option each time. The answers are on the **Answer** line of each question; a later question is answered the same way.

## 1. Goal and scope

**What the user gets.** A learner signs in with Google or GitHub and their learning progress, typing statistics, records and settings follow them to every device. Guest data is merged into the account at the first sign-in. The application keeps working offline and sends what it has when the network returns. A signed-in user can sign out, delete the account, and read older test history from the server. Anyone, guest or not, can report a wrong reading or translation of a word or phrase.

**In scope** ([phases.md](docs/spec/phases.md), P5): Pages Functions with Hono, `_routes.json`, D1 migrations, Google and GitHub OAuth, sessions, `POST` and `GET /api/sync` with `seq` handling, the merge rules and optimistic concurrency, the Web Lock, guest merge, sign-out, the expired session, failed requests, server history, the account section of `/settings`, account deletion, the report dialog with Turnstile and `POST /api/reports`.

**Out of scope:**

- Reset for a signed-in user, "Reset learning" included: v1.1 (A33, A45, [backlog.md](docs/spec/backlog.md)).
- Server-side verification of results and leaderboards: v2 ([backend.md](docs/spec/backend.md), "Authentication and security").
- Sign-in on preview deployments: Google accepts no wildcard redirect URI ([backend.md](docs/spec/backend.md), "Environments").
- Moderation of content reports: v2 ([backlog.md](docs/spec/backlog.md)). P5 only stores them.
- The stored-data section of `/about` and the accessibility and device-matrix passes: P7.
- IndexedDB migrations: a schema change resets the local data until the release ([ADR 061](docs/adr/061-schema-reset-before-release.md)).
- Kana audio: P6.
- A custom domain, WAF rules and any paid Cloudflare feature (A6, A16).

## 2. What was checked

Checked on 2026-11-15 against the npm registry and the vendor documentation. "Not confirmed" items are not assumptions the plan rests on silently: each has a pull request that confirms it and a fallback.

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hono`                             | 4.13.18. `handle` from `hono/cloudflare-pages`, `export const onRequest = handle(app)`, `basePath('/api')`, bindings through `c.env`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `arctic`                           | 3.7.0, released 2025-05-21 and not updated since. `new Google(id, secret, redirectURI)`, `createAuthorizationURL(state, codeVerifier, scopes)`, `validateAuthorizationCode(code, codeVerifier)`; `new GitHub(id, secret, redirectURI)`, `createAuthorizationURL(state, scopes)`, `validateAuthorizationCode(code)`; `decodeIdToken`, `generateState`, `generateCodeVerifier` (read from the package's type declarations)                                                                                                                                                                                                                                                        |
| `valibot`                          | 1.5.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `wrangler`                         | 4.162.0. `pages dev` (default port 8788, `--port`, `--binding KEY=VALUE`, `--persist-to`), `pages deployment tail [deployment] --project-name --environment --format`, `pages secret put <KEY> --project-name`, `d1 migrations apply <database> --local / --remote`, which skips its confirmation when not interactive                                                                                                                                                                                                                                                                                                                                                          |
| API tests                          | `@cloudflare/vitest-pool-workers` 0.23.0 requires Vitest `^4.1.0`; the repository uses Vitest 5.0.5. Its successor `@cloudflare/vitest-plugin` 1.8.2 accepts `^4.1.0 \|\| ^5.0.0`: `cloudflareTest()` in `vitest.config.ts`, `env` from `cloudflare:workers`, `applyD1Migrations` from `cloudflare:test`, `readD1Migrations` from `@cloudflare/vitest-plugin/config`, storage isolated per test file                                                                                                                                                                                                                                                                            |
| Pages configuration                | `wrangler.toml` needs `name`, `pages_build_output_dir`, `compatibility_date`; the only environments are `[env.preview]` and `[env.production]`; `vars` and `d1_databases` are not inherited, and an environment that overrides one must define all; the file becomes the source of truth for the project's settings                                                                                                                                                                                                                                                                                                                                                             |
| `_routes.json`                     | `{ "version": 1, "include": [...], "exclude": [...] }` in the build output directory; excluded requests do not invoke Functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Workers Free                       | 10 ms CPU, 50 subrequests, 128 MB, 100,000 requests a day (page updated 2026-11-13); a Worker over the CPU limit is answered with error 1102                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D1 Free                            | 50 queries per invocation, 100 bound parameters, 100 KB statement, 2 MB row, 500 MB database, 10 databases per account (page updated 2026-10-30)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Tail events                        | `TraceItem` in `@cloudflare/workers-types` has `cpuTime` and `wallTime`; `D1Meta` has `rows_read`, `rows_written`, `changes`, `duration`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Turnstile                          | Test site keys `1x00000000000000000000AA` (passes) and `2x00000000000000000000AB` (fails); test secrets `1x0000000000000000000000000000000AA` (passes) and `2x0000000000000000000000000000000AA` (fails); they work on any host, `localhost` included. A widget's hostname also authorizes its subdomains                                                                                                                                                                                                                                                                                                                                                                       |
| Initial JS                         | 31.27 of 35 KB gzip on `main` (`pnpm run build && pnpm run budget`), 3.73 KB of headroom; initial CSS 8.76 of 10 KB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Design                             | Drawn: the account section, the sign-out and delete dialogs, the report dialog with its offline state (`ScreenSettings` and `ScreenTest` in the design artifact, decisions 23 and 79). Not drawn: see [Q2](#q2-design-gaps)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Pages commands in an agent session | Found on 2026-11-15 while doing M1. Since wrangler 4.108, `wrangler pages project create` and `wrangler pages deploy`, when an AI coding agent runs them for a new and purely static project, are handed to Workers static assets instead of Pages ("Delegating to the latest version of Cloudflare Pages, now part of Cloudflare Workers"); `--force` opts out. An existing Pages project, a project with Pages Functions or a `_routes.json`, and a run outside an agent (CI, a plain terminal) are not affected, by the release notes of 4.108.0. An executor who sees that notice on a deploy stops and reports; it does not retry, and it does not let a Worker be created |
| Not confirmed: deploy              | That `wrangler pages deploy apps/web/dist`, run from the repository root, uploads `./functions` and applies the root `wrangler.toml`. The documentation pages read do not say it. PR 2 confirms it in the deploy log and with the smoke test                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Not confirmed: `json_each`         | How `json_each` counts toward `rows_read` (O4). PR 1 measures it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Not confirmed: tail on Pages       | That `pages deployment tail --format json` prints `cpuTime`. PR 1 confirms it; the fallback is the CPU time chart of the Pages project in the dashboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Not confirmed: test plugin         | Confirmed in PR 2 ([ADR 083](docs/adr/083-api-package-and-pages-configuration.md)): `@cloudflare/vitest-plugin` 1.8.4 runs with Vite 8, Vitest 5 and a D1 binding, without a `main`; `readD1Migrations` is exported from the package's entry, not from a `/config` path                                                                                                                                                                                                                                                                                                                                                                                                         |
| Not confirmed: wrangler flags      | `d1 migrations list` and `apply` accept `--env preview` with a Pages configuration (confirmed in PR 2, with the binding `DB` and with the database name). `pages secret put --env preview` is still not confirmed: the dashboard path of M5 is the alternative                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 3. Decisions

Each decision fills a gap the spec leaves open. A decision that changes a sentence of the spec is also listed under [Q5](#q5-spec-amendments), which the maintainer approved; the spec itself changes in the pull request named there.

### Server

#### D1. Server code lives in `apps/api`, mounted by a root `functions` entry

- `apps/api` is the workspace package `@nekotype/api` (private, TypeScript source, no build step), as [architecture.md](docs/spec/architecture.md) lays out and as the lint rule in `apps/web/eslint.config.js` already expects.
- `functions/api/[[route]].ts` at the repository root is one line: `export { onRequest } from '../../apps/api/src/pages-entry';`. The import is relative because the root package has no dependency on Hono; everything else resolves from `apps/api`.
- `apps/api/src/pages-entry.ts` builds the application with the real dependencies and exports `onRequest = handle(app)`.
- `apps/api/tsconfig.json` includes `../../functions`, so the entry is type-checked. A unit test in `apps/api` fails when the entry file is anything but that one line.
- The package is not Feature-Sliced: FSD is the layout of `apps/web`. Its layout:

  ```
  apps/api/
  ├── migrations/            D1 migrations (D5)
  ├── src/
  │   ├── pages-entry.ts     real dependencies, onRequest
  │   ├── app.ts             createApp(deps): middleware and route mounting
  │   ├── env.ts             Env (bindings and variables), AppDeps
  │   ├── routes/            auth.ts, me.ts, sync.ts, results.ts, reports.ts
  │   ├── auth/              session.ts, providers.ts (Arctic), users.ts
  │   ├── db/                statements per table; the only place with SQL
  │   ├── sync/              apply-batch.ts: the server side of "Applying a batch"
  │   └── lib/               errors.ts, origin.ts, body.ts
  └── vitest.config.ts
  ```

- Import rules, enforced by `no-restricted-imports` in `apps/api/eslint.config.js` on top of `createBaseConfig`: `routes` → `auth`, `db`, `sync`, `lib`; `sync` → `db`, `lib`; `auth` → `db`, `lib`; `db` → `lib`; nothing imports `routes`. The package must not import `@nekotype/web`, `@nekotype/content` or `@nekotype/engine` ([architecture.md](docs/spec/architecture.md): the engine reaches the server in v2).
- The same strictness as the rest of the repository: no `any`, no assertions. A D1 row and a parsed JSON value are `unknown` and are narrowed with the guards of `@nekotype/shared/runtime`; `first<T>()` with a type argument is an assertion in disguise and is not used.

#### D2. The application is a factory with injected dependencies

- `createApp(deps: AppDeps)` returns `new Hono<{ Bindings: Env; Variables: { userId: string } }>().basePath('/api')`.
- `AppDeps = { clock: Clock; randomBytes: (n: number) => Uint8Array; oauth: OAuthProviders; verifyTurnstile: (token: string, ip: string | null, secret: string) => Promise<boolean> }`. `Clock` is the type of `@nekotype/shared/types`. Tests pass fakes; `pages-entry.ts` passes the real ones. This is the server's form of the repository rule that time and randomness are injected.
- `OAuthProviders` hides Arctic: per provider, `authorizationUrl(state, codeVerifier, redirectUri): URL` and `profile(code, codeVerifier, redirectUri): Promise<OAuthProfile>`, where `OAuthProfile = { providerUserId: string; email: string | null; displayName: string | null; avatarUrl: string | null }` and `email` is set only when the provider says it is verified. Arctic uses the global `fetch` and cannot be handed a fake one, so the seam is above it.
- Middleware, in this order: `onError` (a D1 failure → `503 unavailable`; anything else → `500` with code `internal`), the `Origin` check on every `POST` and `DELETE` (`403 bad_origin`; a missing `Origin` header is rejected), the body limit (`413 too_large`), the session (`401 unauthenticated`) on the routes that need it, schema validation (`400 invalid_body`). `notFound` answers `404` with code `not_found`.
- The allowed origin is `env.APP_ORIGIN` when set, otherwise the origin of the request URL. It also builds the OAuth redirect URI. Production sets it to `https://nekotype.pages.dev`, local development to `http://localhost:5173`; previews leave it unset.
- No `@hono/valibot-validator`: a five-line helper calls `v.safeParse`. `hono/cookie` and `hono/body-limit` come with Hono.

#### D3. `_routes.json` and the Vite proxy

- `apps/web/public/_routes.json` is `{ "version": 1, "include": ["/api/*"], "exclude": [] }`; Vite copies it into `dist`. A unit test next to `redirects.test.ts` keeps its content.
- `apps/web/vite.config.ts` proxies `/api` to `http://localhost:8788` in the dev server ([backend.md](docs/spec/backend.md), "Local development"). The browser origin in development is always `http://localhost:5173`.

#### D4. `wrangler.toml` at the repository root

The deploy command runs from the root, so the configuration and `functions/` sit there. `wrangler` becomes a root `devDependency` (pinned by the lockfile); CI stops using `pnpm dlx wrangler@4`. `workerd` is added to `onlyBuiltDependencies` in `pnpm-workspace.yaml`.

```toml
name = "nekotype"
pages_build_output_dir = "apps/web/dist"
compatibility_date = "2026-11-01"

# Top level: local development (wrangler pages dev).
[vars]
ENVIRONMENT = "development"
APP_ORIGIN = "http://localhost:5173"
SYNC_MIN_INTERVAL_MS = "5000"

[[d1_databases]]
binding = "DB"
database_name = "nekotype-dev"
database_id = "00000000-0000-0000-0000-000000000000" # local only, never created remotely
migrations_dir = "apps/api/migrations"

[env.preview.vars]
ENVIRONMENT = "preview"
SYNC_MIN_INTERVAL_MS = "5000"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "nekotype-preview"
database_id = "<from manual step M2>"
migrations_dir = "apps/api/migrations"

[env.production.vars]
ENVIRONMENT = "production"
APP_ORIGIN = "https://nekotype.pages.dev"
SYNC_MIN_INTERVAL_MS = "5000"

[[env.production.d1_databases]]
binding = "DB"
database_name = "nekotype"
database_id = "<from manual step M2>"
migrations_dir = "apps/api/migrations"
```

- Secrets (never in the file): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY`. Production has all five; preview has `TURNSTILE_SECRET_KEY` only; local development reads them from `.dev.vars` at the root (`.dev.vars.example` is committed; `.gitignore` already excludes the real file).
- Database ids are not secrets and are committed.
- `SYNC_MIN_INTERVAL_MS` exists so that the e2e server can set it to `0` (D9). It is a committed variable, not something a request can change.
- Root scripts: `dev:api` (`mkdir -p apps/web/dist`, apply the migrations to the local D1, `wrangler pages dev --port 8788`) and `db:migrate:local`.

#### D5. D1 migrations

- Files in `apps/api/migrations/`, named `NNNN_title.sql`. `0001_init.sql` is the schema of [backend.md](docs/spec/backend.md) plus `CREATE INDEX users_email ON users(email)` ([Q5](#q5-spec-amendments), S1).
- A merged migration is never edited. A migration must work with the code deployed before it (new tables, new columns with defaults), because the preview database is shared by every pull request and production is migrated before its deploy.
- Local: `pnpm run db:migrate:local`; `dev:api` and the e2e server run it themselves. API tests apply the files with `applyD1Migrations`.
- Preview and production: CI. `deploy.yml` applies the migrations to `nekotype-preview` before a preview deployment (pull requests of this repository and the `release-candidate` deployment of `main`), and to `nekotype` after the candidate's smoke test and before the production deploy. Fork pull requests have no secrets and skip it, as they skip the deploy.
- Justification: a manual step would be forgotten, and a deploy that needs a missing table fails for the user. `wrangler d1 migrations apply` records what is applied and captures a backup first. The cost is one more permission on the CI token (M2).

#### D6. Sessions and OAuth

Everything [backend.md](docs/spec/backend.md) ("Authentication and security") states stands. What it leaves open:

- **State.** `GET /api/auth/:provider` sets the cookie `nt_oauth` (`HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=600`) with the state and, for Google, the PKCE code verifier, then redirects to the provider. The callback compares the state and deletes the cookie.
- **`Secure`.** `nt_session` and `nt_oauth` carry `Secure` unless `APP_ORIGIN` starts with `http://` (local development and e2e).
- **Google.** Scopes `openid email profile`. The profile comes from the ID token of the token response (`sub`, `email`, `email_verified`, `name`, `picture`): it arrives from Google's token endpoint over TLS, so its signature is not checked again. No further request.
- **GitHub.** Scopes `read:user user:email`. `GET https://api.github.com/user` and `GET https://api.github.com/user/emails` with a `User-Agent` header; the email is the entry with `primary` and `verified` both true. Three subrequests with the code exchange, of 50 allowed.
- **Linking (A4).** Find the user by `(provider, provider_user_id)`; else, with a verified email, by `users.email`; else create one. `users.email` holds a verified address in lower case, or `NULL`: an unverified address must never link accounts later ([Q5](#q5-spec-amendments), S2). The user, its `oauth_accounts` row and its `user_stats` row are written in one `batch()`. The initial `user_stats` JSON: `kana_stats` `{}`, `counters` zeros, `learn` `{"unlocked":{"hiragana":[],"katakana":[]},"entries":{},"stats":{},"activeDays":[]}`, `learn_recent` `{}`, `learn_buckets` `{"hiragana":{},"katakana":{}}`, `typing_records` `{}`, `device_seq` `{}`.
- **Ids.** `users.id` and `content_reports.id` are `crypto.randomUUID()`.
- **Session.** 32 bytes from `deps.randomBytes`, base64url in the cookie, the SHA-256 hex digest in `sessions.id_hash` (Web Crypto). One query per authenticated request. A session with less than 15 days left is extended and the cookie set again. An expired row is deleted when it is seen; a sign-in deletes the user's other expired rows.
- **Callback result.** Success redirects to `/`. `error=access_denied` from the provider redirects to `/?auth_error=denied`; a state mismatch, a failed exchange or a failed profile request to `/?auth_error=failed`.
- **Preview.** With `ENVIRONMENT` = `preview`, `/api/auth/*` answers `404 not_found` ([Q5](#q5-spec-amendments), S3). The other routes work, so reports can be tried on a preview.
- **Logout.** `POST /api/auth/logout` deletes the session row and the cookie and answers `204`, also when there was no valid session.

#### D7. `/api/sync` details

"Applying a batch" in [backend.md](docs/spec/backend.md) is the algorithm. What it leaves open:

- **Order of checks.** `Origin` → body size → session → schema → read the row → `seq` rule → rate limit → apply. A batch with `seq` ≤ last is answered like an applied one, with `lastSeq` and `version`, and is not rate-limited (it writes nothing); `seq` > last + 1 is `409`; only a batch that would be applied is checked against `last_sync_at` and `SYNC_MIN_INTERVAL_MS`, and a `429` carries `Retry-After` in whole seconds.
- **`device_seq`.** The value per device is `{ "seq": number, "at": number }`, because the 90-day cleanup needs the time of the last update ([Q5](#q5-spec-amendments), S4).
- **Reads** ([ADR 082](docs/adr/082-sync-acknowledgement-without-snapshot.md)). One `batch()`: the small columns with `bucket_newest`, `json_extract(learn, '$.unlocked')`, `json_extract(learn, '$.activeDays')` and the touched days of `learn_buckets`; then `json_extract(column, ?, …)` statements of at most 98 bound paths for the touched kana of `learn_recent`, of `learn.entries` and of `learn.stats`. At the caps that is 4 statements. No `json_each` on a stored column. `apps/bench/src/apply-keyed.ts` is the measured model of these reads, not code to copy: it approximates the window rule and does not remove `mixups` keys.
- **Writes.** One `batch()`: the `UPDATE` (three `json_patch` columns, `bucket_newest`, no `RETURNING`), the `INSERT OR IGNORE INTO results … SELECT … FROM json_each(?)`, and the settings upsert when the batch carries settings. The response is `{ lastSeq, version }`.
- **`GET /api/sync`.** Without `part`: `{ lastSeq, version }` from one read by the key. `part=rest`, `recent`, `buckets`: one part with `version` ([backend.md](docs/spec/backend.md), types `SnapshotRest`, `SnapshotRecent`, `SnapshotBuckets`), each assembled in SQL or by concatenation, never parsed.
- **Settings.** `seq` = 1: `INSERT OR IGNORE` (the account's settings win). Otherwise `INSERT … ON CONFLICT(user_id) DO UPDATE … WHERE excluded.updated_at > user_settings.updated_at`.
- **Query count.** At most 2 for the session (the lookup and a renewal), then at most 4 reads and 3 writes, repeated at most once by the version retry: at most 16 of 50 for a batch within the caps.
- **Typing records.** The batch's results are sorted by `endedAt`, then `id`, and folded into the stored records with the function of D13; a result already counted changes nothing.
- **`unlocked`.** The server has no kana table ([architecture.md](docs/spec/architecture.md)), so it keeps each track's unlocked kana as a set sorted by key; the client puts them in track order when it builds its view ([Q5](#q5-spec-amendments), S5).
- **Snapshot.** Built from the returned column strings by concatenation ([ADR 078](docs/adr/078-user-stats-targeted-updates.md), item 4): the `learn` column without its closing brace, then `,"recent":`, `learn_recent`, `,"recallBuckets":`, `learn_buckets`, `}`.
- **`results` columns.** `config` holds `time:60`, `count:25` or `zen`; `json` holds the whole `TestResult`.
- **`GET /api/sync`.** One `SELECT` of the whole row and one of the settings. The client also uses it to pull other devices' changes when it has nothing to send (D17; [Q5](#q5-spec-amendments), S6).
- **Per-batch caps** on the learning part of a batch: see [Q1](#q1-a-large-delta-against-the-256-kb-body-and-the-cpu-limit).

#### D8. API tests

- `apps/api` has its own `vitest.config.ts` with `cloudflareTest()` from `@cloudflare/vitest-plugin`, pointed at `apps/api/wrangler.test.toml`: a minimal Workers configuration (`name`, `main = "src/test-worker.ts"`, `compatibility_date`, the D1 binding `DB`, the variables of D4 with `ENVIRONMENT = "test"`). It is separate from the root Pages configuration on purpose: the tests must not depend on how the plugin reads a Pages file.
- Tests are colocated `*.test.ts`, run inside workerd, take `env` from `cloudflare:workers`, apply the migrations in a setup file, and call `createApp(fakeDeps).request(path, init, env)`. Each test file has its own storage.
- OAuth is tested through a fake `OAuthProviders`; the Arctic-backed implementation has one test file of its own with a stubbed global `fetch` (the Google claims; the GitHub primary verified address).
- A wrapper around `env.DB` counts statements and sums `meta.rows_written`, for the limits of the acceptance.
- They are part of `pnpm test`, so of `verify:quick`, the pre-commit and pre-push hooks and CI. The root script already runs packages one at a time.
- **Fallback, decided now:** if the plugin does not run in this repository (PR 2 finds out), the tests run in Node with `getPlatformProxy()` from `wrangler`, which gives the same D1 binding, and `createApp().request()`. The executor of PR 2 records which one was used in the ADR of that pull request; nothing else in this plan changes.

#### D9. e2e against Functions, with no test code in the deployed bundle

- A second Playwright configuration, `apps/web/playwright.sync.config.ts`, with `testDir: './e2e/sync'` and Chromium only. Its `webServer` builds `dist-e2e-sync`, applies the migrations to a local D1 in a temporary `--persist-to` directory and starts `wrangler pages dev` on port 5274 from the directory `apps/web/e2e/sync-server/`. The existing configuration and its `vite preview` server are not touched. `pnpm run e2e` runs both configurations, so CI and `verify` include it.
- `apps/web/e2e/sync-server/` has its own `wrangler.toml` (`ENVIRONMENT = "test"`, `APP_ORIGIN = "http://localhost:5274"`, `SYNC_MIN_INTERVAL_MS = "0"`, a local D1) and its own `functions/api/[[route]].ts`. That entry calls `createApp` with a **fake `OAuthProviders`**: `authorizationUrl` points at `/api/test/authorize`, a route defined in this entry only, which reads the cookie `e2e_user` and redirects to the real callback with it as the code; `profile(code)` returns a verified `<code>@example.test`. The real callback, session and user code run; a test signs in by pressing the real button after setting one cookie.
- Why this is not a backdoor: the fake provider and the test route live in `apps/web/e2e/`, the deployed bundle is built from the root `functions/` only, and `apps/api/src` has no test-only branch. A unit test in `apps/api` fails if anything under `apps/api/src` or `functions/` imports from `apps/web` or contains the string `api/test`.
- The client's timers are moved with Playwright's clock where a test would wait 10 seconds.
- Turnstile is not part of any e2e: the widget needs Cloudflare's network. The report dialog is covered by DOM tests with a fake loader and the endpoint by API tests ([quality.md](docs/spec/quality.md) lists no report e2e).
- e2e files: `guest-sign-in.spec.ts` (a guest with a learning session and a typing test signs in; after a reload in a fresh context the same account shows both), `offline-online.spec.ts` (a test finished offline stays visible, then arrives), `two-tabs.spec.ts` (two tabs of one device finish work at the same time; one batch each, nothing lost, nothing doubled). Two devices are covered below the browser (D12, PR 5, PR 7): nothing in that case needs one ([ADR 052](docs/adr/052-e2e-scope-and-latency-on-main.md)).

#### D10. `shared/schemas`

- `packages/shared/src/schemas.ts`, exported as `@nekotype/shared/schemas`; `valibot` becomes a dependency of `@nekotype/shared`. Schemas: `syncRequestSchema` (with `settingsSchema`, `testResultSchema`, `learnDeltaSchema`), `reportRequestSchema`, `resultsQuerySchema`, `deviceIdSchema`.
- Each schema is declared `satisfies v.GenericSchema<unknown, T>` against its type in `shared/types`, so a type and its schema cannot drift apart at compile time. A test feeds the fixtures of `isSettings` and `isTestResult` to both the guard and the schema and expects the same verdict.
- Objects are `v.strictObject`: an unknown key is `400`, never dropped in silence (A28 then holds the batch until a new version).
- Bounds, all in the schemas: `v` = 1; `deviceId` and `TestResult.id` are UUIDs; `seq` is an integer ≥ 1; at most 50 results; at most 10 recall answers per kana; a kana key matches `isLearnKanaKey` and is at most 24 characters; bucket indices 0–100; counts are non-negative integers; `contentVersion`, `appVersion` and `itemId` are at most 64 characters; the report comment at most 500.
- Kept out of the client by what exists already: the `no-restricted-imports` rule of `apps/web/eslint.config.js`, the rule on `shared/runtime` in `packages/shared/eslint.config.js`, and `app/lint-rules.test.ts`, which gets one more case (an import of `@nekotype/shared/schemas` from `apps/web` is an error).

### Shared

#### D11. One merge function for the learning state

- `LearnDelta` has the fields of `LearnState` ([backend.md](docs/spec/backend.md)), so a delta is a `LearnState` that holds only changes. One function serves every case: `mergeLearn(a, b, order?)` merges a state with a delta, a delta with a delta, and a snapshot with an outbox.
- It applies the rules of [storage-sync.md](docs/spec/storage-sync.md) field by field with the functions that exist: `mergeUnlocked`, `mergeEntries`, `mergeRecent`, `addLearnStats` then `decayLearnStat`, `mergeActiveDays`, `addBuckets`. `order` is the track order of each track; without it the unlocked kana are sorted by key (the server's form, D7).
- `emptyLearnState()` is the neutral element (no unlocked vowels; the client's `initialLearnState()` adds them).
- Statistics are merged in the order the server sees them: `decay(add(decay(add(snapshot, outbox)), delta))`.
- For typing: `mergeKanaStats(a, b)` (add, then `decayKanaStat`, per kana) and `addCounters`.

#### D12. Per-key patch functions (ADR 078) and splitting a delta

New module `packages/shared/src/learn-patch.ts`, exported from `@nekotype/shared/runtime`:

```ts
type TouchedKeys = {
  readonly kana: readonly LearnKanaKey[]; // keys of delta.recent
  readonly days: Readonly<Record<Track, readonly string[]>>; // days of delta.recallBuckets
};
function touchedKeys(delta: LearnDelta): TouchedKeys;

/** `stored`: the stored lists of the touched kana only. Returns the new list of every touched kana. */
function patchRecent(
  stored: Readonly<Record<LearnKanaKey, readonly RecallAnswer[]>>,
  delta: LearnDelta['recent'],
): Record<LearnKanaKey, RecallAnswer[]>;

/**
 * One track. `storedDays`: the stored buckets of the touched days only; `allDayKeys`: every stored
 * day key of the track. Returns the new buckets of every touched day, and `null` for every day that
 * is more than 365 days behind the newest day of the stored and the touched days together.
 */
function patchBuckets(
  storedDays: DayBuckets,
  allDayKeys: readonly string[],
  delta: DayBuckets,
): Record<string, Readonly<Record<string, number>> | null>;

/** Caps the learning part of a batch (Q1). `head` goes into the batch, `rest` stays in `delta`. */
function splitLearnDelta(
  delta: LearnDelta,
  caps: { readonly kana: number; readonly days: number },
): { readonly head: LearnDelta; readonly rest: LearnDelta };
```

- The return values are JSON Merge Patches (RFC 7396) for `learn_recent` and for one track of `learn_buckets`. A list is replaced whole and a day's object is given whole, so the recursive merge of `json_patch` cannot leave a stale bucket.
- `splitLearnDelta`: `head` takes the entries, recent answers and statistics of the first `caps.kana` kana in key order, the first `caps.days` days of each track in ascending order, and all of `unlocked` and `activeDays`.
- **Equivalence test** (acceptance): for generated stored states and deltas, applying the patches to the stored columns with a reference implementation of RFC 7396 gives the `recent` and `recallBuckets` of `mergeLearn(stored, delta)`. PR 5 repeats a sample of the cases against SQLite's `json_patch` on the local D1.
- **Property tests** (acceptance) follow the repository's way: a seeded `Rng`, generated cases in a loop, the failing seed in the message; no new library. Idempotent, commutative and associative: `mergeEntries`, `mergeUnlocked`, `mergeRecent`, `mergeActiveDays`, `mergeTypingRecords`. Commutative and associative: `addLearnStats`, `addBuckets`, `addKanaStats`, `addCounters`, without decay. Convergence: two devices that answer on one track and exchange their deltas through `mergeLearn` in any order end with equal unlocked kana, recent answers, boxes, active days and buckets. Splitting: `mergeLearn(head, rest)` equals the delta, `head` respects the caps, and applying `head` then `rest` equals applying the delta.

#### D13. Typing records as a merge

- `mergeTypingRecords(a, b)`: per key, `best` is the higher KPM, and `recent` is the union by `resultId`, the 10 latest by `endedAt`, then by id.
- `applyResultsToRecords(records, results)` folds `applyResultToRecords` over results sorted by `endedAt`, then id.
- **Tie rule:** with equal KPM the entry with the smaller `resultId` is the best. Today the first result applied wins, which depends on the order of application and breaks commutativity. `isBest` on the results screen stays "strictly higher than the previous best", so nothing visible changes ([Q5](#q5-spec-amendments), S7).

#### D14. The year-of-learning generator

- `packages/shared/src/testing/year.ts`, exported as `@nekotype/shared/testing`. `generateYear({ seed, keys })` returns `{ learn, kanaStats, counters, typingRecords, deviceSeq }` and `generateBatch({ seed, keys, kind })` returns a `SyncRequest` of kind `learning` (30 kana of one track, one day, no results), `capped` (the caps of Q1) or `results` (50 results with their typing delta).
- The data is that of [ADR 078](docs/adr/078-user-stats-targeted-updates.md): 229 kana with 10 recall answers each, 365 days of buckets per track with about 25 buckets a day, statistics for every kana, records for 12 modes, three devices. A test asserts the serialized sizes: the three learning columns within 10% of 300 KB.
- `keys` are the kana keys of both tracks. `shared` must not import the engine, so they come from `packages/shared/src/testing/kana-keys.json`; a test in `apps/web` keeps the file equal to `keysOfTrack`.
- Used by: the measurement (PR 1, PR 5, PR 13), the API tests (PR 5), the sync engine tests (PR 7). `apps/web` may import it from test files only (a lint rule).

### Client

#### D15. IndexedDB schema 4

One pull request (PR 6) changes the stores, so the local data resets once ([ADR 061](docs/adr/061-schema-reset-before-release.md)). `SCHEMA_VERSION` becomes 4.

| Store      | Change                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `snapshot` | New. Key `current`: the last `Snapshot` of the server, or that snapshot with the device's own acknowledged batches applied (ADR 082); `meta.snapshotVersion` is its `version`. Absent for a guest                                                                                                                                                                 |
| `outbox`   | New. Key `current`: `{ seq, request, resultIds }`, the one batch awaiting acknowledgement ([Q5](#q5-spec-amendments), S8: the spec names the key `seq`)                                                                                                                                                                                                           |
| `delta`    | Same keys and shapes. `learn` (`{ learn, counters }`) becomes what the spec says it is: the changes since the last batch. For a guest that is still the whole state, so guest behaviour does not change. `typing` likewise                                                                                                                                        |
| `meta`     | New keys: `deviceId`, `userId`, `lastSeq`, `syncBlockedAtVersion`, `sessionExpired`, as in the spec, and three the spec lacks ([Q5](#q5-spec-amendments), S9): `settingsSyncedAt` (D16), `profile` (`{ displayName, email, provider }`, so that `/settings` can show the account offline) and `pendingSignIn` (`{ provider }`, written before the OAuth redirect) |
| others     | Unchanged                                                                                                                                                                                                                                                                                                                                                         |

The wrapper (`shared/lib/idb/idb.ts`) gets two methods, with the same behaviour in the memory fallback:

- `update(reads, compute)`: reads the given records and writes what the synchronous `compute(values)` returns, in one `readwrite` transaction. Every read-modify-write of P5 goes through it.
- `getByIndex(store, index, value, limit)`: the first `limit` records whose index equals `value` (the 50 unsynced results).

#### D16. Changed settings travel in `SyncDelta.settings`, taken from the `settings` store

[storage-sync.md](docs/spec/storage-sync.md) leaves this to P5 ("Changed settings go with `learn` until P5 decides otherwise").

- Settings are not copied into `delta`. The `settings` record is the only copy; `meta.settingsSyncedAt` is the `updatedAt` of the settings the server last acknowledged or sent.
- When a batch is built, `SyncDelta.settings` is the current document if its `updatedAt` is greater than `meta.settingsSyncedAt`, otherwise `null`.
- On acknowledgement with `version` = `snapshotVersion` + 1 the server holds the settings the batch carried: `settingsSyncedAt` is set to their `updatedAt`. When the snapshot is read from the server instead (ADR 082): if the local document has not changed since the batch was built, it is replaced by the `settings` of the `rest` part (when not `null`) and `settingsSyncedAt` is set to its `updatedAt`. If it has changed, it stays and goes with the next batch.
- Justification: whole-document last-write-wins needs no accumulator. The settings store keeps one writer and never touches `delta/learn`, which is the reason ADR 072 split the records; a learning write never rewrites settings. A guest who never changed a setting sends `null` and receives the account's settings.

#### D17. Where the client code lives, and what the initial chunk keeps

| Slice or file                     | Chunk                       | Holds                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities/user`                   | initial                     | Signals `userId`, `sessionExpired`, `profile`, `authError`, `authAvailable`; `initUser(db)` (reads `meta`); `beginSignIn(provider)` (writes `meta.pendingSignIn`, then navigates to `/api/auth/<provider>`); the `nekotype:user` channel. No `fetch`                                                                                           |
| `shared/lib/sync-request.ts`      | initial                     | `requestSync(reason)` and `onSyncRequest(handler)`: the end of a learning session and the end of a typing test call the first; the sync engine registers the second. With no handler (a guest) nothing happens                                                                                                                                 |
| `app/sync-bootstrap.ts`           | initial                     | After the database opens: `initUser`; reads and removes `auth_error` from the URL; if `userId` is set or `pendingSignIn` is present, `import('@/features/sync')` and start it; listens on `nekotype:user` to do the same when another tab signs in                                                                                             |
| `shared/api`                      | lazy                        | `apiFetch`: JSON, the error body of [backend.md](docs/spec/backend.md), `Retry-After`; `fetch` is injected                                                                                                                                                                                                                                     |
| `features/sync`                   | lazy, one chunk             | `model/engine.ts` (batches, outbox, the Web Lock, triggers, failed requests, catch-up, retention), `model/account.ts` (session check, guest merge, another user, sign-out, account deletion), `model/status.ts` (the sync status signal), `lib/` (pure: build a batch, apply an acknowledgement), `api/`, `ui/` (the "another account" dialog) |
| `pages/settings/ui/account-panel` | lazy, loaded when signed in | Profile, sync status, sign-out, delete account. The guest form (text and two buttons) is in the settings route chunk and imports `entities/user` only                                                                                                                                                                                          |
| `entities/stats/api/history.ts`   | with `/stats`               | `GET /api/results`; the typing store's `loadOlderResults()`                                                                                                                                                                                                                                                                                    |
| `pages/trainer` (report)          | lazy, loaded on open        | `ui/report-dialog.tsx`, `lib/turnstile.ts`, `api/reports.ts`. `frontend.md` names a slice `features/report-content`; it has one consumer, so [ADR 015](docs/adr/015-merging-widgets-layer-into-pages-trainer-ui.md) merges it into the page                                                                                                    |

- `features/sync` has two consumers (`app` and `pages/settings`) and `entities/user` three, so both stay slices.
- **A guest never loads the sync engine.** Every import of `@/features/sync` is dynamic and guarded by `userId`. `check-budget.mjs` gets a rule: the chunk that holds `src/features/sync/index.ts` is not the initial chunk and is not in the static imports of any route chunk; the idle prefetch does not fetch it.
- **Budget.** Allowances for the initial JS: PR 6 at most +1.4 KB (the merge functions and the view), PR 7 at most +0.3 KB, PR 8 at most +0.4 KB (the navigation link, the sign-in notice, their strings). The phase ends at 33.5 KB or less. An executor who cannot stay inside an allowance stops and asks; moving code out of the initial chunk is not theirs to decide.
- **Sync flow**, where the spec is silent:
  - A trigger with nothing to send does nothing, except `start` and `online`, which call `GET /api/sync` without `part` and read the three parts only when `version` differs from `meta.snapshotVersion` (ADR 082), so a device sees what the others did ([Q5](#q5-spec-amendments), S6).
  - The engine never reads the stores' memory. It works on IndexedDB and tells the stores to read again by posting on the channels they already listen to (`nekotype:learn`, `nekotype:typing`, `nekotype:settings`); a second channel object in the same tab receives the message too.
  - Without the Web Locks API the engine runs under a mutex of its own tab.
  - A `409` rewrites the `seq` of the outbox to `lastSeq + 1` and resends at once.
  - The block of A28 is lifted at start when `meta.syncBlockedAtVersion` differs from `__APP_VERSION__`.
  - Sync status, first match wins: `blocked`, `expired`, `offline` (`navigator.onLine` is false or the last request failed on the network), `pending` (an outbox, a non-empty delta, an unsynced result or unsent settings), `synced`.

#### D18. Two tabs: merges instead of overwrites

Replaces "Two tabs before P5" in [storage-sync.md](docs/spec/storage-sync.md).

- A store keeps three things in memory: the **view** it shows, the **unwritten** changes (a delta), and nothing else.
- Every action computes its change as a delta, applies it to the view incrementally (the cost stays that of one answer, as today) and merges it into `unwritten`.
- A write is `db.update`: read the stored `delta` record, merge `unwritten` into it, put it back, in one transaction; then `unwritten` is emptied and the tab posts on its channel. Two tabs can no longer overwrite each other.
- On a message, and after an acknowledgement, a store reads `snapshot`, `outbox` and `delta` and rebuilds its view: `mergeLearn` of the initial state, the snapshot, the outbox's delta and the stored delta, then its own `unwritten` on top. The whole-state merge runs only here, on load and on reload, never per answer.
- Typing: `saveTest` reads `delta/typing` and `records` in the same transaction that writes the result, so both tabs' tests count.
- Settings stay last-write-wins on the whole document, which is their merge rule.
- "Reset progress" (guests only) still clears and posts; the other tabs rebuild from nothing and drop `unwritten`.
- A unit test: two stores on one database, changes interleaved, both end with the union.

#### D19. Sign-in, the session and the device

- **Returning from OAuth.** `beginSignIn` writes `meta.pendingSignIn` before leaving the page; at the next start its presence means "a sign-in redirect has just returned" ([storage-sync.md](docs/spec/storage-sync.md), "Session state") and the client calls `GET /api/me`. The API does not change. `provider` is remembered for `sign in again` and for the `via GitHub` line of the profile.
- **`GET /api/me` result:**
  - `401` with `meta.userId` set: the `401` rule (A27). Without it (a sign-in that was abandoned): `pendingSignIn` is removed and the user stays a guest.
  - `200`, `meta.userId` unset: guest merge. One transaction writes `userId`, a new `deviceId`, `lastSeq` = 0, `profile`, and removes `pendingSignIn`; the engine starts and the first batch carries the guest's delta.
  - `200`, same user: `sessionExpired` and `pendingSignIn` are removed and syncing resumes with the same `deviceId` and `lastSeq`.
  - `200`, another user: the rule of [storage-sync.md](docs/spec/storage-sync.md) ("Different user"), with the dialog of [Q2](#q2-design-gaps).
- **`deviceId`** is `uuidv7(clock.now())` from `shared/lib/uuid.ts`, which the results already use. No new helper.
- **Sign-out** clears every user store and the user keys of `meta`, keeps `meta.schemaVersion`, `meta.typingIntervals` (the keyboard's K, a property of the device) and `nekotype:locale`. It also resets the settings to their defaults, and so does account deletion ([Q3](#q3-does-sign-out-clear-the-settings)).
- **"Reset progress"** is hidden whenever `meta.userId` is set, an expired session included (A33).

#### D20. Preview and the production host

- The client decides by host name, because one build is deployed to `release-candidate` (a preview) and then to production, so a build-time flag cannot tell them apart, and asking the server would cost a Functions request on every page load. `authAvailable` is true on `nekotype.pages.dev`, `localhost` and `127.0.0.1`, false anywhere else.
- When false, the navigation link `sign in` and the sign-in buttons are not rendered. The server refuses on its side (D6).
- If a custom domain is ever attached, it is added to that list and to the OAuth clients; the origin rule of A6 still applies.

#### D21. Turnstile

- The script `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` is added to the page when the report dialog opens, never before. The widget is rendered explicitly in the full-width, 65 px high slot of the design (size `flexible`, [ADR 089](docs/adr/089-sign-out-text-and-dialog-fields.md)) with the dark theme and the interface language. A token is used once: after a failed submit the widget is reset.
- Site keys are public constants in `pages/trainer/lib/turnstile.ts`, chosen by host: the production key on `nekotype.pages.dev`, the preview key on its subdomains, Cloudflare's always-passing test key elsewhere (`localhost`).
- The server reads `TURNSTILE_SECRET_KEY`. Without it the endpoint answers `503 unavailable`. With `ENVIRONMENT` = `production` it refuses Cloudflare's published test secrets, so a wrong secret cannot open the endpoint.
- `apps/web/public/_headers` needs no change: there is no Content-Security-Policy to extend.

#### D22. CI

- `deploy.yml`: `pnpm exec wrangler` instead of `pnpm dlx wrangler@4`; the two migration steps of D5; the timeout goes from 15 to 20 minutes if the measured run with the second e2e configuration is over 10 minutes (PR 9 measures).
- `smoke-deploy.mjs` also checks the API: `/api/unknown` answers `404` with the JSON error body on every deployment (from PR 2); from PR 3, `/api/me` answers `401`, and `/api/auth/google` answers `302` to `accounts.google.com` on production and `404` on a preview. This is the only automatic check of the production secrets.
- **Latency gate.** `LATENCY_PATHS` already lists `app/init.ts`, `app/main.tsx`, `vite.config.ts`, `pnpm-lock.yaml` and `deploy.yml`, so every pull request that adds a dependency or touches start-up runs the gate without a change. Added to the list: `apps/web/src/app/sync-bootstrap.ts` (PR 7), and `apps/web/src/entities/learn/model/` and `apps/web/src/shared/lib/idb/` (PR 6), because recall is one of the three measured runs and PR 6 changes what an answer does. The gate still runs on `main` before every deploy.

## 4. Questions for the maintainer

Each question has options, a recommendation, and the pull requests that wait for the answer. Write the answer on the **Answer** line.

### Q1. A large delta against the 256 KB body and the CPU limit

The spec contradicts itself. [storage-sync.md](docs/spec/storage-sync.md) sends a guest's whole delta in the first batch; [backend.md](docs/spec/backend.md) limits a body to 256 KB and a request to 10 ms of CPU. The learning state of a year on both tracks is about 300 KB, so a guest who learned for most of a year holds more than a body may carry: the first sync after sign-in would be answered `413` and, by A28, blocked until the next release. A smaller delta still makes the server parse, validate and merge every kana and every day at once, which is the whole-row work [ADR 078](docs/adr/078-user-stats-targeted-updates.md) measured at 7.9–15 ms and set out to avoid. A signed-in user who was offline for weeks meets the same limits more slowly.

- **Option A (recommended).** Cap the learning part of a batch: at most 60 kana (entries, recent answers and statistics) and 31 bucket days per track. The rest stays in `delta` and follows in catch-up batches 5 seconds apart, as unsynced results already do (`splitLearnDelta`, D12). The server rejects a batch over the caps with `400`. A normal sync (one session: at most 25 kana, one day) is never split; a year-long guest needs about 13 batches, about a minute. PR 1 measures a batch at the caps and may lower them.
- **Option B.** Raise the body limit to 512 KB and accept that a rare first sync may exceed 10 ms, relying on the platform's tolerance for infrequent overruns. The spec says the design does not rely on it (O4).
- **Option C.** Leave it and document the limit. A long-time guest then loses the ability to sync.
- **Waiting:** PR 1 (what to measure), PR 4, PR 5, PR 7.
- **Answer (2026-11-15):** option A. The caps of 60 kana and 31 bucket days per track are the starting values; PR 1 may lower them by its measurement, and the final values are recorded in the ADR of PR 1. **Confirmed on 2026-11-16** at 60 and 31 by [ADR 082](docs/adr/082-sync-acknowledgement-without-snapshot.md).

### Q2. Design gaps

The export in `docs/design/source/` and the previews in the design artifact cover the account section, the sign-out and delete dialogs and the report dialog for a phrase with its offline state. The items below are not drawn. Design changes go through the artifact, then the export and an ADR.

- **Option A (recommended).** A design session before PR 8 and PR 12: the items are drawn in the artifact from the proposals below, the maintainer approves, and pull request D exports them with an ADR and the spec changes.
- **Option B.** The executors build from the proposals below with existing components only, and the design catches up afterwards.

Proposals (existing components and tokens only; English / Russian):

| #   | Gap                                         | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a   | Report dialog for a word                    | Title `Report a problem with this word` / `Ошибка в слове`; the word in place of the phrase **Accepted: decision 114.**                                                                                                                                                                                                                                                                                                                          |
| b   | Report dialog while sending and after       | `send` disabled and reading `sending…` / `отправка…`. On success the body becomes one line, `Report sent.` / `Сообщение отправлено.`, with one action `close` **Accepted: decision 115; the dialog cannot be closed while sending.**                                                                                                                                                                                                             |
| c   | Report dialog failures                      | A `Notice tone="miss"` above the actions: `the check failed. try again.` / `проверка не пройдена. попробуйте ещё раз.` (Turnstile); `failed to send. check the connection and try again.` / `не удалось отправить. проверьте соединение.`; `failed to load the check. check the connection and try again.` with `retry` (the script) **Accepted: decision 116; wording changed: "verification", and `verification did not load.` with `retry`.** |
| d   | A running test when the dialog opens        | Nothing special: keys in a dialog are not input, so a time or count test ends by the 5-second idle rule and is saved without a personal best; zen goes on **Accepted: decision 117.**                                                                                                                                                                                                                                                            |
| e   | Signing in as another user with unsent data | `Dialog`: `Sign in to another account?` / `Войти в другой аккаунт?`; `This browser holds data of another account that has not been sent. If you continue, it will be lost.` / `В этом браузере есть неотправленные данные другого аккаунта. Если продолжить, они будут потеряны.`; `cancel` (focused), `discard and continue` / `удалить и продолжить` (`danger`) **Accepted: decision 118; Russian text ends `…они пропадут.`.**                |
| f   | OAuth failure (`auth_error`)                | The reserved `Notice` line of `/`: `sign-in was cancelled` / `вход отменён` (default tone); `sign-in failed. try again in settings.` / `не удалось войти. попробуйте ещё раз в настройках.` (`miss`), until the next navigation. A load error of the progress takes the line first **Accepted: decision 119; the Russian failure string is `вход не удался. повторите в настройках.`.**                                                          |
| g   | An expired session outside `/settings`      | The navigation shows `sign in` again while the session is expired; it leads to `/settings`, where the status line has `sign in again` **Accepted: decision 120; the link reads `sign in again` / `войти снова`, not `sign in`.**                                                                                                                                                                                                                 |
| h   | Sign-out and delete account with no network | Both buttons disabled with `Needs a connection.` / `Нужна сеть.` (the wording of decision 91). Signing out offline cannot delete the session on the server, so it is not offered. With an expired session sign-out works: the server has no session left to delete **Accepted: decision 121; with an expired session `delete account` is disabled with `Sign in again to delete the account.`.**                                                 |
| i   | Delete account in progress and failed       | `delete forever` disabled and reading `deleting…` / `удаление…`; on failure a `Notice tone="miss"` in the dialog: `failed to delete. check the connection and try again.` / `не удалось удалить. проверьте соединение.` **Accepted: decision 122; the dialog cannot be closed while deleting.**                                                                                                                                                  |
| j   | The profile                                 | As drawn: the cat mark, the display name, `via GitHub` / `через GitHub`. No avatar image (it would be a request to a third party). Without a display name, the email; without both, `account` / `аккаунт` **Accepted: decision 123.**                                                                                                                                                                                                            |

- **Waiting:** pull request D, then PR 8 (e, f, g, h, j), PR 11 (h, i), PR 12 (a, b, c, d).
- **Answer (2026-11-15):** option A. The items are drawn in the design artifact and exported by pull request D before PR 8, PR 11 and PR 12. Done on 2026-11-15: each row above names the design decision that was accepted. The strings and states to build from are in [`decisions.md`](docs/design/source/decisions.md) (114–124), the `Dialog`, `Notice` and `Nav` guidelines and [ADR 079](docs/adr/079-account-and-report-states.md); where a row's proposal differs from the decision, the decision wins.

### Q3. Does sign-out clear the settings?

[storage-sync.md](docs/spec/storage-sync.md) says sign-out clears "all user stores"; "Reset progress" keeps `settings`. Settings are synced with the account, so they are account data.

- **Option A (recommended).** Sign-out and account deletion reset the settings to their defaults. The next person at a shared computer starts clean (A5), and nothing of the account is left.
- **Option B.** The settings stay on the device.
- **Waiting:** PR 8, PR 11.
- **Answer (2026-11-15):** option A. Sign-out and account deletion reset the settings to their defaults.

### Q4. Who runs the commands against Cloudflare

PR 1, PR 5 and PR 13 deploy to a test project and read its logs; that needs access to the Cloudflare account.

- **Option A (recommended).** The maintainer does the manual steps M1 once (including `wrangler login` on the development machine); the executor agent then runs `pnpm --filter @nekotype/bench run seed` and `run measure` itself and writes the results into the pull request.
- **Option B.** The maintainer runs those two commands and pastes the output; the executor writes the report from it.
- **Waiting:** PR 1.
- **Answer (2026-11-15):** option A. The maintainer runs `wrangler login` on the development machine; the executor runs the scripts.

### Q5. Spec amendments

Small changes to sentences of the spec that the decisions above need. Approve the list, or strike single items; a struck item makes its pull request stop and ask.

| #   | Amendment                                                                                                                       | Spec file                       | In PR |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----- |
| S1  | `CREATE INDEX users_email ON users(email)`: without it, linking by email scans `users`, and D1 counts every scanned row as read | `backend.md`                    | 2     |
| S2  | `users.email` holds a verified address in lower case, or `NULL`                                                                 | `backend.md`                    | 3     |
| S3  | Error codes `404 not_found` and `500 internal`; `/api/auth/*` answers `404` on a preview                                        | `backend.md`                    | 2, 3  |
| S4  | `device_seq` maps `deviceId` to `{ seq, at }`                                                                                   | `backend.md`, `storage-sync.md` | 5     |
| S5  | The server keeps `unlocked` sorted by key; the track order is the client's                                                      | `metrics.md`, `storage-sync.md` | 4     |
| S6  | `GET /api/sync` is also the pull on `start` and `online` when there is nothing to send                                          | `storage-sync.md`, `backend.md` | 7     |
| S7  | With equal KPM the personal best is the result with the smaller id                                                              | `metrics.md`, `storage-sync.md` | 4     |
| S8  | `outbox` has one record under the key `current`, with `seq` inside                                                              | `storage-sync.md`               | 6     |
| S9  | `meta` gains `settingsSyncedAt`, `profile`, `pendingSignIn`                                                                     | `storage-sync.md`               | 6     |
| S10 | `@nekotype/shared/testing` as a fourth entry point, for tests and the measurement only                                          | `architecture.md`               | 1     |
| S11 | The report dialog lives in `pages/trainer`, not in a `features/report-content` slice (ADR 015)                                  | `frontend.md`                   | 12    |
| S12 | API tests use `@cloudflare/vitest-plugin`; the sync e2e run on `wrangler pages dev` with a fake OAuth provider                  | `quality.md`                    | 2, 9  |

- **Recommendation:** approve all.
- **Waiting:** the pull request named in each row.
- **Answer (2026-11-15):** all twelve approved.

## 5. Maintainer's manual steps

Only the maintainer can do these: they need the Cloudflare, Google and GitHub accounts. Each step says which pull request needs it and how to check it. Commands run from the repository root. Before PR 2 adds `wrangler` to the repository, replace `pnpm exec wrangler` with `pnpm dlx wrangler@4`.

### M1. Test project for the measurement — before PR 1

1. `pnpm dlx wrangler@4 login` on the development machine (once; it also serves the later steps).
2. `pnpm dlx wrangler@4 pages project create nekotype-bench --production-branch=main --force`. The flag is needed when the command runs inside an AI agent's session, where wrangler otherwise creates a Worker instead of a Pages project (section 2, "Pages commands in an agent session"); in a plain terminal it changes nothing.
3. `pnpm dlx wrangler@4 d1 create nekotype-bench`
4. Give the executor the `database_id` the command prints (it goes into `apps/bench/wrangler.toml`).

State on 2026-11-15: M1 is done. The Pages project `nekotype-bench` exists (created with `--force`; it will be served at `https://nekotype-bench.pages.dev` after its first deployment). The database `nekotype-bench` is in region EEUR, `database_id` `d49b1f07-7287-4b0f-be91-3bf2d1938f14`. Later commands against this project run on Pages and take no `--force`.

Check: `pnpm dlx wrangler@4 pages project list` shows `nekotype-bench`; `pnpm dlx wrangler@4 d1 list` shows `nekotype-bench`. Both can be deleted when the phase is closed.

### M2. D1 for production and preview, and the CI token — before PR 2

1. `pnpm dlx wrangler@4 d1 create nekotype` and `pnpm dlx wrangler@4 d1 create nekotype-preview`.
2. Give the executor both `database_id` values (they go into the root `wrangler.toml`).
3. In the Cloudflare dashboard, _My Profile_ → _API Tokens_, edit the token stored as the GitHub secret `CLOUDFLARE_API_TOKEN`: add the permission _Account_ → _D1_ → _Edit_ next to _Cloudflare Pages_ → _Edit_. The token value does not change.

State on 2026-11-18: M2 is done. `pnpm dlx wrangler@4 d1 create` made `nekotype` (`database_id` `b8a4a497-68e4-4d79-9477-4934a64b4436`) and `nekotype-preview` (`50ed211b-ca70-4ab4-b3f9-f184c57e4b8f`), both in region EEUR; the maintainer added the D1 — Edit permission to the CI token. The ids are in the root `wrangler.toml` (PR 2).

Check: `pnpm dlx wrangler@4 d1 list` shows three databases; in the CI run of PR 2 the step "Apply D1 migrations (preview)" passes, and after the merge `pnpm exec wrangler d1 migrations list DB --remote --env production` prints no unapplied migration (with the database name `nekotype` instead of `DB`, wrangler does not find the database).

### M3. OAuth clients — before PR 3 is merged

The code and tests of PR 3 need none of this; the manual check after the merge does.

1. **Google.** Google Cloud console → _APIs & Services_ → _OAuth consent screen_: user type External, publishing status Testing, the maintainer's address as a test user, scopes `openid`, `email`, `profile`. (Publishing the consent screen belongs to the P7 release.) Then _Credentials_ → _Create OAuth client ID_ → Web application, with two authorized redirect URIs:
   - `https://nekotype.pages.dev/api/auth/google/callback`
   - `http://localhost:5173/api/auth/google/callback`
2. **GitHub, production.** _Settings_ → _Developer settings_ → _OAuth Apps_ → _New OAuth App_: homepage `https://nekotype.pages.dev`, callback `https://nekotype.pages.dev/api/auth/github/callback`. Generate a client secret.
3. **GitHub, development.** A second OAuth App: homepage `http://localhost:5173`, callback `http://localhost:5173/api/auth/github/callback`. Generate a client secret.
4. Production secrets, each with `pnpm exec wrangler pages secret put <NAME> --project-name nekotype`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (the production GitHub app).
5. Local file `.dev.vars` in the repository root, copied from `.dev.vars.example`: the same Google client, the development GitHub app.

Check: `pnpm exec wrangler pages secret list --project-name nekotype` lists the four names. After PR 3 is merged and deployed: `https://nekotype.pages.dev/api/auth/google` redirects to Google and back to `/`, then `https://nekotype.pages.dev/api/me` shows the profile; the same for `/api/auth/github`; locally with `pnpm run dev` and `pnpm run dev:api`, `http://localhost:5173/api/auth/github` does the same. The CI smoke test checks the redirect on every deploy from then on.

State on 2026-11-18: M3 is done and checked after the merge of PR 3 (#165). Locally, sign-in with Google and GitHub works (`pnpm run dev` and `pnpm run dev:api`). On production, `https://nekotype.pages.dev/api/auth/google` and `/api/auth/github` sign in and return to `/`, and `/api/me` shows the profile.

### M4. Design session — before PR 8 and PR 12

[Q2](#q2-design-gaps) was answered with option A. An agent draws the items of Q2 in the design artifact from the proposals there; the maintainer reviews the previews and approves them, and only then pull request D exports them. The session does not depend on PR 1–7 and can run next to them.

### M5. Turnstile — before PR 12

1. Cloudflare dashboard → _Turnstile_ → _Add widget_, twice, both in Managed mode with the hostname `nekotype.pages.dev` (it covers the preview subdomains): `nekotype-production` and `nekotype-preview`.
2. Give the executor the two **site keys** (public; they are committed).
3. `pnpm exec wrangler pages secret put TURNSTILE_SECRET_KEY --project-name nekotype` with the production widget's secret.
4. The preview widget's secret for the preview environment: `pnpm exec wrangler pages secret put TURNSTILE_SECRET_KEY --project-name nekotype --env preview`, or in the dashboard: _Workers & Pages_ → _nekotype_ → _Settings_ → choose the Preview environment → _Variables and Secrets_ → _Add_ → type Secret.
5. Add `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` to `.dev.vars` (Cloudflare's test secret; `.dev.vars.example` has the line).

Check: the secret is listed for both environments (`pages secret list`, with and without `--env preview`, or the dashboard). On the preview URL of PR 12 a report can be sent and `pnpm exec wrangler d1 execute nekotype-preview --remote --command "SELECT count(*) FROM content_reports"` counts it.

### M6. After the phase

Delete the Pages project `nekotype-bench` and the database `nekotype-bench` (dashboard, or `wrangler pages project delete` and `wrangler d1 delete`).

## 6. Pull requests

Common to all: the branch is cut from fresh `main`; the acceptance items are those of [phases.md](docs/spec/phases.md), numbered in the [table at the end](#acceptance-items-and-pull-requests); sizes are changed lines including tests, a rough guide to how much one executor session holds. ADR numbers are the next free ones when the pull request is opened (the last one today is 083, from this pull request's ADR; check `docs/adr/` when opening yours).

Order. A pull request starts when the ones it depends on are merged; pull requests with no path between them can run in parallel.

| PR  | Depends on | Can run in parallel with |
| --- | ---------- | ------------------------ |
| 1   | —          | —                        |
| 2   | 1          | 4                        |
| 3   | 2          | 4, 6                     |
| 4   | 1          | 2, 3                     |
| 5   | 3, 4       | 6                        |
| 6   | 4          | 3, 5                     |
| 7   | 5, 6       | D, 12                    |
| D   | M4         | 2–7                      |
| 8   | 3, 7, D    | 10, 12                   |
| 9   | 8          | 10, 11, 12               |
| 10  | 5, 7       | 8, 9, 11, 12             |
| 11  | 8, D       | 9, 10, 12                |
| 12  | 3, D       | 5–11                     |
| 13  | all        | —                        |

Sign-in is hidden on previews, so nothing behind a session can be tried on a preview URL. Those parts are checked locally (`pnpm run dev` with `pnpm run dev:api`) and, after the merge, by the maintainer on production, which nobody else uses before the release (ADR 061).

### PR 1 — Measurement on Cloudflare

- **Branch:** `p5-01-sync-measurement`. **Depends on:** M1, Q1 (which batch sizes to measure), Q4, Q5 (S10).
- **Goal.** Check the data model of ADR 078 against the limits before anything is built on it: CPU time of one sync in a cold and a warm isolate, and what `json_each` costs in `rows_read`.
- **Adds:**
  - `packages/shared/src/testing/` (D14) and the export `./testing`;
  - `packages/shared/src/learn-patch.ts` with `touchedKeys`, `patchRecent`, `patchBuckets` (D12) and their unit tests, because the measurement is only valid on the real functions;
  - `apps/bench` (`@nekotype/bench`, private): its own `wrangler.toml` (project `nekotype-bench`, D1 `nekotype-bench`), `public/` with an empty page and `_routes.json`, `functions/api/sync.ts`, which applies a batch exactly as "Applying a batch" in `backend.md` describes and returns the `meta` of every statement, `scripts/seed.ts` (writes the year-long row with `wrangler d1 execute --remote --file`), `scripts/measure.ts` (deploys, tails with `--format json`, sends the requests, prints the table) and a `README.md`.
- **Measures**, for the batches `learning`, `capped` and `results` of D14 and for the whole-row read of `GET`: `cpuTime` of the first request after each of 5 fresh deployments (cold) and of 50 further requests (warm: median, p95, maximum); `rows_read`, `rows_written` and the number of statements; the size of the response.
- **Pass:** every cold request and the warm p95 are at most 8 ms (2 ms are left for the session, validation and the routing that the real endpoint adds); a learning sync reads at most 250 rows (20,000 syncs a day, above the 16,000 tests a day that the write limit allows) and writes 1; the `results` batch writes at most 151 rows.
- **Result (2026-11-16): failed** ([ADR 081](docs/adr/081-sync-measurement-p5.md)). A second measurement of three variants led to [ADR 082](docs/adr/082-sync-acknowledgement-without-snapshot.md), which changes the model and replaces the pass line above; PR 2, PR 4 and PR 5 no longer wait.
- **Fail:** the executor does not redesign. It reports the numbers, the pull request is still merged as the record, and the maintainer decides the follow-up to ADR 078; PR 2, PR 4 and PR 5 wait.
- **Dependencies:** `wrangler` and `tsx` as `devDependencies` of `apps/bench`, so the version is the lockfile's and not the newest one. No effect on the client bundle.
- **Deploying from an agent session.** `scripts/measure.ts` first checks that the Pages project `nekotype-bench` exists (`wrangler pages project list`) and stops if it does not: creating it is the maintainer's step M1. The bench has a Function and a `_routes.json`, which keep its deploy on Pages (section 2); the address of every deployment must end in `nekotype-bench.pages.dev`, and the script fails otherwise.
- **Tests:** unit tests of the generator (sizes, same seed gives the same data) and of the patch functions.
- **Acceptance:** 13 (the model; the real endpoint in PR 13), 17 (first part).
- **Docs:** `docs/research/2026-11-NN-p5-sync-cpu.md` (a new folder by the convention of `docs/README.md`, with a row in that file); an ADR with the result and the caps of Q1; `decisions.md` O4 (how `json_each` is counted); `architecture.md` (S10).
- **Preview URL:** nothing changes for the application; check that the preview still loads.
- **Done when:** the report holds the table and the verdict; `verify:quick` passes.
- **Size:** about 900 lines.

### PR 2 — Functions and D1 scaffold

- **Branch:** `p5-02-api-scaffold`. **Depends on:** PR 1 and ADR 082, M2, Q5 (S1, S3, S12).
- **Goal.** An empty API that is deployed, migrated and tested: everything later pull requests plug into.
- **Adds:** `apps/api` as in D1 with `createApp` (error handling, `notFound`, the `Origin` check, the body limit; no routes yet) and `lib/errors.ts` with the error table of `backend.md`; `functions/api/[[route]].ts`; the root `wrangler.toml` (D4) and `.dev.vars.example`; `apps/api/migrations/0001_init.sql` (D5); `apps/web/public/_routes.json` and its test; the Vite proxy (D3); root scripts `dev:api` and `db:migrate:local`; the test setup of D8 with a first test file (the migrations apply, every table exists, an unknown path is `404` with the error body, a `POST` without `Origin` is `403`).
- **Changes:** `deploy.yml` (D22: `pnpm exec wrangler`, the two migration steps); `smoke-deploy.mjs` and its test (`/api/unknown`); `pnpm-workspace.yaml` (`workerd`); `apps/web/eslint.config.js` is already right.
- **Dependencies:** `hono` (runtime, `apps/api`); dev: `wrangler` (root), `@cloudflare/vitest-plugin`, `@cloudflare/workers-types`, `vitest`. Client bundle: none. The lockfile and `vite.config.ts` change, so the latency gate runs on this pull request.
- **Tests:** API tests as above; unit tests for `_routes.json`, the entry file and the smoke test.
- **Acceptance:** 1 (the infrastructure).
- **Docs:** an ADR (server package and entry, root `wrangler.toml`, migrations in CI, the test runner actually used); `backend.md` (S1, S3, where migrations live); `architecture.md` (the tree: `apps/api/migrations`, `wrangler.toml`); `quality.md` (S12, API tests); `README.md` (scripts, local development with two servers, deployment with Functions and D1, the one-time setup); `docs/architecture/` (workspace, verification gates); `AGENTS.md` (the project paragraph no longer says "there is no backend"; `dev:api`).
- **Preview URL:** `/api/unknown` answers `404` with `{"error":{"code":"not_found"}}`; `/`, `/type` and a missing asset behave as before; the deploy log shows the Functions bundle uploaded.
- **Done when:** CI is green including the migration step and the smoke test; this confirms the three "not confirmed" items of section 2 that belong to it, or the fallback of D8 is in place and recorded.
- **Size:** about 700 lines.

### PR 3 — OAuth and sessions

- **Branch:** `p5-03-auth`. **Depends on:** PR 2, Q5 (S2, S3). M3 before the merge.
- **Goal.** `GET /api/auth/:provider`, its callback, `POST /api/auth/logout`, `GET /api/me`, the session middleware (D2, D6).
- **Adds:** `routes/auth.ts`, `routes/me.ts`, `auth/session.ts`, `auth/providers.ts` (the Arctic-backed `OAuthProviders`), `auth/users.ts` (find, link, create), `db/` statements for `users`, `oauth_accounts`, `sessions`, `user_stats` (the initial row).
- **Dependencies:** `arctic` (runtime, `apps/api`). Client bundle: none.
- **Tests (API, fake provider and fake clock):** a new user gets `users`, `oauth_accounts` and `user_stats` rows; a second provider with the same verified email links to the same user; an unverified email creates a separate user and stores no address; a wrong or missing state redirects to `/?auth_error=failed`; `access_denied` to `/?auth_error=denied`; the cookie attributes; `GET /api/me` with a session, without one and with an expired one; renewal below 15 days and none above; logout deletes the row and the cookie; `POST` with a foreign `Origin` is `403`; `/api/auth/google` is `404` with `ENVIRONMENT` = `preview`. One file for the Arctic-backed provider with a stubbed `fetch`.
- **Acceptance:** 1 (OAuth callback, the error table).
- **Docs:** an ADR (the provider seam, the state cookie, verified addresses only); `backend.md` (S2, S3, the state cookie, the session cleanup); `README.md` (`.dev.vars`, the OAuth clients); `docs/architecture/`; `smoke-deploy.mjs` gets the `/api/me` and `/api/auth/google` checks (D22).
- **Preview URL:** `/api/me` answers `401`; `/api/auth/google` answers `404`. After the merge the maintainer does the check of M3 on production.
- **Done when:** the API tests pass; a local sign-in with both providers works with the maintainer's `.dev.vars` (the executor asks the maintainer to try it if it has no secrets).
- **Size:** about 1,100 lines.

### PR 4 — Merge and patch functions

- **Branch:** `p5-04-merge-patch`. **Depends on:** PR 1, Q1, Q5 (S5, S7). Parallel with PR 2 and PR 3.
- **Goal.** Everything pure that the server and the client share (D11, D12, D13).
- **Adds to `packages/shared`:** in `types.ts`: `LearnDelta`, `SyncDelta`, `SyncRequest`, `Snapshot`, `SyncResponse`, `ResultsResponse`, `MeResponse`, `ReportRequest`, `ApiErrorCode`, as in `backend.md`; in the runtime: `emptyLearnState`, `mergeLearn`, `splitLearnDelta`, `mergeKanaStats`, `mergeTypingRecords`, `applyResultsToRecords`, `isSnapshot`, `isSyncResponse` (guards the client needs), the shared constants (`MAX_RESULTS_PER_BATCH` = 50, `MAX_SYNC_BODY_BYTES`, the caps of Q1, `SYNC_FORMAT_VERSION` = 1); a test helper with the reference RFC 7396 merge.
- **Changes:** the tie rule in `applyResultToRecords` (D13).
- **Dependencies:** none.
- **Adds for ADR 082:** `patchLearn` (the merge patch of `learn` for the touched `entries` and `stats`, with `null` for each `mixups` key the decay drops); `patchBuckets` takes the stored newest day of the track (`bucket_newest`) instead of the day keys and returns the new one; `applyBatch(snapshot, batch)`, the one function with which the server's rules are applied to a snapshot, used by the client on acknowledgement; the types `SnapshotRest`, `SnapshotRecent`, `SnapshotBuckets` and their guards. Their equivalence tests: each patch applied to the stored columns equals the full merge, including a removed `mixups` key and a gap of more than 365 days.
- **Tests:** the property, convergence, splitting and equivalence tests of D12, each over at least 500 generated cases; example tests for the tie rule and for `mergeLearn` on the year-long state.
- **Acceptance:** 14, 15, 17.
- **Docs:** an ADR (one merge function, a delta is a state, the tie rule, splitting); `storage-sync.md` ("Merge rules": the tie rule, the server's `unlocked`, the split); `metrics.md` (S5, S7); `docs/architecture/` (`packages/shared`).
- **Preview URL:** typing results and records behave as before (the tie rule is invisible).
- **Done when:** `pnpm test` in `packages/shared` passes with the new suites; the initial JS does not grow (nothing imports the new functions yet).
- **Size:** about 1,300 lines.

### PR 5 — `/api/sync`

- **Branch:** `p5-05-api-sync`. **Depends on:** PR 3, PR 4, Q1, Q5 (S4).
- **Goal.** `POST /api/sync` and `GET /api/sync` as specified, with D7 and D10.
- **Adds:** `packages/shared/src/schemas.ts` and the `./schemas` export (D10); `apps/api/src/sync/apply-batch.ts`, `routes/sync.ts`, `db/` statements for `user_stats`, `user_settings`, `results`; the statement counter of D8.
- **Changes:** `apps/bench/functions/api/[[route]].ts` re-exports the real entry, and `scripts/seed.ts` also writes a user and a session whose token `scripts/measure.ts` sends, so the real endpoint is measured.
- **Dependencies:** `valibot` (runtime, `packages/shared`). Client bundle: none, checked by the lint test of D10.
- **Tests (API):** `seq` ≤ last, = last + 1 and > last + 1 (`409` with `lastSeq`); a resent batch changes nothing and inserts no duplicate; a delayed old batch is not applied; every merge rule on stored data; `seq` = 1 keeps the account's settings and a later batch overwrites older ones; two devices that send interleaved batches converge; a lost `version` update is retried once without double counting, and a second loss is `503 conflict` with `Retry-After: 5`; two concurrent syncs lose no increment; `429` inside the interval with `Retry-After`; `413` over 256 KB; `400` for each schema bound and for a batch over the caps; `401`; `403`; the 90-day cleanup of `device_seq`; bucket days older than 365 days are deleted; a learning-only sync writes at most 2 rows and a finished test at most 6 (`meta.rows_written`); at most 16 statements for a batch of 50 results at the caps; a sample of the equivalence cases against `json_patch`; the three parts of `GET` carry one `version` and together equal the stored row parsed; `GET` without `part` answers `lastSeq` and `version`; `applyBatch` of the previous snapshot and the batch equals the parts read after it (ADR 082).
- **Acceptance:** 1, 4, 5, 6 (two devices), 7, 12, 15, 16, 17, 18.
- **Docs:** `backend.md` (S4, the order of checks, the read and write statements, the caps); `storage-sync.md` (S4); `quality.md` (`apps/api` tests); `docs/architecture/`.
- **Preview URL:** `/api/sync` answers `401` to `GET` and to `POST` with the preview's own `Origin`.
- **Done when:** the API tests pass, and the measurement of PR 1 repeated against the real endpoint on `nekotype-bench` meets the line of ADR 082: a warm median of at most 5 ms for `learning` and `results` and at most 8 ms for `capped`, at most 250 rows read by `learning`, and no request answered with error 1102 or with an outcome other than `ok`. The cold times and the warm p95 are recorded in the research note and do not gate. Over the line: stop and report, as in PR 1.
- **Size:** about 1,500 lines.

### PR 6 — Local storage and the local view

- **Branch:** `p5-06-local-view`. **Depends on:** PR 4, Q5 (S8, S9). Parallel with PR 5.
- **Goal.** The client's data layer for sync, with no network code: schema 4, the view built from `snapshot`, `outbox` and `delta`, and merges between tabs (D15, D18).
- **Adds:** `Db.update` and `Db.getByIndex` (D15). `entities/user` is not created here: a slice needs its consumers, and they arrive in PR 7.
- **Changes:** `shared/lib/idb/schema.ts` (stores, `SCHEMA_VERSION` 4); `entities/learn/model/store.ts` and `entities/stats/model/store.ts` (D18: delta accumulators, the view, `update` transactions, reload on the channel); `entities/learn` gains a helper that turns the result of unlocking and box evaluation into a delta; `latency-gate.mjs` (D22).
- **Unchanged for the user:** a guest sees exactly what they saw. The existing unit and e2e tests of learning, typing, statistics and reset are the regression suite and are not rewritten, only extended.
- **Dependencies:** none.
- **Tests (unit, fake database):** the view equals snapshot ⊕ outbox ⊕ delta for learning, typing statistics, counters and records; statistics stay visible while the outbox holds a batch; two stores on one database with interleaved changes keep both; a reload keeps unwritten changes; reset in one tab empties the other; the schema reset from version 3; the wrapper's two methods on IndexedDB (`fake-indexeddb`) and on the memory fallback; no IndexedDB write inside a keystroke handler and the render budget of recall (the existing tests still pass).
- **Acceptance:** 3, 6 (two tabs, at the store level).
- **Docs:** an ADR (schema 4, read-modify-write transactions, merges between tabs, the `meta` keys); `storage-sync.md` (the table, "Two tabs", S8, S9); `docs/architecture/` (`shared/lib/idb`, `entities/learn`, `entities/stats`); `README.md` and `quality.md` only if the budget figures they quote change.
- **Preview URL:** a learning session and a typing test in two tabs at once: after both, each tab shows the answers and the test of the other; progress survives a reload; "reset progress" in one tab empties the other. The first load after the deploy starts from empty data (the schema reset).
- **Done when:** `verify:quick` passes; the initial JS grew by at most 1.4 KB; the latency gate passes in CI.
- **Size:** about 1,600 lines.

### PR 7 — The sync engine

- **Branch:** `p5-07-sync-engine`. **Depends on:** PR 5, PR 6, Q1, Q5 (S6).
- **Goal.** `features/sync` without its user interface: batches, the outbox, the Web Lock, triggers, failed requests, catch-up, retention ([storage-sync.md](docs/spec/storage-sync.md), "Batches" to "History"; D16, D17).
- **Adds:** `entities/user` (D17: the signals, `initUser` and the `nekotype:user` channel; `beginSignIn`, `authAvailable` and `authError` come in PR 8); `shared/api` (`apiFetch`); `shared/lib/sync-request.ts` and its two callers (the end of a learning session in `pages/learn`, the end of a typing test in `features/training`); `features/sync` (`model/engine.ts`, `model/status.ts`, `lib/build-batch.ts`, `lib/apply-ack.ts`, `api/sync.ts`); `app/sync-bootstrap.ts`, called from `app/init.ts`; the rule of D17 in `check-budget.mjs` and its test; `latency-gate.mjs` (D22).
- **Also adds** `pages/settings/ui/account-panel.tsx` as a lazy chunk with the sync status line only, rendered when `userId` is set. It gives `features/sync` its second consumer from the start (steiger's `insignificant-slice` rule; ADR 015 forbids switching the rule off), and PR 8 completes the panel.
- **The engine starts only when `meta.userId` is set**, which nothing sets before PR 8, so production behaviour does not change with this pull request.
- **Dependencies:** none.
- **Tests (unit: fake database, fake `Clock` and `Scheduler`, a fake server that implements the protocol with the shared merge functions):** a batch is built from both deltas, the settings rule and at most 50 results, and clears what it took in the same transaction; a delta over the caps is split and the rest follows 5 seconds later; an unacknowledged batch is resent unchanged; the acknowledgement with `version` = stored + 1 applies the batch to the snapshot and equals what the fake server stored; with another `version` the three parts are read, and read again when their versions differ; both mark the results, merge the records and apply the settings rule; `409`, `429`, `503` with `Retry-After`, a network error, `401` and `400`/`413` each do what the table of "Failed requests" says, and a `400` is retried only after `appVersion` changes; the 10-second and 5-second spacing; the keepalive request at `hidden` within 60 KB, and nothing sent when the lock is held; two engines on one database send one batch; two devices against one server converge; retention keeps unsynced results and removes the oldest synced ones above 1,000; `GET` on `start` and `online` with nothing to send.
- **Acceptance:** 4 (resend), 6 (two devices at the engine level), 9.
- **Docs:** an ADR (the engine, its triggers, the pull, the lazy chunk and the budget rule); `storage-sync.md` (S6, the split, the settings marker of D16); `quality.md` (the budget rule); `docs/architecture/`.
- **Preview URL:** a guest's network panel shows no request to `/api` and no sync chunk loaded, also after the idle prefetch.
- **Done when:** `verify:quick` passes; the initial JS grew by at most 0.3 KB; the budget script proves the sync chunk is lazy.
- **Size:** about 1,800 lines.

### PR D — Design export

- **Branch:** `docs/p5-design`. **Depends on:** M4 (the design session of Q2, approved by the maintainer). It can start at any time and must be merged before PR 8, PR 11 and PR 12.
- **Goal.** The items of Q2, as approved, exported from the design artifact into `docs/design/source/` (the workflow of the design system: change the artifact, export, never edit the export by hand).
- **Docs:** `docs/design/source/` (`README.md`, `decisions.md`, the `Dialog`, `Notice`, `Nav` and `TranslationLine` guidelines); an ADR; `frontend.md` (the sign-in notice, the navigation with an expired session, the report dialog's states); `storage-sync.md` (sign-out needs a connection, if item h is approved).
- **Size:** documents only.

### PR 8 — Sign-in, sign-out, the expired session, the account section

- **Branch:** `p5-08-account`. **Depends on:** PR 3, PR 7, PR D, Q3.
- **Goal.** A user can sign in, see the sync status, sign out and continue after an expired session (D19, D20).
- **Adds:** `features/sync/model/account.ts` and `ui/another-account-dialog.tsx`; `entities/user`: `beginSignIn`, `authAvailable`, `authError`; the rest of `pages/settings/ui/account-panel.tsx` (the profile, sign-out) and the guest form; the navigation link in `app/App.tsx`; the sign-in notice on `/`; i18n keys (the navigation link and the notice in the core dictionary, the rest in the `settings` part, `en` and `ru`).
- **Changes:** `pages/settings/ui/settings-page.tsx` (the Account section; "reset progress" hidden for a signed-in user).
- **Dependencies:** none.
- **Tests:** unit tests of the four outcomes of `GET /api/me` (D19); the guest merge sends the delta in the first batch and 1,000 results in 20 further ones (fake clock); an expired session resumes with the same `deviceId` and `lastSeq`; another user with unsent data: cancel calls logout and keeps everything, discard clears; another user without unsent data clears silently; sign-out runs a sync first, asks only with unsent data, then clears the stores and resets the settings (Q3); signing out and in again to the same account restores everything from the server; DOM tests of the account panel in each status, of the dialogs, of the navigation link on a production host, a preview host and with a session, and of the notice for `auth_error` with the parameter removed from the URL.
- **Acceptance:** 8, 10, 11.
- **Docs:** `frontend.md` (the account section as built); `storage-sync.md` (the `pendingSignIn` mechanism, Q3); `docs/architecture/`; `README.md` (the description of the application: accounts and sync exist).
- **Preview URL:** no `sign in` link and no sign-in buttons; `/settings` shows the Account section with nothing to press; everything else unchanged. Locally with `.dev.vars`: the whole flow with both providers. After the merge the maintainer signs in on production from two browsers and checks that progress appears in the second.
- **Done when:** `verify:quick` passes; the initial JS grew by at most 0.4 KB and is at most 33.5 KB.
- **Size:** about 1,500 lines.

### PR 9 — Sync e2e

- **Branch:** `p5-09-sync-e2e`. **Depends on:** PR 8, Q5 (S12).
- **Goal.** The browser tests of D9 and their server.
- **Adds:** `apps/web/playwright.sync.config.ts`; `apps/web/e2e/sync-server/` (its `wrangler.toml` and Functions entry with the fake provider); `apps/web/e2e/sync/*.spec.ts` (the three files of D9); the unit test that keeps test code out of `apps/api/src` and `functions/`.
- **Changes:** the `e2e` script of `apps/web` runs both configurations; `.gitignore` (`dist-e2e-sync`); `eslint.base.js` ignores; `deploy.yml` timeout if needed (D22).
- **Dependencies:** none new (`wrangler` is in the root).
- **Acceptance:** 2, 6 (two tabs in a browser).
- **Docs:** an ADR (the e2e server and why it is not a backdoor); `quality.md` (S12, the e2e list); `README.md` (how to run one sync e2e file); `AGENTS.md` (the command, one line).
- **Preview URL:** nothing changes.
- **Done when:** CI is green with the new suite; its duration is written in the pull request.
- **Size:** about 600 lines.

### PR 10 — Server history

- **Branch:** `p5-10-history`. **Depends on:** PR 5, PR 7.
- **Goal.** `GET /api/results` and the history of `/stats` filled from the server on demand ([storage-sync.md](docs/spec/storage-sync.md), "History").
- **Adds:** `apps/api/src/routes/results.ts` (the cursor `<endedAt>:<id>`, at most 50, newest first, ties by id); `entities/stats/api/history.ts`; the typing store's `loadOlderResults()` (stores the page with `synced` = 1; remembers for the page load that the server has no more).
- **Changes:** `pages/stats` history table: on the last local page, for a signed-in user who is online, the next page is requested; `loading history…` under the table (the string of the design's `Notice` guidelines).
- **Tests:** API: paging through 120 results with equal `endedAt` values among them, the cursor and limit bounds, another user's results never returned, `401`. Unit: a new device fills its history page by page; inserting twice changes nothing; a guest never requests.
- **Acceptance:** 1.
- **Docs:** `backend.md` (the query); `docs/architecture/` (`pages/stats`, `entities/stats`).
- **Preview URL:** the history of `/stats` works as before for a guest. Locally: sign in on a clean profile and page through older results.
- **Size:** about 500 lines.

### PR 11 — Account deletion

- **Branch:** `p5-11-account-deletion`. **Depends on:** PR 8, PR D, Q3.
- **Goal.** `DELETE /api/me` and the dialog of the design (the word typed, `delete forever`).
- **Adds:** the route (one `batch()`: `content_reports.user_id` set to `NULL`, then the `users` row deleted, which cascades; the cookie cleared; `204`); the dialog in the account panel; `features/sync/model/account.ts`: `deleteAccount()` clears the user stores after a `204` and returns to guest mode.
- **Tests:** API: every table is empty for the user afterwards, a report keeps its row with `user_id` `NULL`, another user is untouched, `401`. Unit and DOM: the button is disabled until the word of the current language is typed; a failure keeps everything; success leaves a guest with empty data.
- **Acceptance:** 1.
- **Docs:** `backend.md` if the statement order is worth a line; `docs/architecture/`.
- **Preview URL:** nothing reachable. Locally: delete an account and sign in again to find it new.
- **Size:** about 350 lines.

### PR 12 — Report a problem

- **Branch:** `p5-12-report`. **Depends on:** PR 3, PR D, M5, Q5 (S11). Independent of sync: it can run any time after PR 3.
- **Goal.** `POST /api/reports` with Turnstile, and the dialog on `/type` (D21).
- **Adds:** `apps/api/src/routes/reports.ts` (no session needed; a valid session sets `user_id`; body at most 8 KB; the token verified with `deps.verifyTurnstile` and `CF-Connecting-IP`); `reportRequestSchema`; the real `verifyTurnstile` in `pages-entry.ts`; `pages/trainer/ui/report-dialog.tsx`, `lib/turnstile.ts`, `api/reports.ts`, loaded when the dialog opens; the `report a problem` action in the translation line (hidden with the translation, disabled offline with `available online only`, as in the `TranslationLine` guidelines); i18n keys in the `type` part.
- **Dependencies:** none. The Turnstile script is loaded from Cloudflare at run time and is not part of any chunk.
- **Tests:** API: an anonymous report and a signed-in one; a rejected token is `403 turnstile_failed`; a body over 8 KB is `413`; a comment over 500 characters and an unknown reason are `400`; without the secret `503`; a test secret with `ENVIRONMENT` = `production` is refused. DOM, with a fake loader: the script is requested only on open; the states of Q2 (b, c); offline; the item id and `contentVersion` of the prompt on display are sent.
- **Acceptance:** 1 (anonymous reports).
- **Docs:** an ADR (the dialog in the page, keys by host, the fail-closed secret); `frontend.md` (S11, the dialog); `backend.md` (the secret rule); `docs/architecture/`; `README.md` (the Turnstile secret in the one-time setup).
- **Preview URL:** on `/type`, with words and with phrases: open the dialog, pass the check, send; the dialog confirms; the count of M5 grows. Offline (DevTools): the action is disabled. The Turnstile script appears in the network panel only after the dialog opens.
- **Size:** about 900 lines.

### PR 13 — Acceptance measurements and closing the phase

- **Branch:** `p5-13-acceptance`. **Depends on:** every other pull request.
- **Goal.** The measurements of the acceptance on Cloudflare, and the documents brought in line with the code.
- **Does:** deploys `main` to `nekotype-bench` and repeats the measurement of PR 1 on the real endpoint: `cpuTime` cold and warm for a learning sync and for a batch of 50 results on the year-long row; `rows_written` of one finished test (at most 6) and of a learning-only sync (at most 2); the number of D1 statements of the largest batch (at most 50). A second report under `docs/research/`.
- **Docs:** `phases.md` (the "Closed" line of P5 with the commit and the pull requests); `quality.md` (an "End of P5" column: sizes from `check-budget.mjs`, latency from the CI run); `README.md` and `docs/architecture/` reread against the code; `AGENTS.md` (the project paragraph: P5 done, what the target still lacks); `docs/adr/README.md` checked for every ADR of the phase; this file moved to `docs/archive/p5-plan.md` with a note on top.
- **Acceptance:** 12, 13, 16, 18 (on Cloudflare).
- **Done when:** every row of the table below has a passing test or measurement named in the pull request description; the maintainer has done the production check of PR 8 and M6 is listed as open.
- **Size:** about 300 lines, mostly documents.

### Acceptance items and pull requests

The items of the P5 acceptance in [phases.md](docs/spec/phases.md), in its order.

| #   | Acceptance item                                                                                                              | PR                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | API tests on a local D1                                                                                                      | 2 (setup), 3, 5, 10, 11, 12              |
| 2   | e2e "offline → online"                                                                                                       | 9                                        |
| 3   | Statistics stay visible while a batch is unacknowledged                                                                      | 6                                        |
| 4   | A resent batch creates no duplicates                                                                                         | 5 (server), 7 (client)                   |
| 5   | A delayed old batch is not applied                                                                                           | 5                                        |
| 6   | Two-tab and two-device merge tests                                                                                           | 6 and 9 (tabs), 5 and 7 (devices)        |
| 7   | Two concurrent syncs lose no increments                                                                                      | 5                                        |
| 8   | An expired session resumes under the same `deviceId`; signing in as another user never merges the previous user's data       | 8                                        |
| 9   | A `400` stops retries until `appVersion` changes                                                                             | 7                                        |
| 10  | A guest with 1,000 results signs in and all results arrive over several batches                                              | 8                                        |
| 11  | Sign-out and sign-in to the same account loses no data                                                                       | 8                                        |
| 12  | One finished test writes at most 6 D1 rows (`meta.rows_written`)                                                             | 5 (local D1), 13 (Cloudflare)            |
| 13  | Request CPU within the limit, cold and warm, for a learning sync and a batch of 50 results on a year-long `user_stats` row   | 1 (model), 5 (endpoint), 13 (final)      |
| 14  | Set-like merges are idempotent, commutative and associative; additive ones commutative and associative                       | 4                                        |
| 15  | Two devices learning the same track converge on unlocked kana, recent answers, boxes, active days and buckets                | 4 (functions), 5 (server)                |
| 16  | A sync that carries only learning progress writes at most 2 D1 rows                                                          | 5 (local D1), 13 (Cloudflare)            |
| 17  | For any stored state and batch, the per-key patch of `learn_recent` and `learn_buckets` gives the same state as a full merge | 1 (first functions), 4, 5 (`json_patch`) |
| 18  | A sync uses at most 50 D1 queries, whatever the size of the batch                                                            | 5, 13                                    |
| —   | Initial chunk: the sync engine and the dialogs are lazy, a guest never loads the engine, valibot stays on the server         | 5 (valibot), 7 (budget rule), 8          |

## 7. Instructions for executor agents

One executor takes one pull request of section 6.

1. **Read first:** `AGENTS.md`; this file whole; the spec sections your pull request names and the files it links; the ADRs it cites, [ADR 078](docs/adr/078-user-stats-targeted-updates.md) and [ADR 061](docs/adr/061-schema-reset-before-release.md) always. Check the Status table: every pull request yours depends on is merged, and every question and manual step it waits for has an answer written in this file. If not, stop and tell the maintainer what is missing.
2. **Make no decision this plan does not hold.** Architecture, data formats, names of stores, bindings and secrets, user-visible behaviour and copy are decided here, in the spec or in the design. If something is missing, ambiguous or turns out wrong, ask the maintainer (in Russian) and wait; do not choose and do not "fix" the spec on your own. A measurement outside its limit is reported, not worked around.
3. **Stay in scope.** Build what your pull request lists. Anything else you had to touch is named in the pull request description.
4. **Follow `AGENTS.md`:** the code rules (no `any`, no assertions, strings through i18n with `en` and `ru` in parity, injected time and randomness), the layer rules, the hot-path and budget rules. Never bypass a hook.
5. **Budgets.** Run `pnpm run build && pnpm run budget` before and after, and write both initial JS figures into the pull request description. If your allowance (D17) does not hold, stop and ask.
6. **Tests.** Write the tests your pull request lists and name, for each acceptance item you close, the test that proves it. Report results as they are.
7. **Documents** change in the same pull request: the spec files and ADR named, `README.md` and `docs/architecture/` when the code they describe changed, `AGENTS.md` only where named and within 250 lines. A new ADR takes the next free number and a row in `docs/adr/README.md`.
8. **Finish:** when the work is done and `pnpm run verify:quick` passes, commit with a Conventional Commits message, push the branch (the pre-push hook runs the checks; do not run them by hand a second time) and open the pull request. Its description lists: what changed, why, anything outside the scope, what to check on the preview URL (from your pull request's entry here), the acceptance items closed with their tests, and the initial JS before and after. No AI attribution in commits or in the pull request. Never merge: the maintainer does.
9. **Mark the plan:** after `gh pr create`, set your row of the Status table to `done` with the pull request number, in a second commit on the same branch (`docs: mark P5 PR n done`).
10. **Communication:** with the maintainer in Russian; code, comments, commits and documents in English.

## 8. Risks

| Risk                                                                     | How it shows                                                                                                   | What to do                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU on Cloudflare is higher than the Node benchmark of ADR 078 suggests  | PR 1 measures over 8 ms; later, error 1102 in the tail of a sync                                               | Happened in PR 1; resolved by ADR 082 (no snapshot in the response, reads by path, the line of the typical request). Cold requests stay over 10 ms and rely on the platform's tolerance: if error 1102 appears, the maintainer chooses between Workers Paid and less work in the handler. PR 5 and PR 13 measure the real endpoint again |
| The sync response carries the whole snapshot (about 350 KB after a year) | High `cpuTime` in the `GET` measurement of PR 1; a slow acknowledgement on a phone                             | Measured in PR 1: about 4 ms. Removed by ADR 082: the acknowledgement has no snapshot and `GET` answers by parts                                                                                                                                                                                                                         |
| `json_each` counts every element as a row read                           | `rows_read` near 1,000 per learning sync in PR 1                                                               | Measured in PR 1: 630. Removed by ADR 082: `json_extract` with bound paths reads one row per statement                                                                                                                                                                                                                                   |
| valibot validation costs more CPU than expected                          | The measurement at the end of PR 5 is over the line of ADR 082 (the model alone takes 3 ms of the 5)           | Report with the numbers. The candidates (the maintainer chooses): lower caps, or the hand-written guards of `shared/runtime` for the hot fields                                                                                                                                                                                          |
| The initial JS budget                                                    | `pnpm run budget` fails, or an allowance of D17 is exceeded                                                    | Stop and ask. The merge functions are the largest new part of the initial chunk; loading them on demand is possible but changes D18                                                                                                                                                                                                      |
| Keystroke latency in recall after PR 6                                   | The latency gate fails on the pull request or on `main`                                                        | The gate runs on PR 6 (D22). The view must be updated per answer incrementally; a whole-state merge inside an answer is the likely cause                                                                                                                                                                                                 |
| A sync acknowledgement lands during a learning session                   | A dropped frame when the store rebuilds its view from a 350 KB snapshot                                        | Syncs are triggered at start, on reconnect and 10 seconds after a session, not during one; catch-up batches after a guest's sign-in are the exception. If PR 13's latency run shows it, the follow-up is to apply a reload between tasks                                                                                                 |
| Sign-in cannot be tried on a preview                                     | An OAuth or secret mistake appears only on production                                                          | The smoke test checks the Google redirect on production (D22); the maintainer runs the checks of M3 right after PR 3 and PR 8 are merged. Production has no other user before the release                                                                                                                                                |
| `wrangler.toml` becomes the source of truth of the Pages project         | A binding or variable set in the dashboard disappears after the first deploy with the file                     | The project has none today (it is static). After PR 2, settings are changed in the file only; `README.md` says so                                                                                                                                                                                                                        |
| Migrations on the shared preview database                                | A pull request's migration breaks the preview of another                                                       | D5: migrations are additive and work with older code. P5 has one migration, in PR 2                                                                                                                                                                                                                                                      |
| The test plugin or `wrangler pages dev` fails in the CI container        | PR 2 or PR 9 cannot get a green run                                                                            | D8 names the fallback for API tests. For the e2e server the executor stops and reports; a `vite preview` server with a proxy to a separate `wrangler` process is the likely answer, but it is not decided here                                                                                                                           |
| Arctic has had no release since May 2025                                 | A provider changes its endpoints and sign-in fails with `auth_error=failed`                                    | Arctic sits behind `OAuthProviders` (D2): replacing it with two hand-written exchanges touches one file. Not done now, because the spec names Arctic and it works                                                                                                                                                                        |
| The D1 daily limits during development                                   | Queries fail until midnight UTC; CI smoke tests still pass                                                     | The measurement uses its own database (`nekotype-bench`), so it cannot exhaust production's                                                                                                                                                                                                                                              |
| Deleting an account with many results                                    | One `DELETE` cascades over thousands of rows and spends the day's write budget (three rows written per result) | Accepted for the MVP: 10,000 results are 30,000 of 100,000 rows. Noted in `backend.md` by PR 11                                                                                                                                                                                                                                          |
| A stale tab with an old client after a deploy                            | The old client sends a batch the new schema rejects: `400`, sync blocked until that tab reloads                | This is A28 working as designed. A change to the batch format raises `v` and keeps accepting the old one for a release                                                                                                                                                                                                                   |
| The phase is the largest of the MVP                                      | A pull request grows past what one session holds                                                               | The sizes of section 6 are the warning line: an executor well past them stops and proposes a split to the maintainer instead of cutting scope                                                                                                                                                                                            |
