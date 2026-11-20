# Entities: stores and their contracts

Part of the [architecture description](README.md) of the current code.

## `entities/stats`

- `createTypingStore(deps)` (module-level `initTyping`, `saveTest`, `recordDiscardedTest`, `resetTyping` and the `ReadonlySignal`s `typingKanaStats`, `typingCounters`, `typingRecords`, `typingStatus`): the typing statistics as the learning store holds the learning state.
  - `initTyping()` rebuilds the view (ADR 087): the snapshot's kana statistics and counters, the outbox's, then the `delta` record `typing` (`{ kanaStats, counters }`, the changes since the last batch), merged with `mergeKanaStats` and `addCounters`; the records are the snapshot's merged with the `records` record `current` by `mergeTypingRecords`. A missing or invalid record counts as empty and a failed read gives `error`, after which nothing is written.
  - `saveTest({ result, kanaDelta, startedIncrement })` updates the signals, then writes in **one `update` transaction** that reads `delta/typing` and `records` first, so another tab's tests count: the `results` put (`{ ...result, synced: 0 }`, key `result.id`), the `delta` record `typing` (the stored statistics merged with `mergeKanaStats`; `started.typing` and `finished.typing` counted) and `records` (`applyResultToRecords` on the stored records); it sets `celebratedPersonalBest` itself and resolves with the stored result and the average and best from before it.
  - `recordDiscardedTest()` writes only the `started.typing` counter.
  - Writes are queued in one chain, so a read of another tab's change never overlaps them; after a successful write the store posts on the `BroadcastChannel` `nekotype:typing`, and a message makes it rebuild the view.
  - `resetTyping()` clears `results`, `records` and `delta/typing` in one transaction.
  - `readAllResults()` returns every saved result oldest first, in one read of the `endedAt` index (records that fail `isTestResult` are left out, the rest stay); it waits for the writes in progress and rejects when the database cannot be read.
  - `retryTyping()` reads the state again after an error.
  - `loadOlderResults()` (the signal `olderResults`: `unknown`, `loading`, `exhausted` or `failed`) asks the server for the history under the oldest result held (`api/history.ts`: `fetchHistoryPage(before)` calls `GET /api/results` through `apiFetch` and checks the answer with `isResultsResponse`; the cursor is `<endedAt>:<id>`, none when the store is empty). The page goes in with `synced` = 1 in one `update` transaction that reads each `id` first and writes only the missing ones, so a result already held, an unsent one included, is never replaced and a repeated page changes nothing. `exhausted` is remembered until the page is loaded again (and by `resetTyping`); `failed` is not, the next call tries again. It resolves to whether the store gained results, never rejects, and does not check the account: the caller does.
  - `lib/mode-line.ts` has `modeLabel(config)` and `modeLine(parts)` (`words · hiragana · relaxed · 60 s`), used by the typing results and by `/stats`; their strings (`mode.*`) are in the core dictionary because two lazy screens use them.
  - The store never touches `delta/learn` (A39).
- `KanaStatMap`: `Readonly<Record<string, KanaStat>>`, the form `weakFocus` consumes. A kana's weakness is `(erroredAttempts + 1) / (attempts + 2)` and its weight `1 + 4 × weakness`.
- `computeItemWeight(tokenKeys: readonly string[], weights: ReadonlyMap<string, number>): number`: the arithmetic mean of the weights of the kana keys of a word or phrase, unseen keys weighing 3.0. Nothing calls it since the trainer was removed; it goes with the rest of `entities/stats`.

## `entities/settings`

