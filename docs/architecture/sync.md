# Sync on the client

The client side of [Storage and sync](../spec/storage-sync.md) and [backend.md](../spec/backend.md), since P5 PR 7 ([ADR 088](../adr/088-sync-engine-lazy-chunk-and-triggers.md)). Nothing starts it before PR 8, which lets a user sign in: the engine runs only while `meta.userId` is set.

## Where the code is

| Path                                  | Chunk        | Holds                                                                                                                                                       |
| ------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities/user`                       | initial      | The `userId` signal, `initUser(db)` and `refreshUser()`; the channel `nekotype:user`. No `fetch`                                                            |
| `shared/lib/idb/sync-request.ts`      | shared, lazy | `requestSync(reason)` and `onSyncRequest(handler)`. The end of a learning session (`pages/learn`) and of a typing test (`features/training`) call the first |
| `app/sync-bootstrap.ts`               | initial      | After the database opens: `initUser`; when `userId` is set, here or by another tab, `import('@/features/sync')` and `startSync(db)`                         |
| `shared/api`                          | lazy         | `apiFetch(path, request, fetch)`: JSON, the error body, `Retry-After`; never throws, a failed `fetch` is `{ kind: 'network' }`                              |
| `features/sync`                       | lazy         | `model/engine.ts`, `model/runtime.ts` (`startSync`, `stopSync`, the Web Lock, the page events), `model/status.ts`, `lib/` (pure), `api/sync.ts`             |
| `pages/settings/ui/account-panel.tsx` | lazy         | The account section with the sync status line; loaded by the settings page when `userId` is set. PR 8 completes it                                          |

`features/sync` is imported dynamically only; `check-budget.mjs` proves its chunk is neither initial nor a static import of a route chunk.

## The engine (`model/engine.ts`)

`createSyncEngine(deps)` takes the database, the clock and scheduler, `fetch`, the locks, the page events, one `ChangeChannel` per store and the callbacks to the user signals and to `requestSync`; the tests give it a fake server built from the shared merge functions (`model/test-util.ts`).

- **A cycle** runs under the lock `nekotype-sync`. It reads `meta`: no user, an expired session or a block at this `appVersion` end it (a block of another version is lifted). Then: an outbox in the database is resent unchanged; otherwise `buildNext` moves the next batch from `delta/learn`, `delta/typing`, the changed settings and up to 50 unsynced results into the outbox, in one `Db.update` (`lib/build-batch.ts`: `splitLearnDelta` with the caps, the 256 KB limit by dropping results from the end). With nothing to send, `start` and `online` call `GET /api/sync` and read the parts when the `version` differs.
- **An acknowledgement** with `version` = stored + 1 applies the batch to the snapshot with `applyBatch`; any other reads the three parts (twice at most again when their `version` values differ) and assembles the snapshot (`lib/apply-ack.ts`). One transaction writes the snapshot and `meta.snapshotVersion`, `meta.lastSeq`, deletes the outbox, marks the results `synced`, merges `records` with the server's when the snapshot was read, and applies the settings rule (`settingsAfter`). Then it posts on `nekotype:learn` and `nekotype:typing` (and `nekotype:settings` when it replaced the settings).
- **Failures** follow the table of "Failed requests": a `409` rewrites the outbox's `seq` to `lastSeq + 1` and resends (three times at most per cycle); `401` writes `meta.sessionExpired` and calls `refreshUser`; `400` and `413` write `meta.syncBlockedAtVersion`; a `429` or a `503` with `Retry-After` sets `notBefore` and a timer; anything else leaves the data where it is.
- **Triggers:** `start` (at once, with a pull), `online` (with a pull), `requestSync` (10 s later, coalesced), `visibilitychange` to `hidden` (a `keepalive` request within 60 KB, only when the lock is free, no results). Spacing: 10 s between requests, 5 s between catch-up batches.
- **Status** (`model/status.ts`, first match wins): `blocked`, `expired`, `offline`, `pending`, `synced`; it is computed from the database after each cycle and when `requestSync` is called, and shown by the account panel.
- **Retention** after an acknowledgement: above 1,000 results the oldest synced ones are deleted.
