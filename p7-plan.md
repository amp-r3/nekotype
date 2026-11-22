# P7 plan: the knowledge model

Working file of phase P7 ([phases.md](docs/spec/phases.md), item 8). It tells the executor of each pull request what to build, in which order, and which decisions are already made. It is not part of `docs/`: the last pull request of the phase moves it to `docs/archive/`.

- Written on 2026-11-22 against `main` at f511d78 (PR 204 merged: research part 5; [ADR 100](docs/adr/100-knowledge-model-fsrs-planner-and-answer-log.md) merged in PR 203).
- Where this plan and `docs/spec/` disagree, the spec wins until the pull request named here changes the spec. Every such change is listed in [section 3.7](#37-spec-changes) with its pull request.
- P7 builds new code, so section 3 holds the contracts: types, signatures, keys, SQL and constants. They are final. An executor copies them and does not invent names.
- Sections: [status](#status), [goal and scope](#1-goal-and-scope), [what was checked](#2-what-was-checked), [decisions](#3-decisions), [answered questions](#4-answered-questions), [manual steps](#5-maintainers-manual-steps), [pull requests](#6-pull-requests), [executor instructions](#7-instructions-for-executor-agents), [risks](#8-risks).

## Status

The executor of a pull request fills its row (see [section 7](#7-instructions-for-executor-agents)). Rows 8–11 are pull requests into the integration branch `p7-switch`; row 12 merges that branch into `main` ([D21](#d21-the-integration-branch)).

| PR  | Branch                        | Base        | Status | Pull request |
| --- | ----------------------------- | ----------- | ------ | ------------ |
| 1   | `p7-01-model-package`         | `main`      | done   | #206         |
| 2   | `p7-02-fold`                  | `main`      | done   | #207         |
| 3   | `p7-03-planner-sim`           | `main`      | done   | #208         |
| 4   | `p7-04-stats-view`            | `main`      | done   | #209         |
| 5   | `p7-05-forecast-cost`         | `main`      | done   | #210         |
| 6   | `p7-06-sync-format-3-server`  | `main`      | —      | —            |
| 7   | `p7-07-sync-bench`            | `main`      | —      | —            |
| 8   | `p7-08-log-store`             | `p7-switch` | —      | —            |
| 9   | `p7-09-learning-on-the-model` | `p7-switch` | —      | —            |
| 10  | `p7-10-stats-from-the-log`    | `p7-switch` | —      | —            |
| 11  | `p7-11-sync-format-3-client`  | `p7-switch` | —      | —            |
| 12  | `p7-switch`                   | `main`      | —      | —            |
| 13  | `p7-13-format-2-out`          | `main`      | —      | —            |
| 14  | `p7-14-drop-learning-columns` | `main`      | —      | —            |
| 15  | `p7-15-close`                 | `main`      | —      | —            |

## 1. Goal and scope

**What the user gets.** "Continue" starts one session that the model plans. It reviews the kana of both tracks whose recall would fall below 90% before the next session, brings learning kana back after 30 s, 1, 2, 4 and 8 minutes, and introduces new kana, at most four learning at once. The chart shows locked, learning, learned and mastered kana; the progress line says how many kana are due. Progress syncs as a log of answers that merges without loss when syncs fail. The forecast of the next row, the outline of the next session and "what got stronger" are computed by the model, ready for the home of P8.

**In scope** ([ADR 100](docs/adr/100-knowledge-model-fsrs-planner-and-answer-log.md); [phases.md](docs/spec/phases.md), P7):

- `packages/model`: FSRS-6, the kana items, the grade table of every task type, the fold of the log, the planner A4, statistics, the learn view, the forecast, the outline;
- `packages/sim` on the production model: the acceptance tables and the forecast accuracy;
- sync format 3: the log as batches, one D1 row per batch, pulls of other devices' rows; format 2 and the learning columns of `user_stats` removed;
- the client: the log in IndexedDB (schema 6), the learn store as a fold, the session on the planner, the screens of ADR 100 point 9, `/stats` from the log, the sync engine on format 3;
- the model's cost in Chromium and the endpoint's CPU on Cloudflare;
- the spec, `README.md`, `docs/architecture/` and `AGENTS.md` for all of the above.

**What stays:** the input engine; the recall answer time and K (A37); the displayed romaji; the recognition option rules, with confusion counts in place of mixups; settings as one document, last-write-wins; sign-in, sign-out, the guest merge, account deletion, reports; the hot-path rules and every budget limit.

**Out of scope:**

- Showing the forecast, the outline, "what got stronger" and the katakana suggestion: P8. P7 computes and tests them; nothing in the app calls them ([D8](#d8-forecast-outline-and-what-got-stronger)).
- Task types other than recall and recognition: P9, P10, P12. The log format and the fold accept them now ([D4](#d4-grades)).
- Fitting the model to the learner, FSRS-7 ([part 5](docs/research/2026-11-21-p7-knowledge-model-part-5.md#what-this-means-for-adr-100)), compaction of the log: after the release.
- A design export: the code follows ADR 100 and [Q2](#q2-a-design-pull-request); the export catches up in the design session of P8.
- IndexedDB migrations: a schema change still resets the local data ([ADR 061](docs/adr/061-schema-reset-before-release.md)).
- `/progress` and the home: P8.

## 2. What was checked

Checked on 2026-11-22 against the code on `main` at f511d78.

| Item                 | Finding                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budgets today        | `pnpm run build && pnpm run budget`: initial JS 31.17 of 35 KB gzip (31.06 at the end of P6), initial CSS 7.70 of 10 KB, first load 100.04 KB. Lazy: session runtime 10.10 KB, sync 5.47, `/stats` 5.13, account panel 1.74, settings 1.71, summary panel 0.99                                                                                                                                                                  |
| FSRS-6 in the sim    | `packages/sim/src/fsrs.ts` (98 lines) with `createFsrs`, `FSRS6_WEIGHTS`, `firstMemory`, `nextMemory`, `retrievability`, `intervalFor`; `fsrs7.test.ts` checks it against `FSRS6Algorithm` of ts-fsrs 6.0.0, a dev dependency of `packages/sim` only. `Memory` carries an optional `fast` for FSRS-7                                                                                                                            |
| A4 in the sim        | `PLANNER_A4` in `policies/fsrs-planner.ts` (590 lines with the research options). The harness (`run.ts`) drives any `Policy` (`session`, `next`, `record`), so a production planner plugs in through an adapter. Same day = the same UTC day (`Math.floor(at / DAY_MS)`), the sim's clock starts at a midnight with offset 0. The kana of the previous task is excluded from every list, so a session ends when only it is left |
| Sim items            | `items.ts` builds both tracks from `kanaRows` of `@nekotype/engine` in table order (104 + 125), parts by canonical decomposition and small-to-full yōon, pairs by the 0x60 code-point offset. The engine's `RowCategory` is `basic`, `dakuten`, `yoon`, `extended`                                                                                                                                                              |
| Learn store          | `entities/learn/model/store.ts` (450 lines): signals over `delta/learn` merged with the snapshot and the outbox by `mergeLearn`. `recordRecall` runs inside the keystroke handler that completes an answer (`session.ts`, `completeTyped`): it computes the answer time and merges in the handler; only the IndexedDB write waits for `scheduler.setTimeout(…, 0)`                                                              |
| IndexedDB wrapper    | `Db` has `get`, `put`, `delete`, `write`, `update` (one read-modify-write transaction), no `getAll` and no cursor; `memory-db.ts` mirrors it. Schema 5: `settings`, `delta`, `snapshot`, `outbox`, `meta`. `openDatabase` resets when a listed store is missing or `schemaVersion` differs; an extra store does not reset                                                                                                       |
| Session              | `SESSION_TASKS` = 25; a `review` mode with a queue; `task-choice.ts` (focus, weights) and `review-queue.ts`; recognition options from `stat.mixups` and `spellingsFor` of the prompt binding (`pages/learn/lib/prompt`)                                                                                                                                                                                                         |
| Chart and summary    | `entities/learn/lib/chart.ts`: `CellState` = locked, learning, confident, mastered; `cellInfos(track, state, targetMs, now)`. The design system's `KanaChart` and the `/` guideline draw `confident` and `review (N)`; the summary has `unlocked` and `now confident`                                                                                                                                                           |
| Strings              | Keys tied to the old model: `learn.review`, `learn.session.review`, `learn.chart.state.confident`, `learn.chart.notIntroduced`, `learn.summary.unlocked`, `learn.summary.confident`, `settings.learn.targetHint` (speaks of confidence)                                                                                                                                                                                         |
| `/stats`             | Reads `learnState.activeDays`, `recallBuckets` and `learnCounters`; `lib/answer-time.ts` takes quartiles from 100 ms buckets                                                                                                                                                                                                                                                                                                    |
| Client sync          | `features/sync/model/engine.ts` (534 lines), `build-batch.ts` with `splitLearnDelta` caps, `apply-ack.ts` with `applyBatch` on the snapshot, `GET part=rest/recent/buckets`. The sign-out check for unsent data reads `delta` and `outbox`. Client imports of the format-2 merge code: `store.ts`, `lib/state.ts`, `engine.ts`, `build-batch.ts`                                                                                |
| Shared format-2 code | `learn-runtime.ts` (285 lines), `learn-state.ts` (147), `learn-patch.ts` (136), the v2 parts of `sync-runtime.ts` and `schemas.ts`, `testing/year.ts`; `SYNC_FORMAT_VERSION` = 2 is read by the client batch and by `outboxDelta`                                                                                                                                                                                               |
| API                  | `routes/sync.ts`, `sync/apply-batch.ts` (264 lines), `db/sync.ts` (338): per-key `json_extract` and `json_patch`, optimistic concurrency on `user_stats.version`, the settings upsert with `keepStored` on `seq` = 1. `db/users.ts` inserts `counters`, `learn`, `learn_recent`, `learn_buckets`, `bucket_newest` (all `NOT NULL`) when a user is created                                                                       |
| D1 and CI            | Migrations `0001`–`0003`. `deploy.yml` applies migrations to `nekotype-preview` before a preview deploy and to `nekotype` after the release candidate's smoke test, before the production deploy; the root `wrangler.toml` has the environments `preview` and `production` with the binding `DB`. `pull_request` has no branch filter, so pull requests into any branch get CI and a preview                                    |
| Browser tests        | `e2e/lib/learn.ts` `openRecall` clicks `review (1)`; `seedLearning` writes `delta/learn`; `latency.spec.ts` plays two sessions of 25 tasks; the sync e2e are `guest-sign-in`, `offline-online`, `two-tabs`. `fake-indexeddb` is a dev dependency of `apps/web`                                                                                                                                                                  |
| Latency gate         | `LATENCY_PATHS` holds `pages/learn/`, `entities/learn/model/`, `shared/lib/idb/` and the input source, not `packages/`; `playwright.latency.config.ts` builds with the probe (`build:probe`) and matches `latency.spec.ts` only                                                                                                                                                                                                 |
| Budget script        | `check-budget.mjs` fails when `src/features/sync/index.ts` is in the initial chunk or a static import of a route chunk (`SYNC_ENTRY`); no such check for any other entry                                                                                                                                                                                                                                                        |
| Bench                | `apps/bench` deploys the real API to `nekotype-bench` with a counting D1 wrapper (`x-bench-meta`: statements, rows read and written) and reads `cpuTime` from the tail. The project and its database were deleted after P5; `seed.ts` writes a format-2 year row                                                                                                                                                                |
| Decision records     | The status lines that ADR 100 changes (ADR 058, 062, 063, 078, 082, 085, 087, 096) were set in PR 203; A47–A52 are in `decisions.md`. ADR 086 point 2 ("valibot stays") is untouched                                                                                                                                                                                                                                            |

## 3. Decisions

Each decision fills a gap that ADR 100 and the spec leave open. The maintainer answered the four questions of [section 4](#4-answered-questions) on 2026-11-22; everything else is decided here, with its reason. Paths are relative to the repository root.

### 3.1 The model package

#### D1. The model package

`packages/model`, published in the workspace as `@nekotype/model`, holds every rule of ADR 100 that is not storage, sync or screen. It runs in the browser, in a Worker and in Node (the sim), like `packages/engine`. Reason: ADR 100 point 10 asks for one model that the app and `packages/sim` both run; a package keeps the app's layer rules out of the sim.

- `package.json`: `"exports": { ".": "./src/index.ts", "./testing": "./src/testing/index.ts" }`; dependencies `@nekotype/engine` and `@nekotype/shared` (`workspace:*`); dev dependencies as the engine's, plus `ts-fsrs` 6.0.0 (the sim keeps it too, for its FSRS-7 test) and `tsx` for the cost script.
- `tsconfig.json`: `"lib": ["ES2022"]`, `"types": []`, no DOM.
- `eslint.config.js` (source files, tests excepted): imports only relative paths, `@nekotype/engine` and `import type` from `@nekotype/shared/types`; `no-restricted-globals` for `window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `setTimeout`, `setInterval`, `Date`; `no-restricted-properties` for `Math.random`. Time comes as numbers and randomness as `Rng` (`@nekotype/shared/types`).
- `vitest.config.ts`: coverage thresholds 95% statements, functions and lines, 90% branches.
- Source files, each named in the decision that defines it: `constants.ts` (D9), `fsrs.ts`, `items.ts` (D3), `grade.ts` (D4), `order.ts`, `learner.ts`, `fold.ts` (D5), `planner.ts` (D6), `stats.ts`, `view.ts` (D7), `stronger.ts`, `forecast.ts` (D8), `index.ts` (re-exports only), `testing/index.ts`, `testing/events.ts` (event builders for tests), `testing/synthetic-log.ts` (D23); `scripts/cost.ts` (Node timing, `pnpm --filter @nekotype/model run cost`).
- `fsrs.ts` is `packages/sim/src/fsrs.ts` moved, with `Memory = { readonly stability: number; readonly difficulty: number }` and one addition, `intervalFactor(retention: number): number` (`intervalFor(1, retention)`, the days per day of stability until recall falls to `retention`). The sim's FSRS-7 keeps its own memory type with `fast`.

#### D2. Log events

The events of ADR 100 point 7, in `packages/shared/src/types.ts` (types only; the client, the server and the model read them):

```ts
export type TaskKind =
  | 'recall' // shape → romaji
  | 'recognition' // sound (romaji in P7) → one of 4 shapes
  | 'contrast' // which of a confusable pair (P9)
  | 'transfer' // か → カ (P9)
  | 'build' // か + ゛ → が (P9)
  | 'fluency' // one kana typed in a fluency run (P9)
  | 'listening' // sound → shape (P10)
  | 'dictation' // sound → romaji (P10)
  | 'pair' // minimal pair か or が (P10)
  | 'word'; // a word (P12)

/** A word item of P12: `word:` and its reading in kana. */
export type WordKey = `word:${string}`;

/** Identity and order of an event (ADR 100, point 7). */
export type EventId = {
  /** Device clock, Unix ms, integer; never lower than the device's previous event. */
  readonly at: number;
  /** The log device id: a UUID created with the log on the device. */
  readonly dev: string;
  /** 1, 2, 3, … per `dev`. */
  readonly n: number;
};

export type IntroductionEvent = EventId & { readonly t: 'intro'; readonly k: LearnKanaKey };

export type AnswerEvent = EventId & {
  readonly t: 'answer';
  readonly task: TaskKind;
  /** The kana asked: the composite of `build`, the katakana of `transfer`; a `WordKey` only for `word`. */
  readonly k: LearnKanaKey | WordKey;
  readonly ok: boolean;
  /** Answer time, integer ms, 0–10,000 (recall: A37; other tasks: showing the task → the answer). */
  readonly ms: number;
  readonly hint: boolean;
  /** The wrong answer given: the option chosen, or the kana the typed romaji matched (D18). */
  readonly wrong: LearnKanaKey | null;
  /** The other option of a two-option task (`contrast`, `pair`); null otherwise. */
  readonly alt: LearnKanaKey | null;
};

/** `tz`: the device's UTC offset at the start, in minutes east of UTC (−720…840). */
export type SessionStartEvent = EventId & { readonly t: 'start'; readonly tz: number };
export type SessionEndEvent = EventId & { readonly t: 'end' };

export type LogEvent = IntroductionEvent | AnswerEvent | SessionStartEvent | SessionEndEvent;

/** An event before the log gave it its identity (D16). */
export type EventDraft =
  | Omit<IntroductionEvent, 'dev' | 'n'>
  | Omit<AnswerEvent, 'dev' | 'n'>
  | Omit<SessionStartEvent, 'dev' | 'n'>
  | Omit<SessionEndEvent, 'dev' | 'n'>;
```

- `alt` is not in the list of point 4 of ADR 100, but its contrast row ("the pair's confusion count decays on a success") cannot be folded without the other option of the pair, and a kana can be in several pairs (わ/ね/れ). It is null for every task of P7.
- `tz` is `-new Date(at).getTimezoneOffset()`, taken by the app, never by the model.

#### D3. Items

`items.ts` derives the learnable kana from `kanaRows(track)` of `@nekotype/engine`, as `packages/sim/src/items.ts` does, keyed as the app keys them today (`hiragana:か`):

```ts
export type RowId = `${Track}:${string}`; // `${track}:${row id of the kana table}`, e.g. 'hiragana:k'

export type KanaItem = {
  readonly key: LearnKanaKey;
  readonly kana: string;
  readonly track: Track;
  readonly row: RowId;
  readonly category: 'basic' | 'dakuten' | 'yoon' | 'extended';
  /** Position in track order, from 0. */
  readonly index: number;
  /** The kana it is built from ([Learning](docs/spec/learning.md#unlocking), "Dependencies"). */
  readonly parts: readonly LearnKanaKey[];
  /** The same kana in the other track, when there is one. */
  readonly pair: LearnKanaKey | null;
};

/** Both tracks, hiragana first, each in track order: 104 + 125 = 229 entries. */
export const ITEMS: ReadonlyMap<LearnKanaKey, KanaItem>;
export function trackItems(track: Track): readonly KanaItem[];
/** The rows of a track in table order, each with its keys in order. */
export function trackRows(
  track: Track,
): readonly { readonly id: RowId; readonly keys: readonly LearnKanaKey[] }[];
/** The learnable kana of a reading, longest match first (two characters, then one); others are skipped. */
export function kanaOfReading(reading: string): readonly LearnKanaKey[];
```

The 46 basic kana of a track are its items with `category` = `basic`. The app's `entities/learn/lib/tracks.ts` keeps `keyOf` and `trackOfKey` and takes `keysOfTrack` and `dependenciesOf` from these items in PR 9.

#### D4. Grades

`grade.ts` is the table of ADR 100 point 4 as one function. A grade is computed when the log is folded and is never stored.

```ts
export type Grade = 1 | 2 | 3 | 4; // again, hard, good, easy (easy is never given)

export type Effect =
  /** A memory update. `main`: the kana the task asked, whose phase and streak follow it. */
  | {
      readonly kind: 'grade';
      readonly key: LearnKanaKey;
      readonly grade: Grade;
      readonly main: boolean;
    }
  /** A confusion count of the ordered pair (asked, given), raised or lowered by one, never below 0. */
  | {
      readonly kind: 'confusion';
      readonly asked: LearnKanaKey;
      readonly given: LearnKanaKey;
      readonly delta: 1 | -1;
    };

/** `learned`: whether a kana is learned at this point of the fold. */
export function effectsOf(
  answer: AnswerEvent,
  targetMs: number,
  learned: (key: LearnKanaKey) => boolean,
): readonly Effect[];
```

"By time" below means: good (3) when `ms ≤ targetMs` and no hint, else hard (2). A wrong answer is "again" (1) on the kana asked.

| Task          | Correct                                             | Wrong                                     | Confusion                           |
| ------------- | --------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| `recall`      | `k` by time; each learned part of `k` hard (credit) | `k` again                                 | +1 (`k`, `wrong`) when wrong is set |
| `recognition` | `k` hard                                            | `k` again                                 | +1 (`k`, `wrong`) when wrong is set |
| `contrast`    | `k` hard                                            | `k` again                                 | +1 (`k`, `alt`) wrong; −1 correct   |
| `transfer`    | `k` hard; its `pair` hard when learned              | `k` again                                 | none                                |
| `build`       | `k` by time; each learned part of `k` hard (credit) | `k` again                                 | none                                |
| `fluency`     | `k` good when `ms ≤ targetMs`; otherwise no effect  | `k` again (a recall error)                | none                                |
| `listening`   | `k` hard                                            | `k` again                                 | +1 (`k`, `wrong`) when wrong is set |
| `dictation`   | `k` by time                                         | `k` again                                 | none                                |
| `pair`        | `k` hard                                            | `k` again                                 | +1 (`k`, `alt`) wrong               |
| `word`        | each learned kana of `kanaOfReading(reading)` hard  | no effect (the word's own grade is P12's) | none                                |

- Credit and pair reviews are `main: false`: they update memory and `lastAt` only.
- A fluency run sends one event per kana per run (P9 makes sure of it); the fold treats each event alone.
- "−1 on a correct contrast" is the decay of point 4, taken as one count back per success because counts are integers; P9 may change it in its own ADR.

#### D5. The fold

The state is a fold of the log ([ADR 100](docs/adr/100-knowledge-model-fsrs-planner-and-answer-log.md), points 1 and 7). It is never stored, synced or migrated.

```ts
// order.ts
/** By `at`, then `dev` (string order), then `n`. */
export function compareEvents(a: EventId, b: EventId): number;
/** `${dev}:${n}`: an event received twice counts once. */
export function eventKey(e: EventId): string;
/** Days from 1970-01-01 in the zone `tz` minutes east of UTC. */
export function localDay(at: number, tz: number): number;

// fold.ts
export type Phase = 'learning' | 'learned'; // a new kana has no entry

export type ItemState = {
  readonly phase: Phase;
  readonly memory: Memory; // FSRS-6; stability in days
  /** `at` of the last event that updated it: introduction, answer, credit. */
  readonly lastAt: number;
  /** Local day of `lastAt`, in the zone of the device that wrote that event. */
  readonly lastDay: number;
  /** Correct recalls in a row while learning. */
  readonly streak: number;
  /** `learner.tasks` when it was last the task's kana (credit does not move it). */
  readonly lastTask: number;
};

export type LearnerState = {
  /** Introductions and answers folded. */
  readonly tasks: number;
  readonly lastTaskAt: number | null;
  /** `at` of the first task of the current sitting (a sitting ends at a gap over an hour). */
  readonly sittingStart: number | null;
  /** The last 10 gaps of over an hour between two tasks, ms, oldest first. */
  readonly gaps: readonly number[];
  /** The last 10 finished sittings: first to last task, ms. */
  readonly sittings: readonly number[];
  /** The last 200 intervals between two tasks of one sitting, ms. */
  readonly taskMs: readonly number[];
  /** Moving average of review outcomes, rate 0.05, from 0.90. */
  readonly observed: number;
  /** The last 200 outcomes of answers on learning kana and of reviews (the forecast). */
  readonly outcomes: { readonly learning: readonly boolean[]; readonly review: readonly boolean[] };
  /** Per `dev`, the `tz` of its last session start. */
  readonly tz: Readonly<Record<string, number>>;
};

export type ModelState = {
  readonly items: ReadonlyMap<LearnKanaKey, ItemState>;
  readonly learner: LearnerState;
  /** asked → given → count; only counts above 0. */
  readonly confusions: ReadonlyMap<LearnKanaKey, ReadonlyMap<LearnKanaKey, number>>;
  readonly targetMs: number;
};

export type FoldOptions = { readonly targetMs: number; readonly stats: boolean };
export type ApplyResult = 'applied' | 'duplicate' | 'out-of-order';

export interface Fold {
  /** Applies an event that sorts after the last one applied; otherwise changes nothing. */
  apply(event: LogEvent): ApplyResult;
  /** Live and read-only: valid until the next `apply`. The planner reads it. */
  readonly state: ModelState;
  /** Live statistics (D7); null when `stats` is false. */
  readonly stats: LogStats | null;
  readonly last: EventId | null;
  /** Events skipped by rule 1. */
  readonly ignored: number;
  /** Copies that later applies do not change, for signals: O(kana + days). */
  snapshot(): { readonly state: ModelState; readonly stats: LogStats | null };
  /** An independent fold with the same state; the forecast clones with `stats: false`. */
  clone(options?: Partial<FoldOptions>): Fold;
}

export function createFold(options: FoldOptions): Fold;
/** Drops repeated `eventKey`s, sorts by `compareEvents` and applies. Equal to applying the sorted events one by one. */
export function foldLog(events: Iterable<LogEvent>, options: FoldOptions): Fold;
```

Rules, in the order each event is applied:

1. **Ignored:** an event whose `k` is neither in `ITEMS` nor a `WordKey` of a `word` answer. The fold counts them in `ignored` for tests and never throws.
2. **Session start:** `tz[dev]` = `tz`. **Session end:** nothing in the model (statistics count both).
3. **Tasks** (introductions and answers) first update the learner: a gap `at − lastTaskAt` over `GAP_MIN_MS` is kept (`gaps`, the last 10), ends the sitting (its span joins `sittings`, the last 10) and starts a new one; a shorter one joins `taskMs` (the last 200). `lastTaskAt` = `at`; `tasks` grows by one last, after rules 4–8, which read the value before it. The local day of an event is `localDay(at, tz[dev] ?? 0)`.
4. **Introduction** of a new kana: `{ phase: 'learning', memory: firstMemory(1), lastAt: at, lastDay, streak: 0, lastTask }`. An introduction of a kana that is not new is ignored (two devices introduced it).
5. **Answer** on a kana that is new at its place in the order (a clock out of step) introduces it first, as rule 4 would, then applies.
6. A **review** is an answer with task `recall` on a kana whose phase is `learned` before the answer. It moves `observed` by `ADAPT_RATE × (ok − observed)` and joins `outcomes.review`; every other answer on a kana joins `outcomes.learning`.
7. **Effects** of `effectsOf(answer, targetMs, learned)`: each grade is `nextMemory(memory, grade, elapsed, sameDay)` with `elapsed = max(0, at − lastAt) / DAY_MS` and `sameDay = (localDay of at) === lastDay`; then `lastAt` and `lastDay` follow the answer. Confusion counts change by `delta`, never below 0.
8. **Phase of the main kana** (when `effectsOf` gives a main grade): learned and graded again → learning with streak 0 (a lapse). Learning: again → streak 0; a correct `recall` → streak + 1; any other correct task keeps it. Then a learning kana whose streak reaches `recallsToLearn(state)` (D6) is learned. `lastTask` = `tasks` before this task.
9. **Incremental apply:** an event that does not sort after `last` returns `out-of-order` and changes nothing; the caller folds the whole log again. A key already applied returns `duplicate`.

Values in the fold's maps are immutable and replaced on change, so `snapshot()` copies maps, not values. The fold keeps no per-answer history beyond the bounded lists above and the statistics of D7.

#### D6. The planner

`planner.ts` is candidate A4 ([part 3](docs/research/2026-11-21-p7-knowledge-model-part-3.md#planners)) over `ModelState`. The learner values come from `learner.ts`, which the fold also uses for graduation.

```ts
// learner.ts
/** 0 while review retention holds the goal; 1 at 10 points below. */
export function pressure(state: ModelState): number; // clamp((GOAL − observed) / PRESSURE_SPAN, 0, 1)
export function requestedRetention(state: ModelState): number; // RETENTION + p × (RETENTION_MAX − RETENTION)
export function learningLimit(state: ModelState): number; // max(1, round(LEARN_MAX − p × (LEARN_MAX − 1)))
export function recallsToLearn(state: ModelState): number; // GRADUATE + round(EXTRA_RECALLS_MAX × p)
/** The median of `gaps` (the element at ⌊length / 2⌋ of the sorted list), or HORIZON_DEFAULT_MS. */
export function horizonMs(state: ModelState): number;
/** A learned kana: the moment from which it is due; null otherwise. */
export function dueFrom(state: ModelState, key: LearnKanaKey): number | null;

// planner.ts
export type PlannedTask =
  | { readonly kind: 'introduction'; readonly key: LearnKanaKey }
  | { readonly kind: 'recall'; readonly key: LearnKanaKey; readonly review: boolean }
  | { readonly kind: 'recognition'; readonly key: LearnKanaKey };

export type PlanContext = {
  readonly now: number;
  /** `settings.learn.track`: where new kana come from. */
  readonly track: Track;
  /** The kana of the previous task of this session. */
  readonly previous: LearnKanaKey | null;
  readonly rng: Rng;
};

/** The next task of a session; null when there is nothing to offer, which ends the session. */
export function nextTask(state: ModelState, ctx: PlanContext): PlannedTask | null;
```

- **Due** (both tracks): a learned kana with `lastAt + stability × intervalFactor(r) × DAY_MS ≤ now + h`, where `r = requestedRetention`, `h = horizonMs`; `dueFrom` returns the left side minus `h`. Due kana are ordered by `(now + h − lastAt) / stability`, highest first (the lowest predicted recall at `now + h`), then by track order (hiragana first). No `Math.pow` per kana per task: `intervalFactor(r)` is computed once per call. Reason: the forecast plays up to 18,000 tasks, and point 10 gives it 200 ms at 4× ([D23](#d23-the-models-cost-in-the-browser)).
- **Ready learning:** phase learning and `now − lastAt ≥ STEP_MS × 2^streak`, ordered by `lastTask`, oldest first, then track order.
- **Introduction**, only while fewer than `learningLimit` kana are learning. Eligible: a new kana whose parts are all learned. The candidate is the first eligible kana of `ctx.track` in track order; but when the other track has at least one introduced kana, more than `TRACK_LAG` fewer introduced than `ctx.track`, and an eligible kana, its first eligible kana is the candidate. Nothing else introduces from the other track: the learner starts katakana by switching the track (ADR 100, point 5).
- **Other learning:** learning kana not ready, ordered as ready ones.
- **Choice:** the first of due, ready, introduction, other learning, with `previous` left out of the three kana lists. When all four are empty, `previous` is taken if it is due or learning; otherwise the result is null. Reason: ADR 100 says "left out when another is available"; the sim instead ended a session there and began a new one with the same kana, which in the app would show a summary after every task.
- **Kind:** an introduction is an introduction; a due kana is `recall` with `review: true`; a learning kana is `recognition` when one `rng.next()` falls below `RECOGNITION_SHARE`, else `recall` with `review: false`. No other draw is made.
- The session (D18) ends after `SESSION_TASKS` tasks or at the first null.

#### D7. Statistics and the learn view

`stats.ts` adds to the fold (when `stats` is true) what the screens show; `view.ts` turns a snapshot into plain data that the screens read without loading the model.

```ts
// stats.ts
export type RecallStat = { readonly ms: number; readonly ok: boolean };
export type KanaLog = {
  /** The last 10 answers of task `recall`, oldest first. */
  readonly recall: readonly RecallStat[];
  /** Answers of task `recognition`, all of them; no decay. */
  readonly recognitions: number;
  readonly recognitionErrors: number;
};
export type DayLog = {
  /** Answers of any task on the day: a day with one is active (A41). */
  readonly answers: number;
  /** Answer times of task `recall` per track, in fold order. */
  readonly recall: Readonly<Record<Track, readonly number[]>>;
};
export type LogStats = {
  readonly kana: ReadonlyMap<LearnKanaKey, KanaLog>;
  /** Local day (the event's `dev` zone) → its log. No day is dropped. */
  readonly days: ReadonlyMap<number, DayLog>;
  /** Session starts and ends: the `learn` counters. */
  readonly started: number;
  readonly finished: number;
};

// view.ts
export type ChartState = 'locked' | 'learning' | 'learned' | 'mastered';
export type KanaView = {
  readonly key: LearnKanaKey;
  readonly state: ChartState;
  /** Learned or mastered: from this moment it is due; else null. */
  readonly dueFrom: number | null;
  /** Learned or mastered: when its predicted recall reaches 0.90 (`lastAt + stability` days). */
  readonly nextReviewAt: number | null;
  readonly stability: number | null;
  readonly recall: readonly RecallStat[];
  /** Of `recall`; 0 when empty. The median of an even count is the mean of the two middle values. */
  readonly medianMs: number;
  readonly accuracy: number;
  readonly recognitions: number;
  readonly recognitionErrors: number;
  /** Kana given instead of this one, highest count first, then track order. */
  readonly confusions: readonly { readonly key: LearnKanaKey; readonly count: number }[];
};
export type LearnView = {
  /** Every kana of both tracks. */
  readonly kana: ReadonlyMap<LearnKanaKey, KanaView>;
  /** The first new kana of the track whose parts are learned (the chart's "opens next"). */
  readonly opensNext: Readonly<Record<Track, LearnKanaKey | null>>;
  readonly mastered: Readonly<Record<Track, number>>;
  readonly introduced: Readonly<Record<Track, number>>;
  /** The 46 basic hiragana are learned (ADR 100, point 5); P8 shows it. */
  readonly suggestKatakana: boolean;
  readonly stats: LogStats;
};
export function describe(state: ModelState, stats: LogStats): LearnView;
```

- Chart state: locked = new; learning = phase learning (a lapsed kana included); learned = phase learned with stability under `MASTERED_STABILITY_DAYS`; mastered = at or above it (A52).
- "Due" on a screen is `dueFrom !== null && now ≥ dueFrom`, computed by the page with its clock.
- Streaks: the active days are the keys of `days` with `answers` > 0; the current and best streak follow the rule of [Metrics](docs/spec/metrics.md#learning-metrics), computed in `entities/learn` from those keys.

#### D8. Forecast, outline and what got stronger

`forecast.ts` and `stronger.ts`; P7 tests them and measures them, P8 calls them ([ADR 100](docs/adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 6; [part 4](docs/research/2026-11-21-p7-knowledge-model-part-4.md#forecasts-that-play-the-planner-forward)). Reason for no caller in P7: the device-local history of past forecasts would need a format before its screen exists.

```ts
export type Habits = {
  /** A sitting's usual length: the median of `sittings` plus the median of `taskMs`; SITTING_DEFAULT_MS while empty. */
  readonly sittingMs: number;
  /** `horizonMs(state)`: sittings start this far apart. */
  readonly gapMs: number;
  /** The median of `taskMs`, or TASK_DEFAULT_MS while it holds fewer than OUTCOMES_MIN. */
  readonly taskMs: number;
  /** Correct shares of `outcomes.learning` and `outcomes.review`; null while learning has fewer than OUTCOMES_MIN (then the model predicts). */
  readonly shares: { readonly learning: number; readonly review: number } | null;
};
export function habitsOf(state: ModelState): Habits;

/** `forecast`: a past `Forecast.raw`; `actual`: the sessions it took. */
export type SettledForecast = { readonly forecast: number; readonly actual: number };
/** Sessions; FORECAST_MAX_SESSIONS + 1 means "not within 60 sessions". */
export type Forecast = {
  readonly row: RowId;
  /** The median before the correction: what `SettledForecast.forecast` keeps (the sim's "forward, observed"). */
  readonly raw: number;
  readonly low: number;
  readonly median: number;
  readonly high: number;
};

/** The first row of the track with a kana not introduced; null when every kana is introduced. */
export function nextRow(state: ModelState, track: Track): RowId | null;

export function forecastRow(
  state: ModelState,
  row: RowId,
  ctx: {
    readonly now: number;
    readonly track: Track;
    readonly rng: Rng;
    readonly habits: Habits;
    readonly history: readonly SettledForecast[];
  },
): Forecast;

export type Outline = {
  readonly reviews: number;
  readonly learning: number;
  readonly introductions: number;
};
export function outlineSession(
  state: ModelState,
  ctx: { readonly now: number; readonly track: Track; readonly rng: Rng },
): Outline;

// stronger.ts
export type Stronger = {
  readonly key: LearnKanaKey;
  readonly from: ChartState;
  readonly to: ChartState;
};
/** Kana whose chart state rose, or that stayed learned or mastered with stability at least doubled; track order. */
export function strongerSince(before: LearnView, after: LearnView): readonly Stronger[];
```

- **A play** clones the state (`stats: false`), then runs sittings: the current one ends at `sittingStart + sittingMs` (or now + `sittingMs` when the last task is over an hour ago), the next ones start every `gapMs` and last `sittingMs`. Inside a sitting the planner's sessions follow one another (up to `SESSION_TASKS` tasks each, the previous kana reset per session) until the sitting's time is up; each task moves the clock by `taskMs`. A session that offers nothing ends the sitting. The play counts sessions with at least one task until every kana of `row` is introduced; it stops at `FORECAST_MAX_SESSIONS` sessions or `FORECAST_MAX_SITTINGS` sittings, whichever comes first (a guard: a sim play with nothing due never ended), and then gives `FORECAST_MAX_SESSIONS + 1`.
- **Answers in a play:** an introduction is done; another task is correct when one `rng.next()` falls below the share of its kind (a review: `shares.review`; else `shares.learning`), or, when `shares` is null, below the model's prediction (recall: the predicted recall; recognition: `p + (1 − p) / 4`). A correct answer takes `PLAY_OK_MS`, a wrong one `PLAY_WRONG_MS` (they decide good or hard). This is part 4's method: ADR 100's "future sessions have the learner's usual length and follow at the median gap" is the sim's sittings.
- **The forecast:** `FORECAST_PLAYS` plays, sorted; median, low and high are the plays at index `Math.round(q × 9)` for q = 0.5, 0.1 and 0.9 (5, 1 and 8), as the sim takes them. With at least `FORECAST_HISTORY_MIN` settled forecasts in `history` (the last `FORECAST_HISTORY` are used), each of the three is multiplied by the ratio `actual / forecast` at index ⌊length / 2⌋ of the sorted ratios and rounded, at least 1; otherwise the ratio is 1.
- **The outline** is one play of one session with the model's predicted answers.

#### D9. Constants

`constants.ts`; every value as simulated (A4), so a change needs the run of [rule 3b](#7-instructions-for-executor-agents).

| Name                                       | Value        | Meaning                                              |
| ------------------------------------------ | ------------ | ---------------------------------------------------- |
| `LEARN_MAX`                                | 4            | kana learning at once                                |
| `STEP_MS`                                  | 30,000       | first learning step; doubled per correct recall      |
| `GRADUATE`                                 | 5            | correct recalls in a row to be learned               |
| `RETENTION`                                | 0.90         | requested retention (the first lever: 0.93, ADR 100) |
| `RETENTION_MAX`                            | 0.98         | requested retention at full pressure                 |
| `GOAL`                                     | 0.90         | review retention that adaptation holds               |
| `ADAPT_RATE`                               | 0.05         | rate of the moving average of reviews                |
| `PRESSURE_SPAN`                            | 0.10         | points below the goal at full pressure               |
| `EXTRA_RECALLS_MAX`                        | 2            | added correct recalls at full pressure               |
| `GAP_MIN_MS`                               | 3,600,000    | a gap counts when over an hour                       |
| `GAPS_KEPT`                                | 10           | gaps in the median                                   |
| `HORIZON_DEFAULT_MS`                       | 43,200,000   | expected next session until a gap is known           |
| `SESSION_TASKS`                            | 30           | tasks of a session at most                           |
| `RECOGNITION_SHARE`                        | 0.25         | recognition on a learning kana                       |
| `TRACK_LAG`                                | 10           | introduced kana the other track may lag              |
| `MASTERED_STABILITY_DAYS`                  | 21           | learned → mastered (A52)                             |
| `RECENT_RECALLS`                           | 10           | recall answers per kana in the view                  |
| `OUTCOMES_KEPT`                            | 200          | outcomes per kind for the forecast                   |
| `OUTCOMES_MIN`                             | 20           | fewer: the forecast uses the model                   |
| `SITTINGS_KEPT`                            | 10           | sittings in the median                               |
| `SITTING_DEFAULT_MS`                       | 300,000      | a sitting until one is known                         |
| `TASK_MS_KEPT`                             | 200          | task intervals in the median                         |
| `TASK_DEFAULT_MS`                          | 4,000        | a task until intervals are known                     |
| `PLAY_OK_MS`, `PLAY_WRONG_MS`              | 1,200, 2,500 | answer times in a play                               |
| `FORECAST_PLAYS`                           | 10           | plays per forecast                                   |
| `FORECAST_MAX_SESSIONS`                    | 60           | longest play, in sessions                            |
| `FORECAST_MAX_SITTINGS`                    | 240          | longest play, in sittings                            |
| `FORECAST_HISTORY`, `FORECAST_HISTORY_MIN` | 10, 3        | settled forecasts used, and needed for a correction  |

`FSRS6_WEIGHTS` stay in `fsrs.ts`. `ANSWER_PAUSE_MS` (400) and `ANSWER_TIME_CAP_MS` (10,000) stay in the app.

#### D10. The simulator on the production model

- `packages/sim/src/policies/production.ts`: `createProductionPolicy(track: Track = 'hiragana'): PolicyFactory`. It maps sim item ids to keys by position (`hiraganaItems()` and `bothTracks()` are in `ITEMS` order; a test checks every id), keeps a `Fold` (`targetMs` 1500, `stats: false`), and per session emits a `start` event (`tz` 0) at the first `next`, `end` when the session ends, and one event per sim answer (`dev` `'sim'`, `n` counting, `ms` rounded and capped at 10,000, `wrong` mapped). `next` is `nextTask` with `previous` per session and at most `SESSION_TASKS` tasks, as the app runs it. It converts and nothing else: no rule of D5 or D6 is written in the sim.
- Recognition options are not A4: the adapter builds them with the sim's rule, moved from `fsrs-planner.ts` to `src/options.ts` and shared by both.
- `packages/sim/src/p7.ts`, `pnpm --filter @nekotype/sim run p7` (`PART=main|planner|forecast|cost`): `main` is the main table (three learners, 50 seeds, 60 days); `planner` is part 3's planner table (the five learners, 30 seeds, 30 days); `forecast` is D8's forecast against the sim's outcome at the first session of each day (reference and `recallGain ×0.5`, 20 seeds, 30 days, columns as in part 4); `cost` times `foldLog` on the synthetic log in Node.
- The research policies stay, so parts 1–5 still reproduce; the acceptance numbers come from `p7` only.

### 3.2 Sync format 3 and the server

#### D11. Wire format and codec

A log page is the unit of a sync batch, of a D1 row and of an IndexedDB record: consecutive events of one `dev`, compact. An answer is about 50 bytes, so a year (about 40,000 answers) is about 2 MB, ADR 100's upper estimate. Task names and kana keys stay whole for readability; the times are relative.

```ts
// packages/shared/src/types.ts
/** `dt`: `at` minus the previous event's `at` in the page (0 for the first); '' stands for null. */
export type EncodedEvent =
  | readonly [dt: number, t: 'i', k: LearnKanaKey]
  | readonly [
      dt: number,
      t: 'a',
      task: TaskKind,
      k: LearnKanaKey | WordKey,
      ok: 0 | 1,
      ms: number,
      hint: 0 | 1,
      wrong: LearnKanaKey | '',
      alt: LearnKanaKey | '',
    ]
  | readonly [dt: number, t: 's', tz: number]
  | readonly [dt: number, t: 'e'];

export type LogPage = {
  readonly dev: string;
  /** `n` of the first event; the others follow without gaps. */
  readonly n0: number;
  /** `at` of the first event. */
  readonly at0: number;
  readonly e: readonly EncodedEvent[];
};
```

`packages/shared/src/log-codec.ts`, exported from `@nekotype/shared/runtime`:

```ts
export const LOG_PAGE_EVENTS = 500; // events of a closed own page in IndexedDB
export const MAX_PAGE_EVENTS = 8_192; // events of any page or batch
/** Events of one `dev`, `n` without gaps, `at` not decreasing; throws otherwise (a bug, not data). */
export function encodePage(events: readonly LogEvent[]): LogPage;
export function isLogPage(value: unknown): value is LogPage;
/** The events of a page; null when it is not a valid page. */
export function decodePage(value: unknown): readonly LogEvent[] | null;
```

Bounds that `isLogPage` checks: `dev` a UUID; `n0` and `at0` safe integers, `n0` ≥ 1, `at0` ≥ 0; 1 to `MAX_PAGE_EVENTS` events; `dt` a safe integer ≥ 0; kana keys by `isLearnKanaKey` (at most 24 characters), a `WordKey` only with task `word` (at most 64 characters); `task` one of `TaskKind`; `ok` and `hint` 0 or 1; `ms` an integer 0–10,000; `tz` an integer −720–840.

#### D12. Endpoints

```ts
// packages/shared/src/types.ts (final names; format 2's become SyncRequestV2 and SyncResponseV2 until PR 13)
export type SyncRequest = {
  readonly v: 3;
  readonly deviceId: string;
  readonly seq: number;
  /** The highest row id the device has pulled (`meta.pulledId`). */
  readonly after: number;
  /** The own events not acknowledged yet, or null. */
  readonly log: LogPage | null;
  readonly settings: ValidSettings | null;
};
/** POST: the last applied `seq`, and whether other devices wrote rows after `after`. */
export type SyncResponse = { readonly lastSeq: number; readonly more: boolean };
export type PulledRow = { readonly id: number; readonly log: LogPage };
/** GET ?deviceId=&after=: rows of other devices after `after`. */
export type PullResponse = {
  /** The highest id the page examined, own rows included: the next `after`. */
  readonly last: number;
  /** Rows after `last` exist. */
  readonly more: boolean;
  readonly settings: ValidSettings | null;
  readonly rows: readonly PulledRow[];
};
```

**`POST /api/sync`** with format 3. Checks as today: `Origin`, body size, session, schema. Then:

1. One statement reads `device_seq`, `last_sync_at`, `version` of `user_stats` and `more` = `EXISTS (SELECT 1 FROM sync_batches WHERE user_id = ?1 AND id > ?2 AND device_id <> ?3)`.
2. The `seq` rule of [Storage and sync](docs/spec/storage-sync.md#batches): `seq` ≤ last answers `{ lastSeq: last, more }` and writes nothing; `seq` > last + 1 is `409 seq_gap`; only a batch to apply is rate-limited (`429`).
3. `batch()`: (a) `UPDATE user_stats SET device_seq = ?2, last_sync_at = ?3, version = version + 1 WHERE user_id = ?1 AND version = ?4` (`device_seq` with this device's `{ seq, at }` and without entries older than 90 days); (b) when `log` is not null, the insert of [D13](#d13-d1-schema-and-migrations) guarded by `version = ?4 + 1`; (c) when `settings` is not null, the existing upsert with `keepStored` on `seq` = 1.
4. `meta.changes` of (a) = 0: repeat from 1 once, then `503 conflict`, as today.
5. Response `{ lastSeq: seq, more }`. The server never parses `log` beyond the guard and never computes a state.

**`GET /api/sync?deviceId=&after=`**: the session lookup, then one `batch()` of two reads: `SELECT id, device_id, log FROM sync_batches WHERE user_id = ?1 AND id > ?2 ORDER BY id LIMIT 101` and `SELECT json FROM user_settings WHERE user_id = ?1`. The page walks the rows in order, at most `PULL_PAGE_ROWS` (100; it and `PULL_PAGE_BYTES` are constants of `apps/api/src/db/batches.ts`): a row of `deviceId` is skipped, other rows are added while their `log` texts total at most `PULL_PAGE_BYTES` (256 KB), and always at least one. `last` is the id of the last row walked (`after` when none), `more` is true when a row was left. The body is assembled from the stored texts without parsing them: `{"last":…,"more":…,"settings":…,"rows":[{"id":…,"log":…},…]}`. Without `after` the request is `400 invalid_body` from PR 13; until then `part=` keeps answering format 2.

Errors keep the table of [Backend](docs/spec/backend.md), "Errors". A sync request is at most 256 KB (`MAX_SYNC_BODY_BYTES`), 60 KB with `keepalive`.

#### D13. D1 schema and migrations

`apps/api/migrations/0004_sync_batches.sql` (PR 6; additive, so the code of format 2 runs on it):

```sql
-- One row per accepted batch of sync format 3 (ADR 100, point 7). WITHOUT ROWID: the primary key is
-- the table, so an insert writes one row and no index row.
CREATE TABLE sync_batches (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id INTEGER NOT NULL,     -- per user, increasing: the user's MAX(id) + 1
  device_id TEXT NOT NULL, -- the sync deviceId of the batch
  seq INTEGER NOT NULL,
  log TEXT NOT NULL,       -- the batch's LogPage, as JSON
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
) WITHOUT ROWID;
```

The insert of a batch:

```sql
INSERT INTO sync_batches (user_id, id, device_id, seq, log, created_at)
SELECT ?1, next, ?2, ?3, ?4, ?5
FROM (SELECT COALESCE(MAX(id), 0) + 1 AS next FROM sync_batches WHERE user_id = ?1)
WHERE (SELECT version FROM user_stats WHERE user_id = ?1) = ?6; -- ?6: the version read in step 1, plus one
```

`apps/api/migrations/0005_drop_learning_columns.sql` (PR 14):

```sql
ALTER TABLE user_stats DROP COLUMN counters;
ALTER TABLE user_stats DROP COLUMN learn;
ALTER TABLE user_stats DROP COLUMN learn_recent;
ALTER TABLE user_stats DROP COLUMN learn_buckets;
ALTER TABLE user_stats DROP COLUMN bucket_newest;
```

- After both: `user_stats (user_id, device_seq, last_sync_at, version)`, created with the user as today. Reason: the sessions counters are now `start` and `end` events (A49).
- **Rows written per sync:** `user_stats` 1 + `sync_batches` 1 + `user_settings` 0–1 = at most 3 (ADR 100, point 10). Statements: the session lookup, one read and at most three writes, so at most 5, and 9 with the retry.
- Ids are per user and never reused while the account exists: rows are deleted only with the user.

#### D14. Validation and limits

- The envelope is a valibot schema in `packages/shared/src/schemas.ts`; its `log` is `v.nullable(v.custom<LogPage>(isLogPage))`, so the bounds of an event have one definition, `log-codec.ts`, used by the client on every page it reads and by the server on every batch. Reason: the client needs the guard anyway (it never loads valibot); ADR 086 measured valibot on batches of a few kilobytes, while a 256 KB batch holds thousands of tuples; and one guard keeps the bounds in one place for both sides. ADR 102 amends ADR 086, point 2, for the events only.
- `after`: an integer ≥ 0; `seq` as today; `settings` as today; any other key is `400`.

#### D15. Two formats during the switch

The server accepts formats 2 and 3 from PR 6 until PR 13 ([Q1](#q1-how-the-switch-reaches-production)), so the deployed client and server never disagree.

- PR 6: `SYNC_FORMAT_VERSION` = 3 and `SYNC_FORMAT_V2` = 2 in `sync-format.ts`; the format-2 types become `SyncRequestV2` and `SyncResponseV2`, and every client use of the old names and of `SYNC_FORMAT_VERSION` becomes the V2 one (a rename, nothing else). `POST` dispatches on `v`; `GET` with `part` answers format 2, with `after` format 3.
- PR 11: the client sends format 3 only.
- PR 13: format 2 leaves the server and `shared`: `400 invalid_body` for `v: 2`, for `part=` and for a `GET` without `after`; `SYNC_FORMAT_V2`, the V2 types, `learn-runtime.ts`, `learn-state.ts`, `learn-patch.ts`, `testing/year.ts`, `apply-batch.ts` and the format-2 statements of `db/sync.ts` are deleted. User creation still fills the learning columns until PR 14.

### 3.3 The client

#### D16. IndexedDB schema 6

- `SCHEMA_VERSION` = 6 (PR 8). Stores at the switch (PR 11): `settings`, `log`, `outbox`, `meta`. PRs 8–10 keep `delta` and `snapshot` for the code that still reads them; PR 11 drops them from `STORES` without raising the version again, because no build between PR 8 and PR 11 reaches `main` ([D21](#d21-the-integration-branch)).
- `Db` gains `getAll(store: string): Promise<readonly unknown[]>` (values in key order) in `idb.ts` and `memory-db.ts`.
- **Store `log`**, values are `LogPage`s:

  | Key                | Contents                                                                 |
  | ------------------ | ------------------------------------------------------------------------ |
  | `own:open`         | this device's open page, fewer than `LOG_PAGE_EVENTS` events             |
  | `own:000000000001` | a closed own page, keyed by its `n0` in 12 digits (n0 = 1, 501, 1001, …) |
  | `row:000000000042` | a pulled server row, keyed by its id in 12 digits, stored as received    |

- **`meta`:** `log` = `LogMeta` `{ dev: string; next: number; lastAt: number }` (the log device id, the next `n`, the last own `at`); `sentN` (the highest own `n` acknowledged, 0 at first); `pulledId` (the highest row id walked, 0 at first). Kept: `deviceId`, `userId`, `lastSeq`, `schemaVersion`, `syncBlockedAtVersion`, `sessionExpired`, `settingsSyncedAt`, `profile`, `pendingSignIn`, `keyIntervals`. Removed: `snapshotVersion`.
- **Append** (`entities/learn/model/log.ts`, `appendEvents(db, drafts, newId): Promise<readonly LogEvent[]>`): one `update` transaction reads `meta/log` and `log/own:open`. A missing `LogMeta` is created as `{ dev: newId(), next: 1, lastAt: 0 }`. Each draft gets `n = next++` and `at = max(draft.at, lastAt)`; it joins the open page; a page that reaches `LOG_PAGE_EVENTS` is written under `own:<n0>` and the open page starts empty. The stored events are returned. Reason for identity in the transaction: two tabs of one device share `dev`, and IndexedDB serializes their transactions.
- **Read** (`readLog(db)`): `getAll('log')`, `decodePage` per record (a record that fails is skipped, as for any invalid stored value), then the fold drops repeated keys.
- **Unsent** own events: `n > sentN`; their pages are found from `sentN` and `LogMeta.next` by key.
- **Clear:** the log store and `meta` keys `log`, `sentN`, `pulledId`. A new `dev` comes with the next append. Reason: a new log is a new device for `(dev, n)`.
- **Channel `nekotype:learn`** carries `LearnMessage = { kind: 'append'; page: LogPage } | { kind: 'pull' } | { kind: 'reset' }` (`shared/lib/idb/channel.ts` gains a typed channel with a guard; `nekotype:settings` keeps its string messages).

#### D17. The learn store

`entities/learn` after the switch (PR 11) exports, beside the answer-time helpers it keeps:

```ts
export type LearnStatus = 'loading' | 'ready' | 'error';
/** Screen data; null until ready. */
export const learnView: ReadonlySignal<LearnView | null>;
/** The live fold state for the planner, read at each task; null until ready. */
export function modelState(): ModelState | null;
export const learnStatus: ReadonlySignal<LearnStatus>;
export const learnReady: ReadonlySignal<boolean>;
/** Binds `settings.learn.targetMs` and loads the log and the model; `/` and `/stats` call it. */
export function initLearn(targetMs: () => number): Promise<void>;
export function retryLearn(): Promise<void>;
export function startSession(): void; // a `start` event with the device's offset
export function endSession(): void; // an `end` event
export function introduce(key: LearnKanaKey): void;
export function recordAnswer(input: AnswerInput): void;
/** "Reset progress" (guests): clears the log. */
export function resetLearning(): Promise<void>;
/** Reads the log again and folds it: the sync engine calls it after a pull. */
export function reloadLearning(): Promise<void>;
/** Waits for the writes in progress. */
export function flushLearning(): Promise<void>;

export type AnswerInput = {
  readonly task: TaskKind;
  readonly key: LearnKanaKey;
  readonly ok: boolean;
  /** Recall: the keys of the answer; the time is `recallAnswerTime` with K (A37), capped at 10,000. */
  readonly keystrokes?: readonly Keystroke[];
  /** Other tasks: showing the task → the answer, ms. */
  readonly ms?: number;
  readonly hint: boolean;
  readonly wrong: LearnKanaKey | null;
  readonly alt: LearnKanaKey | null;
};
```

- **The model is a lazy chunk.** `initLearn` reads the log and `import('@nekotype/model')` in parallel; the status is `ready` when both are done. `entities/learn` imports only types from `@nekotype/model` statically. Reason: the initial JS stays where it is while later phases grow the model.
- **No action is called from a key handler of a task** (D18). An action builds a draft with a provisional identity from the store's copy of `LogMeta` (`initLearn` creates `LogMeta` when it is missing), applies it to the fold at once (`apply`; on `out-of-order` the store folds its whole log again), sets `learnView` from `describe(snapshot)`, and queues the append (`scheduler.setTimeout(…, 0)`, one write for a burst). When the stored event differs from the draft (another tab took the same `n` or a later `at`), the store folds again.
- **Re-fold triggers:** load, `reloadLearning`, a `pull` message, an event out of order, a changed `targetMs` (grades are folded with the current target: a new target reinterprets the history, as point 4 says).
- **Other tabs:** `append` → apply the page's events; `pull` → `reloadLearning`; `reset` → empty.
- **Failures** as today: a read failure is `error` and nothing is written; a failed write keeps its drafts for the next write and switches the storage notice on.

#### D18. The session

`pages/learn/model/session.ts` on the planner.

- `start()`: `startSession()`, then the first task. A task is `nextTask(modelState(), { now, track, previous, rng })`; the session ends after `SESSION_TASKS` tasks or at null, with `endSession()`, `requestSync()` and the summary. Leaving early writes no `end`. `mode`, `queue`, `REVIEW_TASKS`, `task-choice.ts` and `review-queue.ts` go.
- **Recording is deferred.** The handler that finishes a task (the last accepted key of a recall or an introduction, a recognition choice) finishes the view (`port.finish`, the hold timer, the sound) and schedules the record with `scheduler.setTimeout(…, 0)`. The callback works out `wrong` and calls `introduce` or `recordAnswer`. Reason: a task's key handler does no fold, grade, lookup or IndexedDB call; the next task comes 400 ms later, after the callback.
- **The planner runs when a task is shown**, as task choice does today: from the hold timer, from Enter, Space or a click after a wrong recognition choice, and from `start()` (the click or Enter of `continue`), which also calls `startSession()`. Never from a key of a recall or an introduction.
- **`wrong` of a recall:** the accepted prefix plus the first rejected key, when it is exactly one spelling of exactly one kana of the task's track in the session's strictness (`spellingsFor`), is that kana; otherwise null; Esc alone gives null. Example: し, typed `s` then `u` → す; か, typed `g` → null; ぢ in relaxed with `ji` → two kana, null. The spelling map is built once per track and strictness.
- **Recognition:** `ms` is showing → choice; `wrong` is the chosen kana when wrong. Options come from `recognitionOptions` with the first distractor from `KanaView.confusions` (A-rule of [Learning](docs/spec/learning.md#recognition-options)) and "unlocked first" read as "introduced first".
- The session keeps `learnView` at its start for the summary, and the keys it introduced.

#### D19. Screens

The smallest change of ADR 100 point 9, with the answers of [Q2](#q2-a-design-pull-request)–[Q4](#q4-copy):

- **`/`:** one primary `continue`; `review (N)` goes. The progress line: `mastered {done} of {total}` (selected track) · `streak: N days` · `due: {n}`, where `n` counts due kana of both tracks and the `due` part is hidden at 0. The session line is `learning · 7 of 30`; a session that ends early shows its summary. The first-visit line stays.
- **Chart:** states locked, learning, learned, mastered from `KanaView.state`; the due mark on learned and mastered kana that are due; "opens next" from `opensNext`. Tooltip and details: the median and accuracy of the last 10 recall answers ("n of 10"), for learned and mastered `review due` or `next review: {date of nextReviewAt}`; details add the confusions (most first) and the recognition accuracy. `KanaChart` takes `learned` for `confident` (class `is-st-learned`, the same fill).
- **Summary:** `introduced` (kana introduced in the session), `learned` (kana whose state was locked or learning at the start and learned or mastered at the end), `faster`/`slower` (unchanged rule, from `KanaView.recall`), `confused` (unchanged). Kana of both tracks.
- **`/stats`:** unchanged blocks, from `LogStats` and `LearnView.mastered`: the activity fill is the day's recall answers of both tracks; a day with answers and no recall is drawn at the first step; the answer-time bar runs from the ⌈n/4⌉-th to the ⌈3n/4⌉-th shortest exact time with a tick at the exact median (A42 superseded); weeks are joined over 45 days; nothing older than a year is dropped.
- **Strings** (en / ru, parity kept): added `learn.due` `due: {n}` / `к повторению: {n}`, `learn.chart.state.learned` `learned` / `выучена`, `learn.summary.introduced` `introduced` / `новые`, `learn.summary.learned` `learned` / `выучены`; changed `settings.learn.targetHint` `Answers slower than the target count as harder, so their reviews come sooner.` / `Ответы медленнее цели считаются более трудными, и их повторения приходят раньше.`; removed `learn.review`, `learn.session.review`, `learn.chart.state.confident`, `learn.chart.notIntroduced`, `learn.summary.unlocked`, `learn.summary.confident`.
- `docs/design/README.md` gets one note: the P7 code calls the `confident` state `learned`, has no `review (N)` and shows `due: N` in the progress line, until the P8 export.

#### D20. The sync engine

`features/sync` on format 3 (PR 11). Triggers, the Web Lock, the 10-second spacing, the failed-request table and the session flows stay as [Storage and sync](docs/spec/storage-sync.md#batches) has them.

- `lib/build-batch.ts`: `buildBatch({ deviceId, seq, after, unsent, settings }, maxBytes): Batch | null`, `Batch = { request: SyncRequest; lastN: number | null }`: the longest prefix of the unsent own events whose request fits `maxBytes` (256 KB, or 60 KB for `keepalive`), found by halving; null when there is nothing to send.
- **Acknowledgement** (one transaction): `outbox` deleted, `lastSeq`, `sentN` = the batch's last `n`, the settings rule of [Storage and sync](docs/spec/storage-sync.md#local-storage-d18) ("Settings travel"). Then a pull when `more`, and a catch-up batch 5 seconds later when own events are still unsent.
- `lib/pull.ts`: pages of `GET ?after=` until `more` is false; each page in one transaction: the rows as `row:` records, `pulledId` = `last`, the settings rule; then `reloadLearning()` and a `pull` message. Start and reconnect with nothing to send pull.
- **Unsent data** (status, sign-out dialog): `outbox` holds a batch, or `LogMeta.next − 1 > sentN`.
- **Guest merge:** `userId`, a new `deviceId`, `lastSeq` 0, `pulledId` 0, `profile`; the log and `sentN` (0) stay, so the first syncs upload the guest's events.
- **Sign-out, another account discarded, account deletion:** `settings`, `log`, `outbox` and the user keys of `meta` cleared (`log`, `sentN` and `pulledId` among them); `schemaVersion` and `keyIntervals` stay.
- A pulled page that fails `isPullResponse` (`shared/runtime`) is a `400`-like failure: the engine blocks until `appVersion` changes, as for a rejected batch.

### 3.4 How the switch reaches production

#### D21. The integration branch

[Q1](#q1-how-the-switch-reaches-production): the client switches in one deployment.

- The executor of PR 8 creates `p7-switch` from `origin/main` once PRs 2, 4 and 6 are merged, and opens PR 8 with `--base p7-switch`. PRs 9–11 are cut from `origin/p7-switch` and target it. CI runs on them (the workflow has no branch filter) and each gets a preview.
- If `origin/main` has commits that `p7-switch` lacks, the executor merges `origin/main` into their own branch first (a merge commit; the squash flattens it).
- The maintainer squash-merges PRs 8–11 into `p7-switch`. Each of them leaves CI green, but only PR 11 has to leave the application whole: between PR 9 and PR 11 `/stats` and the sync still run on the old store, which no longer receives answers.
- PR 12 is the pull request `p7-switch` → `main`, squash-merged by the maintainer after [M2](#m2-production-check-of-pr-6--before-pr-12).
- Old exports that PRs 9 and 10 still need from the old store are renamed with the prefix `legacy` (`legacyInitLearn`, `legacyLearnState`, `legacyLearnCounters`, `legacyLearnStatus`, `legacyResetLearning`); PR 11 deletes the last of them.

### 3.5 Budgets and measurements

#### D22. Budgets

- The limits of [Quality](docs/spec/quality.md#budgets) are not raised.
- The baseline is today's build: initial JS 31.17 KB, initial CSS 7.70 KB. Every pull request into `main`, and PR 11 as the last into `p7-switch`, stays at or below both. PRs 8–10 report their figures; one that is more than 0.5 KB above names the code PR 11 removes to get back under, or stops.
- `@nekotype/model` is never in the initial chunk: `check-budget.mjs` gains `MODEL_ENTRY` (the chunk whose source is `packages/model/src/index.ts`) with the checks of `SYNC_ENTRY` (PR 9). The model's lazy chunk is at most 25 KB like any lazy chunk; the session runtime chunk is at most 10.10 KB (it loses task choice; the planner is in the model's chunk).
- The hot-path rules hold: 0 renders per recall keystroke and at most 1 on the finished answer (`session-screen.test.tsx`), no IndexedDB write and no model call in a task's key handler (D18).

#### D23. The model's cost in the browser

- `@nekotype/model/testing` exports `syntheticLog({ answers, seed }): readonly LogEvent[]`: the production planner played with a seeded learner (correct with probability 0.9 on reviews and 0.8 otherwise, recall in 1,200 ms when correct and 2,500 ms when wrong, two sittings of 5 minutes a day at 8:00 and 20:00, `tz` 0), selected track hiragana until the 46 basic hiragana are learned, katakana until 80 katakana are introduced, then hiragana, stopped at `answers` answers. With 40,000 answers it holds both tracks and a katakana row still to come.
- `apps/web/src/app/model-probe.ts`, loaded by a dynamic import from `app/main.tsx` only when `__LATENCY_PROBE__` (so the production build drops it), sets `window.__nekotypeModelCost(events, runs)`: it times `foldLog` (stats on, target 1500) and `forecastRow` for `nextRow(state, 'katakana')` with `track: 'hiragana'` and `habitsOf(state)`, returning both lists in ms. In the synthetic state every hiragana is introduced and katakana is held back by the lag rule, so the plays run long: the measured forecast is near the slowest case, not a typical one.
- `apps/web/e2e/model-cost.spec.ts` runs in `playwright.latency.config.ts` (its `testMatch` takes both files) with 4× CPU throttling through CDP: one warm-up, then 5 runs each. Pass: the median fold ≤ 100 ms and the median forecast ≤ 200 ms; all runs are printed. `LATENCY_PATHS` gains `packages/model/` and the new files, so the gate runs it on pull requests that change the model.
- `pnpm --filter @nekotype/model run cost` prints the same timings in Node, for information.

#### D24. CPU on Cloudflare

`apps/bench` measures format 3 on `nekotype-bench` ([M1](#m1-test-project-for-the-cpu-measurement--before-pr-7)): the seed writes a user, a session, settings and a year of rows (`syntheticLog({ answers: 40_000, seed: 1 })` cut into 700 pages); the requests are a session batch (one session of 30 tasks with its start and end), a 256 KB batch (as many events as fit), a settings-only batch, and the first `GET` page of a new device. Pass ([ADR 086](docs/adr/086-sync-endpoint-cpu-line.md)): a warm median `cpuTime` ≤ 12 ms for the 256 KB batch and ≤ 8 ms for the session and settings batches, no error 1102, every outcome `ok`, `rows_written` ≤ 3 for each `POST`. The `GET` page is recorded, not gated.

### 3.6 Documents and decision records

- ADRs, each with the next free number when its pull request is opened (today the last is 100): **101** in PR 1 (the model package: D1, D3, D4); **102** in PR 6 (sync format 3: D11–D15, with ADR 086's status line amended for D14); **103** in PR 8 (the log on the client: D16, D17, the lazy model chunk, deferred recording); **104** in PR 9 (the screens of P7: D19 and the answers of Q2–Q4).
- No A-item is added: A47–A52 cover the model; the ADRs above are implementation.
- `docs/architecture/` changes with the code: `model.md` is new (PR 1, extended in PRs 2–5); `entities.md` and `pages.md` in PRs 9 and 10; `sync.md` in PRs 6, 11 and 13; the index in PR 1.
- `AGENTS.md`: PR 1 adds `packages/model` to the project paragraph and one line to "Architecture rules" (the model is pure like the engine); PR 15 marks P7 done.
- `docs/README.md` gets a row for this plan in this pull request; PR 15 removes it.

### 3.7 Spec changes

| #   | Change                                                                                                                                                                                                                                                             | Spec file                 | In PR  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------ |
| S1  | The monorepo layout and dependency rules gain `packages/model`                                                                                                                                                                                                     | `architecture.md`         | 1      |
| S2  | Backend: format 3 next to format 2 (bodies, `POST` and `GET ?after=`, "Applying a batch", rows and statements per sync, the CPU section), the table `sync_batches`, the free-tier rows                                                                             | `backend.md`              | 6      |
| S3  | Local storage: schema 6, the store `log` and its keys, `meta` keys, append and identity, two tabs; the local view is the fold                                                                                                                                      | `storage-sync.md`         | 8      |
| S4  | Learning: tracks (reviews of both, the katakana suggestion as a model value), introduction by the planner instead of unlocking, one session kind of 30 tasks, look-ahead reviews, memory and phases instead of boxes, `/`, summary, constants, grades by task type | `learning.md`             | 9      |
| S5  | Metrics: answers of every task type in the log, grades instead of confidence, the recognition time recorded, the data model as events and the fold; decay goes                                                                                                     | `metrics.md`              | 9      |
| S6  | Frontend: the slices (`entities/learn` as log and view, `pages/learn` on the planner), `/` with `continue` and `due`, deferred recording in "Hot path"                                                                                                             | `frontend.md`             | 9      |
| S7  | Latency measurement: two sessions of 30 tasks on a seeded log                                                                                                                                                                                                      | `quality.md`              | 9      |
| S8  | `/stats` from the log: exact medians and quartiles, activity from `days`, no year limit                                                                                                                                                                            | `metrics.md`              | 10     |
| S9  | Batches of format 3, the pull, sync triggers, unsent data, guest merge, sign-out, reset and account deletion on the log; merge rules removed                                                                                                                       | `storage-sync.md`         | 11     |
| S10 | Format 2 removed; the D1 schema without the learning columns                                                                                                                                                                                                       | `backend.md`              | 13, 14 |
| S11 | Budget rows for the model's cost (fold ≤ 100 ms, forecast ≤ 200 ms, Chromium 4×), checked by `model-cost.spec.ts`                                                                                                                                                  | `quality.md`              | 5      |
| S12 | The "Closed" line of P7; the "End of P7" budget column                                                                                                                                                                                                             | `phases.md`, `quality.md` | 15     |

## 4. Answered questions

### Q1. How the switch reaches production

**Question.** The client switch (log storage, the session on the planner, the screens, `/stats`, format 3) is about 4,000 lines. Split into pull requests straight to `main`, it leaves a window in which learning does not sync, and the last of them would change the format of `outbox` without the schema reset of ADR 061. Options: an integration branch; pull requests to `main` with that window; one large pull request.

**Answer (2026-11-22):** the integration branch. The server first accepts formats 2 and 3 (PR 6); the client is built as PRs 8–11 into `p7-switch`, each with CI and a preview, and PR 12 deploys them at once with one schema reset; then format 2 leaves the server (PR 13) and the learning columns are dropped (PR 14). See [D15](#d15-two-formats-during-the-switch) and [D21](#d21-the-integration-branch).

### Q2. A design pull request

**Question.** ADR 100 point 9 renames `confident` to `learned`, removes `review (N)` and keeps the due count as text, while the design export still draws the old ones. A design session and an export first, or not?

**Answer (2026-11-22):** no design pull request. The code and the spec follow ADR 100 and these answers; the export catches up in the design session of P8, which redraws the home, "Progress" and the summary anyway. `docs/design/README.md` notes the difference ([D19](#d19-screens)).

### Q3. Where the due count is shown

**Question.** Where does the number of due kana go when `review (N)` leaves, and does it count both tracks?

**Answer (2026-11-22):** in the progress line, `mastered 7 of 104 · streak: 6 days · due: 5` / `освоено 7 из 104 · серия: 6 дней · к повторению: 5`, counting the due kana of both tracks, which is what `continue` reviews; the `due` part is hidden at 0.

### Q4. Copy

**Question.** The changed strings: the state `learned` / `выучена`; the summary sections `introduced` / `новые` and `learned` / `выучены`; the target hint `Answers slower than the target count as harder, so their reviews come sooner.` / `Ответы медленнее цели считаются более трудными, и их повторения приходят раньше.`

**Answer (2026-11-22):** accepted as written ([D19](#d19-screens)).

## 5. Maintainer's manual steps

D1 migrations need no manual command: CI applies them to `nekotype-preview` before a preview deploy and to `nekotype` before the production deploy. The steps below are the checks and the test project. Commands run from the repository root after `pnpm exec wrangler login` (the root `wrangler.toml` has the binding `DB`; the forms are those of the P5 and P6 plans).

### M1. Test project for the CPU measurement — before PR 7

As M1 of the [P5 plan](docs/archive/p5-plan.md): `pnpm dlx wrangler@4 pages project create nekotype-bench --production-branch=main --force` (the flag keeps it a Pages project when run from an agent's session) and `pnpm dlx wrangler@4 d1 create nekotype-bench`. Give the `database_id` to the executor of PR 7, who writes it into `apps/bench/wrangler.toml`. The executor may run the measurement itself when the maintainer allows it ([apps/bench/README.md](apps/bench/README.md)). Check: `pnpm dlx wrangler@4 pages project list` and `pnpm dlx wrangler@4 d1 list` show `nekotype-bench`.

### M2. Production check of PR 6 — before PR 12

After PR 6 is deployed:

1. `pnpm exec wrangler d1 migrations list DB --env production --remote` shows no unapplied migration.
2. `pnpm exec wrangler d1 execute nekotype --remote --command "SELECT name FROM sqlite_master WHERE name = 'sync_batches'"` returns one row.
3. On `https://nekotype.pages.dev`, signed in, a learning session ends with `synced` in `/settings` (the client still sends format 2).
4. Write "done" with the date under PR 6 in section 6.

### M3. Production check of the switch — after PR 12, before PR 13

Merging PR 12 accepts the reset of ADR 100 point 8: the local data of every device and the learning progress on the server start over. After the deploy:

1. The first load starts as a guest with default settings; `continue` starts a session of 30 tasks with the vowels; the chart shows learning kana.
2. Sign in; after a session `/settings` shows `synced`.
3. A second browser profile signs in to the same account: the chart and `/stats` show the same kana and sessions.
4. Offline in one profile (DevTools), a session, online again: the other profile shows it after its next start.
5. Write "done" with the date under PR 12.

### M4. After PR 13 is deployed — before PR 14

A session still ends with `synced`; `pnpm exec wrangler d1 migrations list DB --env production --remote` shows nothing unapplied. Write "done" under PR 13.

### M5. After PR 14 is deployed — before PR 15

`pnpm exec wrangler d1 execute nekotype --remote --command "SELECT name FROM pragma_table_info('user_stats')"` lists `user_id`, `device_seq`, `last_sync_at`, `version` only, and a session still ends with `synced`. The executor of PR 15 may run these read-only commands when the maintainer allows it.

### M6. Delete the test project — after PR 7 is accepted

`pnpm dlx wrangler@4 d1 delete nekotype-bench` and `pnpm dlx wrangler@4 pages project delete nekotype-bench`; as in P5, Cloudflare refuses to delete a project with many deployments until they are deleted (`wrangler pages deployment delete`, all but the active one). PR 15 notes it.

## 6. Pull requests

Common to all: the branch is cut from fresh `main` (PRs 8–11 from `p7-switch`, [D21](#d21-the-integration-branch)); the acceptance items are those of ADR 100 point 10, numbered in the [table at the end](#acceptance-items-and-pull-requests); sizes are changed lines with tests, a guide to what one executor session holds (moves and deletions are cheap).

| PR  | Depends on  | Can run in parallel with |
| --- | ----------- | ------------------------ |
| 1   | —           | —                        |
| 2   | 1           | 6                        |
| 3   | 2           | 4, 6, 7                  |
| 4   | 2           | 3, 6, 7                  |
| 5   | 3, 4        | 6, 7, 8                  |
| 6   | 1           | 2–5                      |
| 7   | 6, M1       | 2–5, 8–11                |
| 8   | 2, 4, 6     | 3, 5, 7                  |
| 9   | 3, 8        | 5, 7                     |
| 10  | 9           | 7                        |
| 11  | 9, 10       | 7                        |
| 12  | 11, M2      | —                        |
| 13  | 12, M3      | —                        |
| 14  | 13, M4      | —                        |
| 15  | all, M5, M6 | —                        |

Sign-in is hidden on previews: what needs a session is checked locally (`pnpm run dev` with `pnpm run dev:api`) and, after PR 12, by the maintainer on production.

### PR 1 — The model package, FSRS-6, items and grades

- **Branch:** `p7-01-model-package`. **Base:** `main`. **Depends on:** nothing.
- **Goal.** `packages/model` with FSRS-6 moved from the sim, the items, the event types and the grade table (D1–D4, D9).
- **Creates:** `packages/model/` (`package.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `README.md`, `src/index.ts`, `src/constants.ts`, `src/fsrs.ts`, `src/items.ts`, `src/grade.ts`, their tests, `src/testing/index.ts`, `src/testing/events.ts`).
- **Changes:** `packages/shared/src/types.ts` (D2); `packages/sim` (FSRS-6 from `@nekotype/model`, `fsrs7.test.ts` keeps the FSRS-7 checks, `package.json`); `pnpm-lock.yaml`.
- **Deletes:** `packages/sim/src/fsrs.ts`, `packages/sim/src/fsrs.test.ts` (moved).
- **Tests:** FSRS-6 against `FSRS6Algorithm` of ts-fsrs 6.0.0 on the two histories of `fsrs7.test.ts` (stability, difficulty, recall to 6 digits), and `intervalFactor` against `intervalFor`; items: 104 and 125 kana, 46 basic each, が → か, きゃ → き, や, ヴァ → ヴ, ア, ヴ → ウ, every katakana with a hiragana has it as `pair`; `kanaOfReading('きょうと')` gives きょ, う, と; grades: one test per row of D4 for correct and wrong, the time boundary (`ms` = target is good, target + 1 hard), a hint makes it hard, credit only to learned parts, contrast −1, fluency slow has no effect, a wrong word has none.
- **Acceptance:** 1 (lint rules and tsconfig), 2, 9 (the table).
- **Docs:** ADR 101; S1; `docs/architecture/model.md` and the index; `packages/sim/README.md`; `README.md` (the packages); `AGENTS.md` ([section 3.6](#36-documents-and-decision-records)).
- **Preview URL:** nothing changes.
- **Done when:** `pnpm --filter @nekotype/model test` passes with the coverage thresholds of D1; `PART=planner pnpm --filter @nekotype/sim run part5` prints the column "A4, FSRS-6" as part 5 has it (reference `7 / 94.4% / 8.3`), so the move changed nothing; `verify:quick` passes; initial JS 31.17 KB and CSS 7.70 KB unchanged.
- **Size:** about 900 lines (130 moved).

### PR 2 — The fold

- **Branch:** `p7-02-fold`. **Base:** `main`. **Depends on:** PR 1.
- **Goal.** The state as a fold of the log (D5), with its order, identity and learner values (D6's `learner.ts`).
- **Creates:** `src/order.ts`, `src/learner.ts`, `src/fold.ts`, `fold.test.ts`, `fold.properties.test.ts`.
- **Tests:** introduction (memory of "again", learning); an answer before its introduction introduces; a second introduction is ignored; streak (recall + 1, recognition keeps, error 0); learned at 5, and at 5 + round(2p) under pressure; a lapse; `observed` moves on reviews only and starts at 0.90; gaps over an hour (the last 10), sittings and task intervals; `localDay` with `tz` so that the same-day formula follows the local midnight, not UTC; negative elapsed time as 0; credit and pair reviews only on learned kana; confusion counts never below 0; `apply` returns `duplicate` and `out-of-order`; `foldLog` equals applying the sorted events; `snapshot` does not change after a later `apply`; `clone` is independent. Property tests (seeded, 200 logs of 2–3 devices): any order of delivery with duplicates gives the same snapshot; two devices exchanging batches with 30% failed syncs, then a final exchange, equal one fold of every event; incremental apply equals `foldLog`.
- **Acceptance:** 8; 9 (each row through the fold).
- **Docs:** `docs/architecture/model.md` (the fold).
- **Preview URL:** nothing changes.
- **Done when:** the tests pass with the coverage thresholds; `verify:quick` passes.
- **Size:** about 1,300 lines.

### PR 3 — The planner and the sim on the production model

- **Branch:** `p7-03-planner-sim`. **Base:** `main`. **Depends on:** PR 2.
- **Goal.** A4 in `planner.ts` (D6) and `packages/sim` running it (D10).
- **Creates:** `packages/model/src/planner.ts` and its test; `packages/sim/src/policies/production.ts` and its test, `src/options.ts`, `src/p7.ts`; the script `p7`.
- **Changes:** `policies/fsrs-planner.ts` takes its options from `options.ts`; `packages/sim/README.md`.
- **Tests:** the order due → ready → introduction → other learning; due by look-ahead with the 12-hour default and with a median of gaps; due order; steps 30 s, 1, 2, 4, 8 min; `previous` left out, and taken when nothing else is left; recognition 25% ± 2% of 10,000 learning picks with a seeded `Rng`; at most 4 learning, 1 at full pressure; が waits for か to be learned, きゃ for き and や; the other track only when it has a kana and lags by more than 10; null when nothing is left; reviews are recall; `dueFrom` against `retrievability` (recall at `dueFrom + h` equals `r` to 1e-9). The adapter maps every id to its key; two seeds of seven days run.
- **Acceptance:** 3, 4, 5, 6, 7.
- **Docs:** `docs/architecture/model.md` (the planner).
- **Preview URL:** nothing changes.
- **Done when:** `PART=main pnpm --filter @nekotype/sim run p7`: the beginner reads the 46 basic hiragana by day 8 or earlier (median), review retention ≥ 90.0%, ≤ 10.0 minutes a day over days 1–14. `PART=planner pnpm --filter @nekotype/sim run p7`: review retention of `recallGain ×0.5` 87.6–91.6%, `gainExponent ×1.5` 84.7–88.7%, `lapseKeep ×0.5` 91.9–95.9% (part 3: 89.6, 86.7, 93.9). Both tables in the pull request description; `verify:quick` passes. A number outside these ranges stops the pull request ([section 7](#7-instructions-for-executor-agents), rule 3b).
- **Size:** about 1,200 lines.

### PR 4 — Statistics and the learn view

- **Branch:** `p7-04-stats-view`. **Base:** `main`. **Depends on:** PR 2.
- **Goal.** `LogStats` in the fold, `describe` and `strongerSince` (D7, D8).
- **Creates:** `src/stats.ts`, `src/view.ts`, `src/stronger.ts` and tests; the property tests of PR 2 cover the statistics.
- **Tests:** the last 10 recall answers; the median of an even count; accuracy; recognition counts; confusions highest first; days by local day with `tz`; started and finished; chart states with stability 20.99 learned and 21.0 mastered; `dueFrom` and `nextReviewAt` for a known memory; `opensNext` with dependencies; `suggestKatakana` false at 45 learned basic hiragana and true at 46; `strongerSince` for a state that rose and for a doubled stability.
- **Acceptance:** 8 (statistics converge too).
- **Docs:** `docs/architecture/model.md`.
- **Preview URL:** nothing changes.
- **Done when:** the tests pass with the coverage thresholds; `verify:quick` passes.
- **Size:** about 900 lines.

### PR 5 — Forecast, outline and the model's cost

- **Branch:** `p7-05-forecast-cost`. **Base:** `main`. **Depends on:** PRs 3 and 4.
- **Goal.** D8's forecast and outline, the sim's measurement of the forecast, and D23's cost in Chromium.
- **Creates:** `packages/model/src/forecast.ts` and its test, `src/testing/synthetic-log.ts`, `scripts/cost.ts`; `apps/web/src/app/model-probe.ts`, `apps/web/e2e/model-cost.spec.ts`.
- **Changes:** `packages/sim` (`p7.ts`, `PART=forecast` and `cost`); `apps/web/playwright.latency.config.ts` (`testMatch`), `apps/web/playwright.config.ts` (ignores the new file), `apps/web/scripts/latency-gate.mjs` and its test (`LATENCY_PATHS`).
- **Tests:** low ≤ median ≤ high; the same seed gives the same forecast; ratio 1 with fewer than 3 settled forecasts, and the median ratio with more; 61 when a play never reaches the row; `nextRow` null when every kana is introduced; outline counts on a fixed state; `habitsOf` defaults.
- **Acceptance:** 13, 14, 16.
- **Docs:** S11; `docs/architecture/model.md`; `packages/sim/README.md`.
- **Preview URL:** nothing changes (the probe is only in the test build).
- **Done when:** `PART=forecast pnpm --filter @nekotype/sim run p7`: the reference learner's next row has a median absolute error ≤ 1 session; `cd apps/web && pnpm exec playwright test e2e/model-cost.spec.ts -c playwright.latency.config.ts`: median fold ≤ 100 ms and median forecast ≤ 200 ms at 4×, five runs each printed in the description; the CI latency job is green; budgets unchanged.
- **Size:** about 1,200 lines.

### PR 6 — Sync format 3 on the server

- **Branch:** `p7-06-sync-format-3-server`. **Base:** `main`. **Depends on:** PR 1.
- **Goal.** The codec, the schemas and the API of format 3, next to format 2 (D11–D15).
- **Creates:** `packages/shared/src/log-codec.ts` and its test; `apps/api/migrations/0004_sync_batches.sql`; `apps/api/src/db/batches.ts`; `apps/api/src/sync/apply-log.ts`; tests.
- **Changes:** `packages/shared` (`types.ts`, `schemas.ts`, `sync-format.ts`, `runtime.ts`: D12, D14, D15); `apps/api/src/routes/sync.ts` (dispatch on `v`; `GET` with `after`); `apps/api/src/migrations.test.ts`; the client's uses of the renamed format-2 names (D15).
- **Tests:** codec round trip, every bound, a decreasing `at` rejected; API on local D1: a format-3 batch of 256 KB with settings writes at most 3 rows (`meta.rows_written` through the counting wrapper) in at most 5 statements, at most 9 with one lost `version`; `seq` ≤ last writes nothing; a gap is `409`; `429`; a resent batch adds no row; `more` with and without another device; pages: own rows skipped, the byte limit, `last`, `more`, settings; ids per user increase with two users interleaved; account deletion removes the user's rows; format 2 passes its existing suite; `v: 4`, an invalid page and an unknown key are `400`; 257 KB is `413`.
- **Acceptance:** 10.
- **Docs:** ADR 102 (and ADR 086's status line); S2; `docs/architecture/sync.md` (the server).
- **Preview URL:** nothing changes; the CI step "Apply D1 migrations (preview)" passes.
- **Done when:** `verify:quick` passes and CI is green; after the merge the maintainer does M2.
- **Size:** about 1,500 lines.

### PR 7 — CPU of format 3 on Cloudflare

- **Branch:** `p7-07-sync-bench`. **Base:** `main`. **Depends on:** PR 6, M1.
- **Goal.** D24's measurement and its note.
- **Changes:** `apps/bench` (`wrangler.toml` with the new `database_id`, `scripts/seed.ts`, `scripts/batches.ts`, `scripts/measure.ts`, `README.md`).
- **Creates:** `docs/research/2026-11-NN-p7-sync-endpoint.md` (the day of the run) and its row in `docs/README.md`.
- **Acceptance:** 10 (on Cloudflare), 11.
- **Preview URL:** nothing changes.
- **Done when:** the note's table meets D24's pass line and the run's JSON summary is in it; `verify:quick` passes. Over the line: stop and report the numbers; the candidates are a smaller batch cap or fewer statements, chosen by the maintainer in an ADR.
- **Size:** about 500 lines.

### PR 8 — The log in IndexedDB

- **Branch:** `p7-08-log-store`. **Base:** `p7-switch` (created by this executor, D21). **Depends on:** PRs 2, 4, 6.
- **Goal.** Schema 6 with the store `log`, the log module and the new learn store, not yet used by any screen (D16, D17).
- **Creates:** `apps/web/src/entities/learn/model/log.ts`, `apps/web/src/entities/learn/model/learn-store.ts` and tests.
- **Changes:** `shared/lib/idb/idb.ts`, `memory-db.ts` (`getAll`), `schema.ts` (6, `log`), `local-sync.ts` (`LOG_STORE`), `channel.ts` (typed channel).
- **Tests:** `n` and `at` assigned in the transaction, two stores on one fake IndexedDB never share an `n`; `own:open` closes at 500 under `own:000000000001`; `readLog` skips a broken record and drops repeated events; a schema 5 database is reset to 6; the store: `ready` only after the log and the model chunk, an out-of-order event folds again, a new target folds again, an `append` message applies, `reset` empties, a failed write keeps its drafts and reports.
- **Docs:** ADR 103; S3; `docs/architecture/entities.md`.
- **Preview URL:** the app starts with empty data (schema 6) and behaves as before.
- **Done when:** `verify:quick` passes and CI is green on the pull request; budget figures in the description.
- **Size:** about 1,100 lines.

### PR 9 — Learning on the model

- **Branch:** `p7-09-learning-on-the-model`. **Base:** `p7-switch`. **Depends on:** PRs 3 and 8.
- **Goal.** `/`, the session and the summary on the log and the planner (D17–D19); the old store stays for `/stats` and sync under `legacy` names.
- **Changes:** `pages/learn` (`model/session.ts`, `ui/learn-page.tsx`, `ui/session-screen.tsx`, `ui/summary-panel.tsx`, `lib/summary.ts`, `lib/distractors.ts`, `lib/constants.ts`, `lib/chart.ts`, `session-loader.ts`); `entities/learn` (`index.ts`, `lib/chart.ts`, `lib/progress.ts`, `lib/tracks.ts`); `shared/ui` `KanaChart` (`learned`); `shared/i18n` (D19); `pages/settings` (reset calls `resetLearning` and `legacyResetLearning` until PR 11); `apps/web/scripts/check-budget.mjs` and its test (`MODEL_ENTRY`); `e2e/lib/app.ts` (`seedLog` writes `log` pages and `meta/log`), `e2e/lib/learn.ts` (`openRecall` seeds a learned, due あ and clicks `continue`), `learn-session.spec.ts`, `learn-chart.spec.ts`, `latency.spec.ts` (two sessions of 30 tasks on a seeded log), `input.spec.ts` where it calls `openRecall`; `docs/design/README.md` (the note of D19).
- **Deletes:** `pages/learn/lib/task-choice.ts`, `lib/review-queue.ts` and their tests.
- **Tests:** the session writes `start` and `end`, ends early at null, never records inside a key handler (with a fake scheduler, the store is untouched until timers run), `wrong` for し, か and ぢ, options from confusions; the render test still shows 0 and at most 1; `/`: `due` hidden at 0 and counting both tracks; chart states, tooltip and details; the summary rules.
- **Acceptance:** 15 (hot path and budgets).
- **Docs:** ADR 104; S4, S5, S6, S7; `docs/architecture/pages.md`, `entities.md`; `README.md` (how learning works).
- **Preview URL:** a fresh start, a session of 30 tasks by keyboard and by tap, learning kana on the chart, the summary with `introduced`; after an error the kana comes back within the session; `due` appears the next day; the session line says `of 30`.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; initial JS at most 0.5 KB over 31.17 KB (D22), the model in a lazy chunk, the session runtime ≤ 10.10 KB.
- **Size:** about 1,500 lines.

### PR 10 — `/stats` from the log

- **Branch:** `p7-10-stats-from-the-log`. **Base:** `p7-switch`. **Depends on:** PR 9.
- **Goal.** `/stats` reads `LogStats` and `LearnView` (D19).
- **Changes:** `pages/stats` (`ui/stats-page.tsx`, `ui/learning-section.tsx`, `ui/activity-map.tsx`, `lib/activity.ts`, `lib/answer-time.ts`, `lib/trend.ts`) and tests; `entities/learn` (streaks from `days`; `legacy` exports for `/stats` removed); `e2e/stats.spec.ts` (seeds a log).
- **Tests:** exact median and quartiles; weekly bars over 45 days; activity steps; a day with only recognition at the first step; the empty state; the streak.
- **Docs:** S8; `docs/architecture/pages.md`.
- **Preview URL:** `/stats` after a session shows the streak, the activity, the totals and the answer time.
- **Done when:** `verify:quick` passes; CI green; the `/stats` chunk at most 5.13 KB.
- **Size:** about 700 lines.

### PR 11 — Sync format 3 on the client

- **Branch:** `p7-11-sync-format-3-client`. **Base:** `p7-switch`. **Depends on:** PRs 9 and 10.
- **Goal.** The sync engine on the log (D20), and the old learning code gone from the client.
- **Changes:** `features/sync` (`model/engine.ts`, `model/account.ts`, `model/runtime.ts`, `model/status.ts`, `lib/build-batch.ts`, `lib/stored.ts`, `api/sync.ts`, new `lib/pull.ts`); `pages/settings` (reset); `app` (bootstrap); `shared/lib/idb` (`STORES` final, D16); `e2e/sync/*` and `e2e/lib/sync.ts`.
- **Creates:** `apps/web/e2e/sync/two-devices.spec.ts`: two contexts signed in to one account, one offline while both answer a session, both converge on the same chart states and session counts.
- **Deletes:** `entities/learn/model/store.ts` and every `legacy` export; `entities/learn/lib/boxes.ts`, `confidence.ts`, `state.ts`, `buckets.ts` and whatever else only the old store used; `features/sync/lib/apply-ack.ts`; `shared/lib/idb/local-sync.ts`'s `readWithSyncBase`; the client's imports of `learn-runtime`, `learn-state` and `learn-patch`.
- **Tests:** the batch is the longest prefix within 256 KB and 60 KB; the acknowledgement sets `sentN`; pulls loop until `more` is false; settings rule; catch-up 5 s later; `409` rewrites `seq`; a bad page blocks; sign-out names unsent events; the guest merge keeps the log; discard clears it; two engines against a fake server of D12 converge with failed requests.
- **Acceptance:** 12.
- **Docs:** S9; `docs/architecture/sync.md`, `entities.md`; `README.md` (what syncs).
- **Preview URL:** as PR 9; locally with `.dev.vars`: sign in, a session syncs, a second browser profile sees it.
- **Done when:** `verify:quick` passes; `pnpm run e2e:sync` passes (four files); CI green; initial JS ≤ 31.17 KB and CSS ≤ 7.70 KB.
- **Size:** about 1,500 lines written, about 2,500 deleted.

### PR 12 — The switch

- **Branch:** `p7-switch`. **Base:** `main`. **Depends on:** PR 11, M2.
- **Goal.** PRs 8–11 reach production in one deployment.
- **Does:** an executor opens it once PR 11 is merged into `p7-switch`, first merging `origin/main` into `p7-switch` if needed (keeping every Status row). Title: `feat(learn): learning on the knowledge model and sync format 3 (P7)`. The description lists PRs 8–11, the acceptance items they close, the budget figures and what M3 will check.
- **Done when:** CI is green with the browser, sync and latency jobs; the maintainer merges and does M3.

### PR 13 — Format 2 out of the server

- **Branch:** `p7-13-format-2-out`. **Base:** `main`. **Depends on:** PR 12, M3.
- **Goal.** Only format 3 is accepted (D15).
- **Deletes and changes:** as D15 lists; the API tests of format 2.
- **Tests:** `v: 2`, `part=rest` and a `GET` without `after` are `400 invalid_body`; the format-3 suite passes.
- **Docs:** S10 (format 2); `docs/architecture/sync.md`.
- **Done when:** `verify:quick` passes and CI is green; the maintainer does M4.
- **Size:** about 2,000 lines deleted, 150 written.

### PR 14 — Drop the learning columns

- **Branch:** `p7-14-drop-learning-columns`. **Base:** `main`. **Depends on:** PR 13, M4.
- **Creates:** `apps/api/migrations/0005_drop_learning_columns.sql` (D13).
- **Changes:** `apps/api/src/db/users.ts` (the insert without the columns); `migrations.test.ts`.
- **Tests:** after the migrations `user_stats` has the four columns of D13; a new user signs in and syncs; account deletion cascades.
- **Docs:** S10 (schema).
- **Done when:** CI is green with the preview migration; the maintainer does M5.
- **Size:** about 100 lines.

### PR 15 — Close the phase

- **Branch:** `p7-15-close`. **Base:** `main`. **Depends on:** every other pull request, M5, M6.
- **Does:**
  - the leftovers audit, with its command and result in the description: `git grep -n -i -E "confiden|leitner|\bbox(es)?\b|mergeLearn|splitLearnDelta|recallBuckets|learn_recent|snapshotVersion|review \("` over `apps`, `packages`, `scripts` and `docs/spec`, `docs/architecture`; each hit removed or explained (the research, the sim's research policies, migrations `0001`–`0003`);
  - `pnpm --filter @nekotype/sim run p7` (every part) on the final `main`, and the CI figures of the latency and model-cost tests of PR 12;
  - `docs/research/2026-11-NN-p7-acceptance.md` with every number of the acceptance table.
- **Docs:** S12; `AGENTS.md` (P7 done, P8 next); `README.md` and `docs/architecture/` reread against the code; `docs/adr/README.md` has ADRs 101–104; this file moved to `docs/archive/p7-plan.md` with a note on top; its row in `docs/README.md` removed.
- **Done when:** every row of the table below names a passing test or check in the description.
- **Size:** about 400 lines, documents.

### Acceptance items and pull requests

The criteria of [ADR 100](docs/adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 10, in its order.

| #   | Criterion                                                                               | PR        | Proved by                                                                                                     |
| --- | --------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Model and planner are pure TypeScript, time and randomness injected, browser and Worker | 1, 3, 5   | `packages/model` lint rules and tsconfig without DOM; tests in Node workers; `model-cost.spec.ts` in Chromium |
| 2   | FSRS-6 matches ts-fsrs 6.0.0 on reference cases                                         | 1         | `packages/model/src/fsrs.test.ts`                                                                             |
| 3   | `packages/sim` runs A4 from the production code                                         | 3         | `policies/production.ts` and its test; `p7.ts` uses no research planner                                       |
| 4   | Beginner reads the 46 basic hiragana by day 8 (median)                                  | 3, 15     | `PART=main` of `p7`                                                                                           |
| 5   | Review retention at least 90%                                                           | 3, 15     | `PART=main` of `p7`                                                                                           |
| 6   | At most 10 minutes a day over days 1–14                                                 | 3, 15     | `PART=main` of `p7`                                                                                           |
| 7   | Slow learners of part 3 within 2 points                                                 | 3, 15     | `PART=planner` of `p7`                                                                                        |
| 8   | State is a pure function of the log; devices converge (order, duplicates, failed syncs) | 2, 4      | `fold.properties.test.ts`                                                                                     |
| 9   | Every row of point 4 tested on synthetic answers                                        | 1, 2      | `grade.test.ts`, `fold.test.ts`                                                                               |
| 10  | A sync writes at most 3 rows, indexes included                                          | 6, 7      | `routes/sync.test.ts` (counting wrapper); the bench's `rows_written`                                          |
| 11  | `POST /api/sync` with 256 KB within ADR 086's line                                      | 7         | the bench and its research note                                                                               |
| 12  | Sync e2e: two devices, one offline for a while                                          | 11        | `e2e/sync/two-devices.spec.ts`                                                                                |
| 13  | Fold of 40,000 answers on both tracks ≤ 100 ms, Chromium 4×                             | 5, 15     | `e2e/model-cost.spec.ts`                                                                                      |
| 14  | Forecast ≤ 200 ms, same slowdown                                                        | 5, 15     | `e2e/model-cost.spec.ts`                                                                                      |
| 15  | Neither in a keystroke handler; hot path, budgets and latency test hold                 | 9, 11, 12 | `session.test.ts` (deferred record), `session-screen.test.tsx`, `check-budget`, `latency.spec.ts` in CI       |
| 16  | Forecast of the next row off by at most 1 session (median), reference learner           | 5, 15     | `PART=forecast` of `p7`; the closing note                                                                     |
| 17  | The spec describes the model, the log and the screens of P7                             | 6–15      | S1–S12; the audit of PR 15                                                                                    |

## 7. Instructions for executor agents

One executor takes one pull request of section 6.

1. **Read first:** `AGENTS.md`; in this file sections 1 and 7, section 8, your card in section 6, and in section 3 only the decisions your card names (D-numbers) and the ones they link; [ADR 100](docs/adr/100-knowledge-model-fsrs-planner-and-answer-log.md); the spec sections your card names. Check the Status table: every pull request yours depends on is merged and every manual step it waits for is marked done. If not, stop and tell the maintainer what is missing.
2. **Make no decision this plan does not hold.** Types, names, keys, SQL and constants of section 3 are copied as written. If something is missing, ambiguous or turns out wrong against the code, ask the maintainer (in Russian) and wait.
3. **Rules of P7:**
   - a. `packages/sim` runs A4 from `@nekotype/model`, never from a copy: the adapter converts and holds no rule of D5 or D6.
   - b. A constant of D9 or a rule of D4–D6 changes only with a run of `pnpm --filter @nekotype/sim run p7` (main, planner and forecast) on the production model, its output in the pull request, and the maintainer's consent. A result outside an acceptance range stops the pull request; nothing is tuned to pass.
   - c. The state is a pure fold of the log: it is never stored, synced or migrated, and nothing derived from the log is written to IndexedDB or D1. The server never parses events into a state.
   - d. Nothing new on the hot path: the key handlers of a task (recall, introduction, the option keys) do no fold, grade, planner call, lookup or IndexedDB access (D18); the render rule (0, at most 1) holds; budget limits are never raised and the figures follow D22.
   - e. The raw keystroke log is never persisted: an event holds the outcome and the time, never the keys.
   - f. A migration works with the code deployed before it; server code stops using a column before the migration that drops it.
4. **Integration branch** (PRs 8–12): follow D21. Your pull request into `p7-switch` keeps CI green; it may leave `/stats` or the sync on the old store only where your card says so.
5. **Stay in scope.** Build what your card lists. Anything else you had to touch is named in the pull request description.
6. **Follow `AGENTS.md`:** the code rules (no `any`, no assertions, strings through i18n with `en` and `ru` in parity, injected time and randomness), the layer rules, the hot-path and budget rules. Never bypass a hook.
7. **Budgets.** Run `pnpm run build && pnpm run budget` before and after and write the initial JS and CSS figures in the description. Above D22's line: stop and ask.
8. **Tests.** Write the tests your card lists and name, for each acceptance item you close, the test that proves it. Run the e2e files you touched on Chromium (`pnpm exec playwright test e2e/<file>.spec.ts --project=chromium`), and `pnpm run e2e:sync` when sync or learning changed. Report results as they are.
9. **Documents** change in the same pull request: the spec items of [section 3.7](#37-spec-changes), the ADR named, `README.md` and `docs/architecture/` when the code they describe changed, `AGENTS.md` only where named and within 250 lines. A new ADR takes the next free number and a row in `docs/adr/README.md`.
10. **Finish:** when the work is done and `pnpm run verify:quick` passes, commit with a Conventional Commits message, push the branch (the pre-push hook runs the checks) and open the pull request against the base of your card. Its description lists: what changed, why, anything outside the scope, what to check on the preview URL (from your card), the acceptance items closed with their tests, and the budget figures before and after. No AI attribution in commits or in the pull request. Never merge: the maintainer does.
11. **Mark the plan:** after `gh pr create`, set your row of the Status table to `done` with the pull request number, in a second commit on the same branch (`docs: mark P7 PR n done`). Rows 8–11 are marked in the copy on `p7-switch`; PR 12 brings them to `main`.
12. **Communication:** with the maintainer in Russian; code, comments, commits and documents in English.

## 8. Risks

| Risk                                                                                                                                                                           | How it shows                                                                                                                                                        | What to do                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real learners gain less from reviews within a sitting than the reference learner ([part 5](docs/research/2026-11-21-p7-knowledge-model-part-5.md#what-this-means-for-adr-100)) | After the release, review retention on real answers under 90% (the sim cannot show it; `observed` in the fold tracks it)                                            | Nothing in P7 changes A4. The first lever is `RETENTION` = 0.93 (ADR 100), one constant, changed with a sim run and an ADR. `observed` stays in the state so a later phase can show it                                                                                                                                                                                |
| The fold or the forecast misses its time in Chromium at 4×                                                                                                                     | `model-cost.spec.ts` over 100 or 200 ms in PR 5                                                                                                                     | Node gives 3.4 ms for 32,480 answers ([part 5](docs/research/2026-11-21-p7-knowledge-model-part-5.md#fold-time)), so the margin is wide for the fold. First profile (sorting, statistics, `snapshot`); the forecast's cost is the plays, kept down by D6's closed-form due test. If still over, stop and ask: the options are a Worker or the statistics folded apart |
| The production planner differs from the simulated A4                                                                                                                           | A number of PR 3 outside its range                                                                                                                                  | The known differences are D6's `previous` fallback, local days, introductions from the selected track only and the sim's options. Report the tables and the suspected cause; the maintainer decides, nothing is tuned                                                                                                                                                 |
| A D1 migration while the old code runs                                                                                                                                         | `0004`: none, it is additive. `0005`: a first sign-in in the minutes between the migration and PR 14's deploy fails, because PR 13's insert still names the columns | Accepted as in P6 (only the maintainer signs in); the order PR 13 → M4 → PR 14 keeps every other request working                                                                                                                                                                                                                                                      |
| A stale tab of format 2                                                                                                                                                        | Before PR 13 it still syncs format 2 into the old columns, which nothing reads; after PR 13 it gets `400` and stops                                                 | A28 as designed: a reload loads the new client, whose schema reset clears its `delta` and `outbox`. Its old answers are lost, as ADR 100 point 8 accepts                                                                                                                                                                                                              |
| Server CPU of a 256 KB batch                                                                                                                                                   | PR 7 over 12 ms                                                                                                                                                     | Stop and report; the candidates are a smaller batch cap (an ADR) or a cheaper guard. The events are not parsed beyond `isLogPage`                                                                                                                                                                                                                                     |
| D1 storage                                                                                                                                                                     | About 2 MB per learner-year against 500 MB: about 250 learner-years                                                                                                 | Not a P7 limit. Recorded in `backend.md` by PR 6; compaction returns by ADR 100 point 7 only when a limit breaks                                                                                                                                                                                                                                                      |
| Clock skew between devices                                                                                                                                                     | An own answer sorts before a pulled event: every answer folds the whole log again                                                                                   | It runs in the deferred callback, at most the fold's 100 ms. The order is still the one of ADR 100; nothing is lost                                                                                                                                                                                                                                                   |
| Two tabs append at the same time                                                                                                                                               | Two events with the same `n`                                                                                                                                        | Impossible by D16: `n` is assigned inside the transaction. A tab whose draft changed folds again                                                                                                                                                                                                                                                                      |
| `p7-switch` drifts from `main`                                                                                                                                                 | Conflicts in PRs 9–12                                                                                                                                               | Merge `origin/main` into the feature branch before opening (D21); main-line PRs touching `apps/web` during the switch are only PR 5's probe and test files                                                                                                                                                                                                            |
| A pull request outgrows its session                                                                                                                                            | Well past the size of its card                                                                                                                                      | Propose a split to the maintainer instead of cutting scope; PRs 8–11 can split further inside `p7-switch`                                                                                                                                                                                                                                                             |
| Rows written counted differently on Cloudflare than on local D1                                                                                                                | PR 6 passes, PR 7 shows more than 3                                                                                                                                 | `WITHOUT ROWID` is the reason the batch is one row; if Cloudflare counts more, stop and report before the switch                                                                                                                                                                                                                                                      |