- Holds the practice settings (`script`, `content`, `strictness`, `weakFocus`), the display setting `showTranslation` (not a practice setting, so it does not reset a test, ADR 056), the test length `testConfig` and the learning settings (`learnStrictness`, `learnTrack`, `learnTargetMs`; the sound flag is stored only) as `ReadonlySignal`s, and the actions that change them (`setScript`, `setTestConfig`, `setLearnStrictness`, `setTrack`, `setTargetMs`, …).
  - `initSettings(db)` reads the `settings` record (`current`) from IndexedDB, replaces a value that fails `isSettings` with the defaults and sets `settingsReady`; `app/route-view.tsx` shows the loading line until then.
  - Each action writes the whole `Settings` document at once (no debounce, nothing waits for `pagehide`) and sets `updatedAt` from the `Clock`, then posts on the `BroadcastChannel` `nekotype:settings` (another tab reads the document again); a failed write calls `reportWriteFailure()`.
  - It does not import `entities/prompt`: its `ScriptMode` and `ContentKind` derive from `ValidSettings`.
- `content` defaults to `words`. A saved value that fails validation (for example the removed `single`) is replaced by the defaults, with no conversion (ADR 061); a stored `rowIds` is ignored.

## `entities/learn`

- `entities/learn/lib` is the learning logic with no UI: track composition and dependencies (`tracks`), recall answer time with K (`answer-time`), confidence (`confidence`), one-at-a-time unlocking (`state`: `evaluateUnlocking`), the mastered count and the streaks (`progress`), boxes and due dates on the local calendar day (`boxes`, `day`), streak (`streak`), 100 ms buckets and the daily median (`buckets`), and the cell state of the chart (`chart`).
  - `entities/learn/model/store` holds the learning state as a `ReadonlySignal` (the view of ADR 087: initial state, snapshot, outbox and the `delta` record `learn`, merged by `mergeLearn` with the track order, and the store's own unwritten changes on top). It builds the view when `/` loads (`status`: `loading`, `ready`, `error`; a missing or invalid record counts as empty, a failed read gives `error`, and after an error nothing is written; `retryLearn()` reads again). `readWithSyncBase` reads the three records in one transaction.
  - An answer updates the view incrementally (the cost of one answer, as before) and merges the same change, as a `LearnDelta`, into the unwritten changes; `unlockDelta` (`lib/state`) turns what unlocking and box evaluation changed into a delta. The whole-state merge runs on load and when another tab posts, never per answer.
  - The write follows the answer outside the keystroke handler through the injected `Scheduler`, once for a burst: one `update` transaction merges the unwritten changes into the stored `delta/learn` (`{ learn: LearnDelta, counters }`, the changes since the last batch; for a guest the whole state) and puts the typing intervals. A failed write keeps the changes for the next one and calls `reportWriteFailure()`.
  - After a successful write the store posts on the `BroadcastChannel` `nekotype:learn`; a message makes it rebuild the view in the chain of its own writes, its unwritten changes on top. "Reset progress" posts `reset`, and the other tabs drop their unwritten changes too. `reevaluate()` unlocks and moves boxes when `learnTargetMs` changes (and after a rebuild).
  - Merge functions are in `packages/shared` (`learn-runtime.ts`, `learn-state.ts`: `mergeLearn`); their property tests are in `sync-properties.test.ts` (ADR 085).
- Learning and typing data are separate: typing code does not import `entities/learn`, a learning session does not write the typing records, and no IndexedDB write happens inside a keystroke handler.
- `packages/engine` also holds the table of visually similar kana and the track composition helpers (`kanaOf`, `kanaRows`) used for distractors and the chart.

## `entities/prompt`

- The kana table of the application (`model/data`: `basicRows`, `dakutenRows`, `yoonRows`, `extendedRows`, `allKanaRows`) and the binding of `packages/engine` to it (`lib/engine.ts`: `compile`, `start`, `step`, `isComplete`, `spellingsFor`, `canonical` and the rest of the matcher API; `lib/canonical.ts`: `canonicalFor`). A recall task and an introduction compile their kana with this binding.
- `content/` holds the generated word and phrase chunks (written by `packages/content`, checked by its tests). Nothing in `apps/web/src` imports them and `check-budget.mjs` fails a build whose manifest holds one: no content is shipped before P10 (ADR 093). P10 adds the loader again.
