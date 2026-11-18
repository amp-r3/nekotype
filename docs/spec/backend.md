# Backend

The backend is a Hono application running as Cloudflare Pages Functions on the `nekotype` Pages project, with a D1 database; sign-in is Google and GitHub only, via the Arctic library. One finished test costs 4–5 written D1 rows; a sync that carries only learning progress costs 1–2.

## Free-tier limits that constrain the design

| Limit                                                                                                                  | Value                                     | Design response                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CPU per Functions request](https://developers.cloudflare.com/workers/platform/limits)                                 | 10 ms                                     | OAuth only, no password hashing; the learning state in `user_stats` is updated per touched key in D1 and a sync answers without the snapshot (ADR 078, 082) |
| Functions requests                                                                                                     | 100,000 per day, shared with Workers Free | `_routes.json` limits Functions to `/api/*`; batched sync at most once per 10 s per device                                                                  |
| [D1 reads / writes](https://developers.cloudflare.com/d1/platform/limits)                                              | 5 million / 100,000 rows per day          | Statistics stored as one JSON document per user                                                                                                             |
| D1 database size                                                                                                       | 500 MB                                    | Sufficient for the MVP                                                                                                                                      |
| [D1 over-limit behaviour](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/) | Queries fail until midnight UTC           | The client keeps data in `outbox` and `delta` and retries later; the application keeps working locally                                                      |

**Row budget per finished test:** result row 1 + automatic primary-key index entry 1 (a `TEXT PRIMARY KEY` creates one) + `results_user_time` index entry 1 + `user_stats` 1 + `user_settings` 0–1 = 4–5 rows. The authoritative figure is `meta.rows_written` returned by D1; the acceptance limit is 6. At 6 rows the daily write limit allows about 16,000 tests.

**Row budget per learning sync:** `user_stats` 1 + `user_settings` 0–1 = 1–2 rows. A learning session adds no row of its own, and the sessions between two syncs travel in one batch.

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
-- typing statistics, counters, learning state, typing records and last applied seq per device in one row;
-- the learning state is split so that its large parts are updated per key (ADR 078, 082)
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kana_stats TEXT NOT NULL, counters TEXT NOT NULL,
  learn TEXT NOT NULL,         -- unlocked, entries, stats, activeDays
  learn_recent TEXT NOT NULL,  -- kana → recent recall answers
  learn_buckets TEXT NOT NULL, -- track → day → bucket → count
  bucket_newest TEXT NOT NULL, -- track → newest day of learn_buckets
  typing_records TEXT NOT NULL, device_seq TEXT NOT NULL, last_sync_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE results (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ended_at INTEGER NOT NULL, content TEXT NOT NULL, script TEXT NOT NULL, strictness TEXT NOT NULL,
  config TEXT NOT NULL, kpm REAL NOT NULL, kana_accuracy REAL NOT NULL, json TEXT NOT NULL
);
CREATE INDEX results_user_time ON results(user_id, ended_at DESC);
CREATE TABLE content_reports (
  id TEXT PRIMARY KEY, user_id TEXT, item_id TEXT NOT NULL, content_version TEXT NOT NULL,
  reason TEXT NOT NULL, comment TEXT, created_at INTEGER NOT NULL
);
```

**Migrations** are the files `apps/api/migrations/NNNN_title.sql`; `0001_init.sql` is the schema above. A merged migration is never edited, and each one works with the code deployed before it (new tables, new columns with defaults), because the preview database is shared by every pull request and production is migrated before its deploy. CI applies them with `wrangler d1 migrations apply`: to `nekotype-preview` before a preview deployment, and to `nekotype` after the release candidate's smoke test and before the production deploy ([ADR 083](../adr/083-api-package-and-pages-configuration.md)). Locally, `pnpm run db:migrate:local`.

`user_stats.device_seq` maps `deviceId` → `{ "seq": number, "at": number }`: the last applied `seq` and the time it was applied, which the 90-day cleanup needs (see [Batches](storage-sync.md#batches)). The `user_stats` row is created with the user and its `oauth_accounts` row, in one `batch()`, in the OAuth callback, so a sync always finds it. It starts with empty documents (`bucket_newest` = `{}`: a track without a key has no days) and `last_sync_at` = 0.

`user_stats.learn`, `learn_recent` and `learn_buckets` hold the learning state ([Metrics](metrics.md#data-model)). For a learner with both tracks fully unlocked after a year of daily sessions it is about 300 KB: about 140 KB of answer-time buckets (365 days per track) and 95 KB of recent recall answers (10 for each of 229 kana). The whole row is about 350 KB, well below the 2 MB row limit.

**CPU budget.** Parsing and serializing such a row costs 4–5 ms, half of the 10 ms limit, so a sync never handles `learn`, `learn_recent` or `learn_buckets` whole: it reads and writes only the keys of the batch (see "Applying a batch"), and its response does not carry the snapshot. The cost of a sync then depends on the batch, not on the history. Measured before P5, a learning sync that handled the whole row took 7.9 ms in the median and 15 ms in a cold isolate ([ADR 078](../adr/078-user-stats-targeted-updates.md)). Measured on Cloudflare, this model takes 3 ms in the warm median for a learning sync and 6 ms for a batch at the caps; a cold request takes 9–23 ms, over the limit, and relies on the platform's tolerance for infrequent overruns ([ADR 082](../adr/082-sync-acknowledgement-without-snapshot.md)). The P5 acceptance is the line of that ADR for the real endpoint: a warm median of at most 8 ms for a learning sync and for 50 results and at most 12 ms at the caps, and no request answered with error 1102 ([ADR 086](../adr/086-sync-endpoint-cpu-line.md); measured 8, 8 and 11).

## API

| Method and path                    | Purpose                                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/:provider`          | Start OAuth (`google` with PKCE, `github`): state cookie and redirect                                                                                                                          |
| `GET /api/auth/:provider/callback` | Verify state, fetch profile, create or find user, set session, redirect to `/`                                                                                                                 |
| `POST /api/auth/logout`            | Delete session and cookie                                                                                                                                                                      |
| `GET /api/me`                      | Profile or 401                                                                                                                                                                                 |
| `DELETE /api/me`                   | Delete the account and all its data; set `content_reports.user_id` to NULL for its reports                                                                                                     |
| `POST /api/sync`                   | Body: `deviceId`, `seq`, batch. Response: the last applied seq for this deviceId and the `version` of the user's data; no snapshot (ADR 082)                                                   |
| `GET /api/sync?deviceId=&part=`    | Without `part`: the last applied seq and `version`, used after a `409` and to check for other devices' writes. `part` = `rest`, `recent` or `buckets`: one part of the snapshot with `version` |
| `GET /api/results?before=&limit=`  | Paginated test history (at most 50 per request), newest first; `before` is the cursor `<endedAt>:<id>`                                                                                         |
| `POST /api/reports`                | Content reports from guests and signed-in users; requires a valid Cloudflare Turnstile token; one report and at most 8 KB per request                                                          |

### Request and response bodies

`Settings`, `TestResult`, `KanaStat`, `Counters`, `TypingRecords`, `Track`, `RecallAnswer`, `LearnEntry`, `LearnStat` and `LearnState` are defined in [Metrics](metrics.md) and [Storage and sync](storage-sync.md). These types live in `shared/types`; the matching valibot schemas live in `shared/schemas`.

```ts
type LearnDelta = {
  entries: Record<KanaKey, LearnEntry>; // changed entries
  unlocked: Record<Track, KanaKey[]>; // newly unlocked kana
  recent: Record<KanaKey, RecallAnswer[]>; // new recall answers, at most 10 per kana
  stats: Record<KanaKey, LearnStat>; // increments
  activeDays: [first: number, last: number][]; // runs of days that became active
  recallBuckets: Record<Track, Record<string, Record<string, number>>>; // increments
};
type SyncDelta = {
  kanaStats: Record<KanaKey, KanaStat>; // increments
  counters: Counters; // increments
  learn: LearnDelta;
  settings: Settings | null; // null when unchanged
};
type SyncRequest = {
  v: 1; // batch format version
  deviceId: string;
  seq: number;
  delta: SyncDelta;
  results: TestResult[];
};
type Snapshot = {
  settings: Settings | null;
  kanaStats: Record<KanaKey, KanaStat>;
  counters: Counters;
  learn: LearnState; // the client assembles it from the three parts
  typingRecords: TypingRecords;
};
type SyncResponse = { lastSeq: number; version: number }; // POST /api/sync, and GET without `part`
// GET /api/sync?part=…; the client stores the three parts only when `version` is the same in all
type SnapshotRest = SyncResponse & {
  part: 'rest';
  settings: Settings | null;
  kanaStats: Record<KanaKey, KanaStat>;
  counters: Counters;
  learn: Omit<LearnState, 'recent' | 'recallBuckets'>;
  typingRecords: TypingRecords;
};
type SnapshotRecent = { part: 'recent'; version: number; recent: LearnState['recent'] };
type SnapshotBuckets = {
  part: 'buckets';
  version: number;
  recallBuckets: LearnState['recallBuckets'];
};
type ResultsResponse = { results: TestResult[]; next: string | null }; // next: cursor for `before`
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

**Order of checks.** `Origin` (`403`), body size (`413`), session (`401`), schema (`400`), then the stored row is read and the `seq` rule applies: a batch with `seq` ≤ last is answered like an applied one with the stored `lastSeq` and `version`, writes nothing and is not rate-limited; `seq` > last + 1 is `409`; only a batch that would be applied is checked against `last_sync_at` and `SYNC_MIN_INTERVAL_MS` (`429` with `Retry-After` in whole seconds). The schema rejects a batch over the caps of the learning part (60 kana, 31 bucket days per track), over 50 results and any unknown key.

Two devices of one user can sync at the same moment, and the update of `user_stats` is a read-modify-write of one JSON row. [`batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/) makes the write atomic but does not protect the earlier read, so writes use optimistic concurrency on `user_stats.version`:

1. Read the small columns of `user_stats` (`kana_stats`, `counters`, `typing_records`, `device_seq`, `bucket_newest`, `version`) and apply the `seq` rules. From `learn`, `learn_recent` and `learn_buckets` read only what the batch touches, with `json_extract(column, ?, ?, …)` and one bound path per key: `unlocked` and `activeDays`, the kana of `delta.learn.entries`, `stats` and `recent`, and the days of `delta.learn.recallBuckets`. D1 allows 100 parameters per query, so a statement carries at most 98 paths. `json_each` is not used on a stored column: D1 counts every element it visits as a row read ([ADR 082](../adr/082-sync-acknowledgement-without-snapshot.md)).
2. Compute the merged statistics, counters, learning state, typing records and `device_seq` by the rules in [Storage and sync](storage-sync.md#merge-rules). For the three learning columns the rules are applied to the touched keys only, which gives the same result as the full merge; the outcome is a JSON Merge Patch (RFC 7396) per column. A merge patch merges objects key by key, so it names with `null` what the merge removes: each bucket day that falls more than 365 days behind the newest day of its track (found from `bucket_newest`, without reading the day keys), and each `mixups` key of a touched kana that the decay drops.
3. Run `batch()` with `UPDATE user_stats SET …, learn = json_patch(learn, ?), learn_recent = json_patch(learn_recent, ?), learn_buckets = json_patch(learn_buckets, ?), bucket_newest = ?, version = version + 1 WHERE user_id = ? AND version = ?`, one `INSERT OR IGNORE INTO results … SELECT … FROM json_each(?)` for all results of the batch (D1 allows 50 queries per invocation on Free, and every statement of `batch()` counts), and the `user_settings` upsert if settings changed. The response is the last applied `seq` and the new `version`; the stored columns are not returned.
4. If the `UPDATE` reports `meta.changes` = 0, another request won: repeat from step 1 once. If it loses again, return `503 conflict`; the client keeps its batch and resends it.

A sync of a batch within the caps uses at most 16 of the 50 statements D1 allows: the session lookup, at most 4 reads and 3 writes, repeated at most once by the retry. A learning-only sync writes at most 2 rows and a finished test at most 6. `GET /api/sync` assembles each part from the stored column strings by concatenation and never parses them; `part=rest` reads the settings in the same statement as the columns, so every part carries the `version` of one read. A device's entry in `device_seq` that was not updated for 90 days is removed by the next write, and so are the bucket days that leave the 365-day window.

A batch that lost still inserts its results, because `batch()` runs every statement. This is harmless: inserts are idempotent by `id`, and typing records are computed from every result of the batch, not only newly inserted ones. A lost attempt spends extra rows, so the row budget above applies to the uncontended case.

## Authentication and security

- **Session:** a random 32-byte token in cookie `nt_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`); D1 stores only its SHA-256 hash. Lifetime 30 days, renewed when less than 15 days remain. An expired row is deleted when it is seen, and a sign-in deletes the user's other expired rows. `Secure` is left off only when `APP_ORIGIN` is `http://…` (local development).
- **OAuth state:** `GET /api/auth/:provider` sets cookie `nt_oauth` (the state and, for Google's PKCE, the code verifier; `HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=600`) and redirects to the provider; the callback compares the state, deletes the cookie, and redirects to `/` on success, to `/?auth_error=denied` when the user refused, and to `/?auth_error=failed` on a state mismatch or a failed exchange ([ADR 084](../adr/084-oauth-seam-state-cookie-verified-addresses.md)). A deployment without a provider's secrets answers `503 unavailable`.
- **CSRF:** `SameSite=Lax` plus an `Origin` header check on every POST and DELETE.
- **Accounts from different providers** are linked by verified email (Google `email_verified`, GitHub primary verified address). Without a verified email a separate account is created, and no address is stored for it: `users.email` holds a verified address in lower case or `NULL`, so an unverified address can never link a later sign-in to another account.
- **Sync request limits:** body at most 256 KB, at most 50 results per batch (ADR 078), at most one request per 5 s per user (checked against `last_sync_at`, no extra writes). Input is validated with valibot schemas from `shared`.
- **Report abuse:** per-request caps above, plus a Cloudflare Turnstile token verified server-side on every request to `/api/reports`. WAF rate-limiting rules are not used: they require an own DNS zone, and \*.pages.dev is not one. The Turnstile script loads only when the report dialog opens, outside the initial budget.
- Client-submitted results are accepted without server-side verification in the MVP; there are no leaderboards.
- OAuth secrets are stored as Pages project secrets; schema changes are applied via `wrangler d1 migrations`.
- **Local development:** `wrangler pages dev` with a local D1; Vite proxies `/api` to it.

* **Environments:** production binds the production D1. Pages preview deployments bind a separate preview D1 and hide sign-in: every route under `/api/auth/` answers `404 not_found` when `ENVIRONMENT` is `preview`, while `/api/me` and the other routes work. OAuth clients:
  - Google: one OAuth client with two registered redirect URIs, for `nekotype.pages.dev` and for `localhost`. Google does not accept wildcard redirect URIs, so preview subdomains cannot sign in.
  - GitHub: two OAuth Apps, because an OAuth App has one callback URL: one for `nekotype.pages.dev` (production secrets) and one for `localhost` (development secrets in `.dev.vars`).
  - Turnstile uses separate site keys per environment.
