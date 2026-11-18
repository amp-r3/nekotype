# Entities: stores and their contracts

Part of the [architecture description](README.md) of the current code.

## `entities/stats`

- `createTypingStore(deps)` (module-level `initTyping`, `saveTest`, `recordDiscardedTest`, `resetTyping` and the `ReadonlySignal`s `typingKanaStats`, `typingCounters`, `typingRecords`, `typingStatus`): the typing statistics as the learning store holds the learning state.
  - `initTyping()` reads the `delta` record `typing` (`{ kanaStats, counters }`) and the `records` record `current`; a missing or invalid record gives the initial state and a failed read gives `error`, after which nothing is written.
  - `saveTest({ result, kanaDelta, startedIncrement })` updates the signals, then writes in **one transaction** the `results` put (`{ ...result, synced: 0 }`, key `result.id`), the `delta` record `typing` (kana statistics added, then `decayKanaStat`; `started.typing` and `finished.typing` counted) and `records` (`applyResultToRecords`); it sets `celebratedPersonalBest` itself and resolves with the stored result and the average and best from before it.
  - `recordDiscardedTest()` writes only the `started.typing` counter.
  - Writes are queued in one chain, so a read of another tab's change never overlaps them; after a successful write the store posts on the `BroadcastChannel` `nekotype:typing`.
  - `resetTyping()` clears `results`, `records` and `delta/typing` in one transaction.
  - `readAllResults()` returns every saved result oldest first, in one read of the `endedAt` index (records that fail `isTestResult` are left out, the rest stay); it waits for the writes in progress and rejects when the database cannot be read.
  - `retryTyping()` reads the state again after an error.
  - `lib/mode-line.ts` has `modeLabel(config)` and `modeLine(parts)` (`words · hiragana · relaxed · 60 s`), used by the typing results and by `/stats`; their strings (`mode.*`) are in the core dictionary because two lazy screens use them.
  - The store never touches `delta/learn` (A39).
- `KanaStatMap`: `Readonly<Record<string, KanaStat>>`, the form `weakFocus` consumes. A kana's weakness is `(erroredAttempts + 1) / (attempts + 2)` and its weight `1 + 4 × weakness`.
- `computeItemWeight(tokenKeys: readonly string[], weights: ReadonlyMap<string, number>): number`: Evaluates prompt weight for words/phrases by computing the arithmetic mean over all constituent token kana keys (unseen keys defaulting to weight 3.0, per section 8 of the [archived v1 plan](../archive/v1-implementation-plan.md)). Since D20 it is used: `createPromptWeights()` in `features/training` maps each word or phrase to the `KanaKey`s of its tokens and weighs it by their mean; a single kana key weighs what it did before.

## `entities/settings`

- Holds the practice settings (`script`, `content`, `strictness`, `weakFocus`), the display setting `showTranslation` (not a practice setting, so it does not reset a test, ADR 056), the test length `testConfig` and the learning settings (`learnStrictness`, `learnTrack`, `learnTargetMs`; the sound flag is stored only) as `ReadonlySignal`s, and the actions that change them (`setScript`, `setTestConfig`, `setLearnStrictness`, `setTrack`, `setTargetMs`, …).
  - `initSettings(db)` reads the `settings` record (`current`) from IndexedDB, replaces a value that fails `isSettings` with the defaults and sets `settingsReady`; `app/route-view.tsx` shows the loading line until then.
  - Each action writes the whole `Settings` document at once (no debounce, nothing waits for `pagehide`) and sets `updatedAt` from the `Clock`, then posts on the `BroadcastChannel` `nekotype:settings` (another tab reads the document again); a failed write calls `reportWriteFailure()`.
  - It does not import `entities/prompt`: its `ScriptMode` and `ContentKind` derive from `ValidSettings`.
- `content` defaults to `words`. A saved value that fails validation (for example the removed `single`) is replaced by the defaults, with no conversion (ADR 061); a stored `rowIds` is ignored.
- Changing a setting does not reset the session here (a slice cannot import another); `setupSettingsResetWatcher` in `features/training` does.

## `entities/learn`

- `entities/learn/lib` is the learning logic with no UI: track composition and dependencies (`tracks`), recall answer time with K (`answer-time`), confidence (`confidence`), one-at-a-time unlocking (`state`: `evaluateUnlocking`), the mastered count and the streaks (`progress`), boxes and due dates on the local calendar day (`boxes`, `day`), streak (`streak`), 100 ms buckets and the daily median (`buckets`), and the cell state of the chart (`chart`).
  - `entities/learn/model/store` holds the learning state as a `ReadonlySignal`; it loads the `delta` record `learn` when `/` loads (`status`: `loading`, `ready`, `error`; a missing or invalid record gives the initial state, a failed read gives `error`, and after an error nothing is written, so the stored record is never replaced by the initial state; `retryLearn()` reads again), applies an answer, and writes once per answer after the keystroke handler through the injected `Scheduler` (a failing database means memory mode).
  - Deviation from `storage-sync.md` until P5: the `delta` record `learn` holds the whole learning state and the counters (`{ learn, counters }`), not an accumulator of changes since the last batch, and its typing counters stay 0, since typing counts in the `delta` record `typing` (`entities/stats`). P5 replaces the format; before the release the schema can reset (ADR 061).
  - After a successful write the store posts on the `BroadcastChannel` `nekotype:learn`, and a message from another tab makes it read the record again (in the chain of its own writes); `reevaluate()` unlocks and moves boxes when `learnTargetMs` changes.
  - A failed write calls `reportWriteFailure()` (the "data will not be saved" notice).
  - Merge functions for `delta` are in `packages/shared` (`learn-runtime.ts`, `learn-state.ts`: `mergeLearn`); their property tests are in `sync-properties.test.ts` (ADR 085). The store does not use `mergeLearn` yet.
- Learning and typing data are separate: typing code does not import `entities/learn`, a learning session does not write the typing records, and no IndexedDB write happens inside a keystroke handler.
- `packages/engine` also holds the table of visually similar kana and the track composition helpers (`kanaOf`, `kanaRows`) used for distractors and the chart.

## `entities/prompt`

- `buildPool(settings: PoolSettings, content?: readonly ContentItem[]): readonly PromptItem[]`: Builds the prompt pool from the loaded words or phrases, filtered by the script mode (`mixed` phrases only for `both`; a phrase keeps its `tatoebaId`). It is empty while the vocabulary is not loaded or when nothing matches the script; the trainer then shows no prompt and blocks input (a loading notice, or the load error with Retry). There is no kana fallback pool since P3 (ADR 019, 028 are superseded).
- `pickPrompt(pool: readonly PromptItem[], weights: ReadonlyMap<string, number>, rng: Rng, previousKey: string | null): PromptItem`: Selects the next prompt using weighted distribution. Throws an invariant Error on an empty pool, which `buildPool` no longer produces.
