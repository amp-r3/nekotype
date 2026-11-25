# Backend

The backend is a Hono application running as Cloudflare Pages Functions on the `nekotype` Pages project, with a D1 database; sign-in is Google and GitHub only, via the Arctic library. A sync that carries learning progress costs 1–2 written D1 rows.

## Free-tier limits that constrain the design

| Limit                                                                                                                  | Value                                     | Design response                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CPU per Functions request](https://developers.cloudflare.com/workers/platform/limits)                                 | 10 ms                                     | OAuth only, no password hashing; the learning state in `user_stats` is updated per touched key in D1 and a sync answers without the snapshot (ADR 078, 082) |
| Functions requests                                                                                                     | 100,000 per day, shared with Workers Free | `_routes.json` limits Functions to `/api/*`; batched sync at most once per 10 s per device                                                                  |
| [D1 reads / writes](https://developers.cloudflare.com/d1/platform/limits)                                              | 5 million / 100,000 rows per day          | One row per batch of the answer log; a sync writes at most 3 rows                                                                                           |
| D1 database size                                                                                                       | 500 MB                                    | Sufficient for the MVP                                                                                                                                      |
| [D1 over-limit behaviour](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/) | Queries fail until midnight UTC           | The client keeps data in `log` and `outbox` and retries later; the application keeps working locally                                                        |

**Row budget per sync of format 3:** `user_stats` 1 + `sync_batches` 1 + `user_settings` 0–1 = at most 3 rows. A learner-year of about 40,000 answers is about 2 MB of `sync_batches`, so the 500 MB of a free database hold about 250 learner-years; compaction is not planned unless a limit breaks (ADR 100, point 7).

## D1 schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT, display_name TEXT, avatar_url TEXT, created_at INTEGER NOT NULL
); -- `email`: a verified address in lower case, or NULL; an unverified address is never stored
CREATE INDEX users_email ON users(email); -- linking by email must not scan `users`: D1 counts every scanned row as read
CREATE TABLE oauth_accounts (
  provider TEXT NOT NULL, provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (provider, provider_user_id)
);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  json TEXT NOT NULL, updated_at INTEGER NOT NULL
);
-- the last applied seq per device, with the optimistic-concurrency version of sync format 3
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  device_seq TEXT NOT NULL, last_sync_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 0
);
-- one row per accepted batch of sync format 3: a page of the learner's answer log (ADR 100, 102).
-- WITHOUT ROWID: the primary key is the table, so an insert writes one row and no index row.
CREATE TABLE sync_batches (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id INTEGER NOT NULL,     -- per user, increasing: the user's MAX(id) + 1, never reused
  device_id TEXT NOT NULL, -- the sync deviceId of the batch
  seq INTEGER NOT NULL,
  log TEXT NOT NULL,       -- the batch's LogPage, as JSON
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
) WITHOUT ROWID;
CREATE TABLE content_reports (
  id TEXT PRIMARY KEY, user_id TEXT, item_id TEXT NOT NULL, content_version TEXT NOT NULL,
  reason TEXT NOT NULL, comment TEXT, created_at INTEGER NOT NULL
);
```

**Migrations** are the files `apps/api/migrations/NNNN_title.sql`; `0001_init.sql` creates the schema of P5 and the schema above is what all the migrations leave; `0002_learning_only.sql` rewrites the data of P5 for learning only (flat counters, settings without `typing`, the typing columns emptied, `results` cleared) and changes no schema; `0003_drop_typing.sql` drops the table `results` and the columns `kana_stats` and `typing_records` of `user_stats`; `0004_sync_batches.sql` adds `sync_batches`; `0005_drop_learning_columns.sql` drops the learning columns of `user_stats` (below); `0006_drop_target_answer_time.sql` removes `learn.targetMs` from every settings document ([ADR 115](../adr/115-answer-time-graded-against-the-learners-pace.md)). Like `0002` it rewrites data that the code before it validates strictly: between the migration and the deploy, a tab of the earlier code fails its pulls until it reloads, which [ADR 061](../adr/061-schema-reset-before-release.md) allows before P14. A merged migration is never edited, and each one works with the code deployed before it (new tables, new columns with defaults), because the preview database is shared by every pull request and production is migrated before its deploy. CI applies them with `wrangler d1 migrations apply`: to `nekotype-preview` before a preview deployment, and to `nekotype` after the release candidate's smoke test and before the production deploy ([ADR 083](../adr/083-api-package-and-pages-configuration.md)). Locally, `pnpm run db:migrate:local`.

`user_stats.device_seq` maps `deviceId` → `{ "seq": number, "at": number }`: the last applied `seq` and the time it was applied, which the 90-day cleanup needs (see [Batches](storage-sync.md#batches)). The `user_stats` row is created with the user and its `oauth_accounts` row, in one `batch()`, in the OAuth callback, so a sync always finds it. It starts with `device_seq` = `{}` and `last_sync_at` = 0.

The columns `counters`, `learn`, `learn_recent`, `learn_buckets` and `bucket_newest` of `user_stats` held the learning state of sync format 2 ([ADR 078](../adr/078-user-stats-targeted-updates.md), [ADR 082](../adr/082-sync-acknowledgement-without-snapshot.md)). Format 2 left the server in P7 PR 13 and migration `0005` dropped them in PR 14. The learning state is a fold of the log in `sync_batches` ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md)).

**CPU budget.** A sync handles the small `user_stats` columns and one `LogPage` it does not parse beyond its bounds, so its cost depends on the batch, not on the history. Measured on Cloudflare ([note](../research/2026-11-23-p7-sync-endpoint.md)): a batch of 256 KB takes 10 ms in the warm median against the line of 12 ms of [ADR 086](../adr/086-sync-endpoint-cpu-line.md), a session or a settings batch 3 and 2 ms against 8, and no request was cut off.

## API

| Method and path                    | Purpose                                                                                                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/:provider`          | Start OAuth (`google` with PKCE, `github`): state cookie and redirect                                                                                                                                                              |
| `GET /api/auth/:provider/callback` | Verify state, fetch profile, create or find user, set session, redirect to `/`                                                                                                                                                     |
| `POST /api/auth/logout`            | Delete session and cookie                                                                                                                                                                                                          |
| `GET /api/me`                      | Profile or 401                                                                                                                                                                                                                     |
| `DELETE /api/me`                   | Delete the account and all its data; one `batch()`: `content_reports.user_id` is set to NULL for its reports, then the `users` row is deleted and the foreign keys cascade; the session cookie is cleared                          |
| `POST /api/sync`                   | Body: `v` (3), `deviceId`, `seq`, `after`, `log`, `settings` (see [Sync format 3](#sync-format-3)). Response: the last applied seq for this deviceId and whether other devices wrote rows after `after`. `v` other than 3 is `400` |
| `GET /api/sync?deviceId=&after=`   | The rows of other devices after `after`, at most 100 rows and 256 KB per page, with the account's settings; see [Sync format 3](#sync-format-3)                                                                                    |
| `POST /api/reports`                | Content reports from guests and signed-in users; requires a valid Cloudflare Turnstile token; one report and at most 8 KB per request                                                                                              |

### Request and response bodies

`Settings`, `Track` and the log types (`LogPage`, `LogEvent`) are defined in [Storage and sync](storage-sync.md) and [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md). These types live in `shared/types`; the matching valibot schemas live in `shared/schemas`.

```ts
type SyncRequest = {
  v: 3; // batch format version: 1 (P5, typing data) and 2 (deltas) are gone
  deviceId: string;
  seq: number;
  after: number; // the highest row id the device has pulled
  log: LogPage | null; // the own events not acknowledged yet
  settings: Settings | null; // null when unchanged
};
type SyncResponse = { lastSeq: number; more: boolean }; // POST /api/sync
type PullResponse = {
  last: number; // the next `after`
  more: boolean;
  settings: Settings | null;
  rows: { id: number; log: LogPage }[];
}; // GET /api/sync?deviceId=&after=
type MeResponse = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};
type ReportRequest = {
  itemId: string;
  contentVersion: string;
  reason: 'wrong_reading' | 'wrong_translation' | 'other';
  comment?: string; // at most 500 characters
  turnstileToken: string;
};
```

`POST /api/reports` and `DELETE /api/me` return `204`.

### Errors

Every error body is `{ "error": { "code": string, "lastSeq"?: number } }`.

| Status | `code`             | When                                                    |
| ------ | ------------------ | ------------------------------------------------------- |
| 400    | `invalid_body`     | The body fails schema validation                        |
| 401    | `unauthenticated`  | No valid session                                        |
| 403    | `bad_origin`       | The `Origin` check failed                               |
| 403    | `turnstile_failed` | The Turnstile token was rejected                        |
| 404    | `not_found`        | No route matches the path                               |
| 409    | `seq_gap`          | `seq` > last + 1; the body carries `lastSeq`            |
| 413    | `too_large`        | The body exceeds the limit                              |
| 429    | `rate_limited`     | Sync interval not elapsed; carries `Retry-After`        |
| 500    | `internal`         | An unexpected failure in the handler                    |
| 503    | `conflict`         | A concurrent update won twice; carries `Retry-After: 5` |
| 503    | `unavailable`      | D1 failed or is over its limit                          |

### Applying a batch

**Order of checks.** `Origin` (`403`), body size (`413`), session (`401`), schema (`400`), then the stored row is read and the `seq` rule applies: a batch with `seq` ≤ last is answered like an applied one with the stored `lastSeq`, writes nothing and is not rate-limited; `seq` > last + 1 is `409`; only a batch that would be applied is checked against `last_sync_at` and `SYNC_MIN_INTERVAL_MS` (`429` with `Retry-After` in whole seconds). The schema rejects a `v` other than 3 (so `v: 2`, the deltas of P6, is `400 invalid_body`), any unknown key, and the results, kana statistics, typing block of the settings and counters per mode of P5. `GET /api/sync` without `after`, and any `GET` with `part`, are `400 invalid_body` as well. The path `/api/results` is not a route and answers `404 not_found`.

Two devices of one user can sync at the same moment, and the update of `user_stats` is a read-modify-write of one row; the steps of [Sync format 3](#sync-format-3) guard it with optimistic concurrency on `user_stats.version`. A batch that lost still writes its settings, because `batch()` runs every statement. This is harmless: the upsert is idempotent. A lost attempt spends extra rows, so the row budget above applies to the uncontended case.

### Sync format 3

Format 3 is the only format of the server since P7 PR 13 (formats 1 and 2 are `400 invalid_body`). It is the log of the learner's answers ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), [ADR 102](../adr/102-sync-format-3-server.md)); the server stores batches and never computes a state from them.

**`POST /api/sync`**, body `{ v: 3, deviceId, seq, after, log, settings }`: `after` is the highest row id the device has pulled, `log` a `LogPage` (the own events not acknowledged yet) or `null`, `settings` the account's settings document. A `LogPage` is `{ dev, n0, at0, e }`: one device's consecutive events, 1 to 8,192, each a tuple with its time relative to the previous one; its bounds are one guard shared by the client and the server. Response `{ lastSeq, more }`: the last applied `seq`, and whether other devices wrote rows after `after`. The body is at most 256 KB.

1. One statement reads `device_seq`, `last_sync_at` and `version` of `user_stats`, and `more` (a row of another device with an id above `after`).
2. The `seq` rule of [Batches](storage-sync.md#batches): `seq` ≤ last is answered with the stored `lastSeq` and writes nothing; `seq` > last + 1 is `409 seq_gap`; only a batch to apply is rate-limited (`429`).
3. One `batch()`: the `UPDATE user_stats` (`device_seq` with this device's `{ seq, at }`, without entries older than 90 days; `last_sync_at`; `version + 1`) guarded by `version`; when `log` is not null, the insert into `sync_batches`; when `settings` is not null, the upsert with `keepStored` on `seq` = 1. The insert takes `MAX(id) + 1` of the user and runs only when the `UPDATE` applied: the stored `version` is the one it writes and the stored `seq` of this device is the batch's, so a request that lost the race adds no row.
4. If the `UPDATE` reports `meta.changes` = 0, repeat from step 1 once; a second loss is `503 conflict`.

A sync of format 3 writes at most 3 rows (`user_stats`, `sync_batches`, and `user_settings` when its row exists) and runs at most 5 statements (the session lookup, the read and at most 3 writes), at most 9 with the retry.

**`GET /api/sync?deviceId=&after=`** answers `{ last, more, settings, rows: [{ id, log }] }`. One `batch()` reads the next 101 rows of the user after `after` and the settings. The page walks the rows in order, at most 100: a row of `deviceId` is skipped, other rows are added while their `log` texts total at most 256 KB, and at least one is always added. `last` is the id of the last row walked (`after` when none), the next `after`; `more` says that a row was left. The body is put together from the stored texts without parsing them.

## Authentication and security

- **Session:** a random 32-byte token in cookie `nt_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`); D1 stores only its SHA-256 hash. Lifetime 30 days, renewed when less than 15 days remain. An expired row is deleted when it is seen, and a sign-in deletes the user's other expired rows. `Secure` is left off only when `APP_ORIGIN` is `http://…` (local development).
- **OAuth state:** `GET /api/auth/:provider` sets cookie `nt_oauth` (the state and, for Google's PKCE, the code verifier; `HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=600`) and redirects to the provider; the callback compares the state, deletes the cookie, and redirects to `/` on success, to `/?auth_error=denied` when the user refused, and to `/?auth_error=failed` on a state mismatch or a failed exchange ([ADR 084](../adr/084-oauth-seam-state-cookie-verified-addresses.md)). A deployment without a provider's secrets answers `503 unavailable`.
- **CSRF:** `SameSite=Lax` plus an `Origin` header check on every POST and DELETE.
- **Accounts from different providers** are linked by verified email (Google `email_verified`, GitHub primary verified address). Without a verified email a separate account is created, and no address is stored for it: `users.email` holds a verified address in lower case or `NULL`, so an unverified address can never link a later sign-in to another account.
- **Sync request limits:** body at most 256 KB, at most one request per 5 s per user (checked against `last_sync_at`, no extra writes). Input is validated with valibot schemas from `shared`.
- **Report abuse:** per-request caps above, plus a Cloudflare Turnstile token verified server-side on every request to `/api/reports`. WAF rate-limiting rules are not used: they require an own DNS zone, and \*.pages.dev is not one. The Turnstile script loads only when the report dialog opens, outside the initial budget. The endpoint fails closed ([ADR 092](../adr/092-report-dialog-turnstile-keys-by-host-and-fail-closed-secret.md)): without `TURNSTILE_SECRET_KEY`, or with one of Cloudflare's published test secrets while `ENVIRONMENT` is `production`, it answers `503 unavailable`; so it does when Cloudflare cannot be asked. A valid session sets `content_reports.user_id`; any other cookie is ignored.
- OAuth secrets are stored as Pages project secrets; schema changes are applied via `wrangler d1 migrations`.
- **Local development:** `wrangler pages dev` with a local D1; Vite proxies `/api` to it.

* **Environments:** production binds the production D1. Pages preview deployments bind a separate preview D1 and hide sign-in: every route under `/api/auth/` answers `404 not_found` when `ENVIRONMENT` is `preview`, while `/api/me` and the other routes work. OAuth clients:
  - Google: one OAuth client with two registered redirect URIs, for `nekotype.pages.dev` and for `localhost`. Google does not accept wildcard redirect URIs, so preview subdomains cannot sign in.
  - GitHub: two OAuth Apps, because an OAuth App has one callback URL: one for `nekotype.pages.dev` (production secrets) and one for `localhost` (development secrets in `.dev.vars`).
  - Turnstile uses separate site keys per environment.
