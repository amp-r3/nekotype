# Storage and sync

All data is written to IndexedDB on the device first. Changes accumulate in a single compacted delta; the server receives them as numbered batches and returns a merged snapshot. Results recorded while offline are counted at the next sync.

## Local storage (D18)

Database `nekotype`, `meta.schemaVersion` = `SCHEMA_VERSION` (see "Schema changes"). The IndexedDB wrapper is promise-based, dependency-free, about 1 KB.

| Store      | Key                                | Contents                                                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings` | `current`                          | `Settings`                                                                                                                                                                                                                                                                                                                 |
| `results`  | `id` (indexes `endedAt`, `synced`) | `TestResult` plus `synced: 0 \| 1`, where 1 marks a result acknowledged by the server. A number, because a boolean is not a valid IndexedDB key and such a record would not be indexed                                                                                                                                     |
| `snapshot` | `current`                          | last server snapshot: typing kana statistics, counters, learning state, typing records; empty for a guest                                                                                                                                                                                                                  |
| `delta`    | `learn`, `typing`                  | one accumulator of changes per mode since the last batch. `learn`: learning changes (changed entries, unlocked kana, new recall answers, learning counter increments, active days, bucket increments). `typing`: typing kana statistic and counter increments. Changed settings go with `learn` until P5 decides otherwise |
| `outbox`   | `seq`                              | at most one batch awaiting acknowledgement                                                                                                                                                                                                                                                                                 |
| `records`  | `current`                          | `TypingRecords` shown on this device                                                                                                                                                                                                                                                                                       |
| `meta`     | key                                | `deviceId`, `userId`, `lastSeq`, `schemaVersion`, `syncBlockedAtVersion`, `sessionExpired`, `typingIntervals` (the last 50 typing intervals of recall answers, which give K; device-local, see [Metrics](metrics.md#learning-metrics))                                                                                     |

- **Delta per mode (ADR 072).** `learn` and `typing` are separate records, so a learning write never rewrites typing data and the reverse (A39). A batch takes both.
- **Local view** = snapshot, outbox delta and both `delta` records merged by the rules under "Merge rules", then decayed. A batch moves changes out of `delta` until the server acknowledges it, so the view includes `outbox`; without it a signed-in user's statistics would disappear while a batch is unacknowledged. Snapshot and delta are never stored in the same record.
- **Typing records.** `records` is updated in the same transaction as the result that changes it, for guests and signed-in users alike. On acknowledgement each key is merged with the server's by the rule under "Merge rules". Every local entry comes from a result that reaches the server and both sides use the same rule, so they converge.
- **Compaction:** every change is merged into the single `delta` record; nothing is appended per event. Results live only in `results` and are referenced by id when a batch is built.
- **Client-side decay:** when a kana's counters in `delta` pass the decay threshold ([Metrics](metrics.md#data-model)), the decay function from `shared` halves them in `delta`. This bounds guest data, which never reaches the server. The server applies the same function after adding a delta.
- **Legacy keys:** before the release nobody holds data worth carrying over ([ADR 061](../adr/061-schema-reset-before-release.md)), so nothing is migrated from `kanaflow:settings:v1` and `kanaflow:progress:v1`. Once IndexedDB has opened, the application deletes the legacy keys that the code no longer uses, without reading them: `kanaflow:settings:v1` from P3, `kanaflow:progress:v1` from P4 (`removeLegacyKeys()` in `shared/lib/storage`, called from `app/init.ts`). `nekotype:locale` stays in localStorage because the language is needed synchronously before the first render. A saved value that fails validation, including the removed `content: 'single'`, is replaced by its default.
- **Defaults:** `typing` takes the baseline defaults, with `content` = `words` (D25) and `showTranslation` = true (ADR 056); `learn` = `{ strictness: 'learner', track: 'hiragana', targetMs: 1500, sound: true }`; `updatedAt` = 0.
- **Startup:** the application shell renders synchronously; a screen that needs the settings renders once `settings` has loaded.
- **IndexedDB unavailable** (blocked by the browser or failing to open): the application runs from memory for that page load and shows a notice that data will not be saved; the legacy keys are not deleted. A write that fails after the database opened (quota, a closed connection) switches the notice on for the rest of the page load; the state holds in memory.
- **Two tabs before P5.** Two tabs keep one record: after a successful write a tab posts on the `BroadcastChannel` `nekotype:learn` (`nekotype:settings`), and the other tabs read the record again and replace their state with it. A change not yet written when the message arrives is written over the other tab's (P5 replaces this with merges).
- **Hot path:** no IndexedDB writes during a typing test or inside a keystroke handler. A typing test writes at its end, when it is discarded (the `started` counter only), and on `visibilitychange: hidden`, which also ends a running test (see "Test end" in [Metrics and statistics](metrics.md)). A learning session writes after each answer.

## Schema changes

- **Before the release (ADR 061, until the P7 release tag).** Nobody but the maintainer uses production, so a change to the IndexedDB schema resets the local data and no migration is written. `SCHEMA_VERSION` (an integer in `shared/lib`, next to `PRE_RELEASE`) grows in the pull request that changes a store or the format of its records, and each phase creates the stores it uses. `openDatabase()` opens the database without a version; when a store is missing, `meta.schemaVersion` differs from `SCHEMA_VERSION` or `meta` cannot be read, it closes the connection, deletes the database `nekotype`, creates it again at IndexedDB version 1 and writes `meta.schemaVersion`. This is silent (one `console.info` line). A failure to open, delete or create (blocked by another tab, refused by the browser) is the "IndexedDB unavailable" case: memory only, a notice, legacy keys kept. Another tab holding an old schema closes its connection on `versionchange`. `nekotype:locale` and the server are not reset.
- **After the release.** `SCHEMA_VERSION` starts at 1 and is the IndexedDB version. A change raises it and adds a migration step in `onupgradeneeded` with a test on a fixture of the previous version; `PRE_RELEASE` is `false` and a mismatch is never answered by a reset. A test fails when the number of migration steps differs from `SCHEMA_VERSION − 1`. The release switch is part of P7 ([Phases](phases.md)).

## Settings

```ts
type Settings = {
  typing: {
    script: 'hiragana' | 'katakana' | 'both';
    content: 'words' | 'phrases';
    strictness: Strictness;
    weakFocus: boolean;
    test: { kind: 'time'; seconds: number } | { kind: 'count'; prompts: number } | { kind: 'zen' };
    showTranslation: boolean;
  };
  learn: {
    strictness: Strictness;
    track: 'hiragana' | 'katakana';
    targetMs: number; // target answer time of confidence: 1000–3000 in steps of 250, default 1500
    sound: boolean; // play the kana sound after each task (P6), default true
  };
  updatedAt: number;
};
```

Settings are written to IndexedDB on each change, outside keystroke handlers; nothing waits for `pagehide`, because a transaction started there may not commit before the page unloads. `updatedAt` is set at each change.

The UI locale is device-local (`nekotype:locale`) and is not synced.

## Merge rules

The server merges a batch by these rules; the client applies the same functions from `shared/runtime` to build the local view.

| Data                                                | Rule                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings                                            | Last-write-wins on `updatedAt` for the whole document, except on a batch with `seq` = 1, which is the first batch of a new sign-in: if the account already has settings, the account settings win and the guest settings are discarded                                                                |
| Test results                                        | Append-only; idempotent by `id`                                                                                                                                                                                                                                                                       |
| Typing kana statistics, counters, learning counters | Server adds the delta, then applies decay                                                                                                                                                                                                                                                             |
| Learning entries (box, due date)                    | Last-write-wins on `updatedAt` per kana                                                                                                                                                                                                                                                               |
| Unlocked kana                                       | Union per track                                                                                                                                                                                                                                                                                       |
| Recent recall answers                               | Union per kana, an answer identified by `at`; the 10 latest are kept. Confidence is derived from the merged answers and is not synced                                                                                                                                                                 |
| Active days                                         | Union of the runs; overlapping or adjacent runs are joined                                                                                                                                                                                                                                            |
| Answer-time buckets                                 | Server adds the delta; days more than 365 days before the newest day of the track are dropped                                                                                                                                                                                                         |
| Typing records                                      | Per key, `best` is the maximum KPM over the stored best and every eligible result of the batch, whether newly inserted or not; `recent` is the union by `resultId` of the stored list and the batch's counted results, the 10 latest by `endedAt`, then by id. Applying a batch again changes nothing |
| Content reports                                     | Sent separately via `POST /api/reports`                                                                                                                                                                                                                                                               |

## Batches

1. A new random `deviceId` is generated on every sign-in that starts from guest mode and stored in `meta` with `lastSeq` = 0. The server therefore never sees a reused `deviceId` with a reset `seq`, including after sign-out and sign-in to the same account. Renewing an expired session keeps them (see "Guest, sign-in and sign-out").
2. Sync runs under the Web Lock `nekotype-sync`, so only one tab of a device syncs at a time; all tabs share `deviceId`, `delta` and `outbox`.
3. If `outbox` holds an unacknowledged batch, it is resent unchanged. Otherwise a new batch is built with `seq = lastSeq + 1` from `delta` and up to 200 unsynced results, within 256 KB; it is written to `outbox` and `delta` is cleared in the same transaction.
4. The server keeps the last applied `seq` per `deviceId` and returns it in every sync response. `seq` ≤ last: not applied, the current snapshot is returned. `seq` = last + 1: applied atomically, snapshot returned. `seq` > last + 1: `409` with the server's last `seq`; the client keeps its batch and resends it as last + 1.
5. On acknowledgement the client stores the snapshot, sets `lastSeq`, marks the included results `synced` and clears `outbox`. If unsynced results remain, the next batch is sent 5 seconds later (the server's per-user interval), until none remain.
6. Entries in `user_stats.device_seq` not updated for 90 days are removed on the next write of that row.

## Sync triggers

- On application start, on network reconnect, and 10 seconds after a test or a learning session ends.
- On `visibilitychange: hidden`, via `fetch` with `keepalive`. Browsers limit keepalive request bodies to 64 KB, so the body MUST be at most 60 KB. The handler requests the Web Lock `nekotype-sync` with `ifAvailable`; if the lock is held by a running sync, nothing is sent. With the lock: if `outbox` holds a batch, that batch is resent unchanged when it fits in 60 KB, otherwise nothing is sent; if `outbox` is empty, a new batch is built by step 3 from `delta` only, with no results, and sent only if it fits in 60 KB. The response is processed by step 5 if the page is still alive; otherwise the batch stays in `outbox` and the next regular trigger resends it.
- At most one request per 10 seconds per device, except for catch-up batches (step 5 above), which are spaced 5 seconds apart.

## Failed requests

In every case below the data stays in `outbox` and `delta`. Nothing is dropped automatically.

| Response                       | Client behaviour                                                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network error, `5xx`, D1 limit | The next trigger retries. A `503` carrying `Retry-After` is handled like `429`                                                                                                                                        |
| `429`                          | Wait for `Retry-After`, then the next trigger retries                                                                                                                                                                 |
| `409`                          | Resend the batch as last + 1 (step 4)                                                                                                                                                                                 |
| `401`                          | Set `meta.sessionExpired`, stop syncing, keep working locally and show "Sign in again"                                                                                                                                |
| `400`, `413`                   | The batch cannot succeed unchanged. Store the current `appVersion` in `meta.syncBlockedAtVersion`, stop syncing and show the status. Retry only when `appVersion` differs, because a new release may accept the batch |

## History

- `/stats` reads from the local `results` store, newest first, so it works offline and shows unsynced results immediately.
- For a signed-in user, when the local store runs out of results for a page and the network is available, the client requests the next page from `GET /api/results` with the oldest local result as the cursor, and stores the response with `synced` = 1. Inserting by `id` makes this idempotent. A new device therefore fills its history on demand; the sync snapshot does not carry results.
- **Retention:** unsynced results are never evicted, and a guest's results are never evicted, because they are the only copy. For a signed-in user, when the store holds more than 1,000 results, the oldest synced results above that limit are removed after a sync. The server stays the full copy. `records` does not depend on these rows.

## Guest, sign-in and sign-out

- A guest accumulates changes in `delta` from the first launch. On first sign-in, `delta` goes in the first batch and the guest's results follow in as many batches as needed (step 5). The server merges everything into the account by the rules above. Data from another device is combined, not overwritten.
- **Session state:** at start the client calls `GET /api/me` when `meta.userId` is set or a sign-in redirect has just returned. A `401` follows the `401` rule above; it does not switch the application to guest mode or clear data.
- **Sign-in after an expired session,** compared with `meta.userId`:
  - Same user: `deviceId`, `lastSeq`, `outbox` and `delta` are kept and syncing resumes. Resending under the same `deviceId` keeps the batch idempotent.
  - Different user: the device holds another account's unsent data, which MUST NOT be merged into this account. If any is unsent, a dialog offers to cancel or to discard it. On discard, or if nothing is unsent, all user stores are cleared and the new user starts with no local data. On cancel, the new session is deleted through `POST /api/auth/logout`.
- **OAuth failure:** the callback redirects to `/?auth_error=denied` or `/?auth_error=failed`. The client shows a notice and removes the parameter from the URL.
- **Account deletion** clears all user stores after `DELETE /api/me` succeeds and returns to guest mode.
- **Reset progress** (A33) is available in guest mode only, after a confirmation dialog, and is not shown to a signed-in user, including one whose session has expired. It clears `results`, `delta` and `records`, which hold a guest's typing and learning progress, and keeps `settings`.
- **Sign-out** first runs a sync. If unsent data remains (`outbox` or `delta` not empty, or unsynced results), a confirmation dialog states that this data will be lost. After sign-out all user stores on the device are cleared, including `deviceId`, and the application returns to guest mode.
