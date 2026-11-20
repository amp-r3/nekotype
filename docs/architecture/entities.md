# Entities: stores and their contracts

Part of the [architecture description](README.md) of the current code.

## `entities/settings`

- Holds the learning settings (`learnStrictness`, `learnTrack`, `learnTargetMs`; the sound flag is stored only) as `ReadonlySignal`s, and the actions that change them (`setLearnStrictness`, `setTrack`, `setTargetMs`). `Settings` is `{ learn, updatedAt }` ([ADR 096](../adr/096-learning-only-data-and-sync-format-2.md)).
  - `initSettings(db)` reads the `settings` record (`current`) from IndexedDB, replaces a value that fails `isSettings` with the defaults and sets `settingsReady`; `app/route-view.tsx` shows the loading line until then.
  - Each action writes the whole `Settings` document at once (no debounce, nothing waits for `pagehide`) and sets `updatedAt` from the `Clock`, then posts on the `BroadcastChannel` `nekotype:settings` (another tab reads the document again); a failed write calls `reportWriteFailure()`.
  - `LearnTrack` derives from `ValidSettings`, so the slice imports no other.
- A saved value that fails validation (a document with a `typing` block of P5, for example) is replaced by the defaults, with no conversion (ADR 061).

## `entities/learn`

- `entities/learn/lib` is the learning logic with no UI: track composition and dependencies (`tracks`), recall answer time with K (`answer-time`), confidence (`confidence`), one-at-a-time unlocking (`state`: `evaluateUnlocking`), the mastered count and the streaks (`progress`), boxes and due dates on the local calendar day (`boxes`, `day`), streak (`streak`), 100 ms buckets and the daily median (`buckets`), and the cell state of the chart (`chart`).
  - `entities/learn/model/store` holds the learning state as a `ReadonlySignal` (the view of ADR 087: initial state, snapshot, outbox and the `delta` record `learn`, merged by `mergeLearn` with the track order, and the store's own unwritten changes on top). It builds the view when `/` loads (`status`: `loading`, `ready`, `error`; a missing or invalid record counts as empty, a failed read gives `error`, and after an error nothing is written; `retryLearn()` reads again). `readWithSyncBase` reads the three records in one transaction.
  - An answer updates the view incrementally (the cost of one answer, as before) and merges the same change, as a `LearnDelta`, into the unwritten changes; `unlockDelta` (`lib/state`) turns what unlocking and box evaluation changed into a delta. The whole-state merge runs on load and when another tab posts, never per answer.
  - The write follows the answer outside the keystroke handler through the injected `Scheduler`, once for a burst: one `update` transaction merges the unwritten changes into the stored `delta/learn` (`{ learn: LearnDelta, counters }`, the changes since the last batch; for a guest the whole state) and puts the key intervals (`meta/keyIntervals`, which give K). A failed write keeps the changes for the next one and calls `reportWriteFailure()`.
  - After a successful write the store posts on the `BroadcastChannel` `nekotype:learn`; a message makes it rebuild the view in the chain of its own writes, its unwritten changes on top. "Reset progress" posts `reset`, and the other tabs drop their unwritten changes too. `reevaluate()` unlocks and moves boxes when `learnTargetMs` changes (and after a rebuild).
  - Merge functions are in `packages/shared` (`learn-runtime.ts`, `learn-state.ts`: `mergeLearn`); their property tests are in `sync-properties.test.ts` (ADR 085).
- `counters` is `{ started, finished }`: the learning sessions started and finished, added by `addCounters`. No IndexedDB write happens inside a keystroke handler.
- `packages/engine` also holds the table of visually similar kana and the track composition helpers (`kanaOf`, `kanaRows`) used for distractors and the chart.
