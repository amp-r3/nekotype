# P8 plan: the learning home and progress

Working file of phase P8 ([phases.md](docs/spec/phases.md), item 9). It tells the executor of each pull request what to build, in which order, and which decisions are already made. It is not part of `docs/`: the last pull request of the phase moves it to `docs/archive/`.

- Written on 2026-11-23 against `main` at aa045fb (PR 227 merged: P8 specified in `phases.md`).
- Changed on 2026-11-24 by PR L ([ADR 109](docs/adr/109-five-kana-learning-at-once.md)): `LEARN_MAX` 4 → 5 in a pull request of its own before PR 1, the Status table, section 7 and the expected ADR numbers of section 3.7 (one up).
- Changed on 2026-11-24 by the design export (PR D, decisions 140–152): the brief's decision column, Q2, D1, D7, D11, D13, D14 and the cards of PRs 1–6.
- Changed on 2026-11-23 by [ADR 106](docs/adr/106-design-sessions-in-a-workbench-artifact.md): the design system is cleaned up before the session ([M0](#m0-the-clean-up-of-the-design-system--before-m1), [PR C](#pr-c--design-clean-up-export)), the session runs in rounds in a workbench artifact ([M1](#m1-the-design-session--after-pr-c-before-pr-d)), and the expected ADR numbers moved up by two.
- Where this plan and `docs/spec/` disagree, the spec wins until the pull request named here changes the spec. Every such change is listed in [section 3.8](#38-spec-changes) with its pull request.
- **Two kinds of content.** Section 3 holds the data and the computations as final contracts: types, names, stores, keys and constants. An executor copies them and does not invent names. Everything that depends on how a screen looks is a brief for the design session ([section 4](#4-design-brief)): proposals, not decisions. The design export decides, and its decision numbers fill the brief's last column.
- **The code pull requests follow the design export** (PR D, [ADR 108](docs/adr/108-p8-design-export.md)): PR D rewrote the cards of PRs 1–6 against it ([section 7](#7-pull-requests)).
- Sections: [status](#status), [goal and scope](#1-goal-and-scope), [what was checked](#2-what-was-checked), [decisions](#3-decisions), [design brief](#4-design-brief), [answered questions](#5-answered-questions), [manual steps](#6-maintainers-manual-steps), [pull requests](#7-pull-requests), [executor instructions](#8-instructions-for-executor-agents), [risks](#9-risks).

## Status

The executor of a pull request fills its row (see [section 8](#8-instructions-for-executor-agents)). Every row goes to `main`: P8 has no integration branch ([D15](#d15-no-integration-branch)).

| PR  | Branch                   | Status  | Pull request |
| --- | ------------------------ | ------- | ------------ |
| C   | `docs/design-cleanup`    | done    | #230         |
| D   | `docs/p8-design`         | done    | #231         |
| L   | `p8-learn-max`           | open    |              |
| 1   | `p8-01-model-home`       | waiting |              |
| 2   | `p8-02-progress-details` | waiting |              |
| 3   | `p8-03-insights`         | waiting |              |
| 4   | `p8-04-home`             | waiting |              |
| 5   | `p8-05-session-summary`  | waiting |              |
| 6   | `p8-06-close`            | waiting |              |

## 1. Goal and scope

**What the user gets.** `/` answers "what now": one "Continue" with the reason for what the session will do first, or, when the model has nothing to offer, the time of the next review. Around it: the forecast of the next row in sessions as a range, the path through the track in blocks with the learner's place on it, the outline of the next session, the kana that got stronger since the last session started, the current streak, and the katakana suggestion once the basic hiragana are learned. The kana chart and the statistics move to "Progress" at `/progress`; `/stats` redirects there. A kana opens its details in a dialog from the chart, from "what got stronger" and from the session summary. The summary returns to `/` and shows how the forecast changed with the session. The session screen and the navigation are redrawn; the hot path stays as it is.

**In scope** ([phases.md](docs/spec/phases.md), P8; [ADR 099](docs/adr/099-learning-home-methods-and-phases-after-p6.md), points 1–4):

- the clean-up of the design system, which catches up with the P7 code, and its export (M0, PR C);
- the design session in a workbench artifact, its transfer into the design-system artifact and its export, which draws the states of P9–P12 switched off;
- small additions to `@nekotype/model` that the home needs: the reason, weak kana, the session in which a kana was introduced, a seeded generator ([D1](#d1-the-reason-for-continue), [D10](#d10-forecast-history));
- the computation of the outline, what got stronger and the forecast outside the render and the key handlers, and the forecast history in IndexedDB (schema 7);
- the home, "Progress", the kana details dialog, the session summary, the session screen and the navigation, per the export;
- the spec, `README.md` and `docs/architecture/` for all of the above.

**What stays:** the model's rules and constants (ADR 100), but `LEARN_MAX`, which PR L raises from 4 to 5 before PR 1 ([ADR 109](docs/adr/109-five-kana-learning-at-once.md)); the planner and one kind of session; the log, sync format 3 and the server; settings as one document (`learn.track` already syncs); the input engine and the input source; the hot-path rule (0 renders per recall keystroke, at most 1 on the answer); every budget limit; one dark theme.

**Out of scope:**

- The behaviour of P9–P12 (new task types, feedback that teaches, stroke order, sound, the first visit, the placement test, mnemonics, words): the design draws their states switched off; the code builds none of them.
- A change to a constant or a rule of the planner, the fold or the grades: it needs a run of `packages/sim` and an ADR (P7 plan, rule 3b).
- Server changes: P8 adds nothing to the API or D1.
- IndexedDB migrations: a schema change still resets the local data ([ADR 061](docs/adr/061-schema-reset-before-release.md)).

## 2. What was checked

Checked on 2026-11-23 against the code on `main` at aa045fb. Times in Node are medians of five runs after one warm-up on `syntheticLog({ answers: 40_000, seed: 1 })` (43,746 events), from a scratch script that was not committed.

| Item                            | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budgets today                   | `pnpm run build && pnpm run budget`: initial JS 30.38 of 35 KB gzip, initial CSS 7.69 of 10 KB, first load 99.25 KB. Lazy: session runtime 9.90 KB, model 7.63, `/stats` 5.12, sync 4.80, account panel 1.74, settings 1.70, summary panel 0.99, Dialog 0.87                                                                                                                                                                                                                                      |
| The chart in the initial chunk  | `/` built without `KanaChart` and `pages/learn/lib/chart.ts` (`cellInfos` kept): initial JS 27.81 KB, 2.57 KB less. The initial CSS does not change: the chart's styles are global, in `app/styles/index.css` (lines 392–600)                                                                                                                                                                                                                                                                     |
| Model cost in Node              | Fold with statistics 29.4 ms; the same fold split at the last `start` (fold the prefix, `snapshot()`, apply the rest) 29.2 ms; forecast of the next katakana row with the track hiragana (P7's measured worst case, held back by `TRACK_LAG`) 52.2 ms; the same row with the track katakana (what the home asks) 10.1 ms; `outlineSession` 0.2 ms; two `describe` and `strongerSince` 1.2 ms. P7 measured at 4× in Chromium a fold of 64.9 ms and the worst forecast 131.8 ms: 2.2–2.5 times Node |
| The 300 ms line                 | At 4×: fold 65–85 ms + what got stronger and the outline about 4 ms + the home's forecast about 25 ms (worst measured case 132–146 ms) + two renders. 100–235 ms: the line of 300 ms holds with a margin, on the main thread                                                                                                                                                                                                                                                                      |
| When the planner offers nothing | `nextTask` returns null only when no kana is due by look-ahead, none is learning and no introduction is possible: the selected track is fully introduced and the other track is not started or within `TRACK_LAG`. Then at least one kana is learned, so a next due moment (`KanaView.dueFrom`) exists                                                                                                                                                                                            |
| The first task                  | `nextTask`'s kana does not depend on `rng`: one draw decides recall or recognition for a learning kana. Order: due → ready learning → introduction (while fewer than `learningLimit` learn) → waiting learning. So with learning kana whose step has not passed, the first task can be an introduction                                                                                                                                                                                            |
| Blocks of the path              | `kanaRows` categories: hiragana `basic` 10 rows / 46 kana, `dakuten` 5 / 25 (g, z, d, b and the handakuten row p), `yoon` 11 / 33; katakana the same plus `extended` 5 / 21 (ext_fa, ext_va, ext_wi, ext_ti, ext_che). `kanaRows` (engine) is already in the initial chunk through `entities/learn/lib/chart.ts` and `tracks.ts`                                                                                                                                                                  |
| "Before" of what got stronger   | The store folds the whole log with `foldLog` on load and applies events one by one after; it keeps no state at a session start. The session keeps `learnView` at its start, for the summary only                                                                                                                                                                                                                                                                                                  |
| Counting sessions               | `LogStats.started` counts `start` events of every device. The sim settles a forecast made at the start of a session with `actual` = the sessions from that one to the one that introduced the row's last kana, both included (`packages/sim/src/run.ts`, `settle`). The fold does not record when a kana was introduced                                                                                                                                                                           |
| Seeded randomness               | `seededRng` (mulberry32) is in `@nekotype/shared/testing`, `packages/model/src/testing/synthetic-log.ts` and the probe; the app has only `defaultRng` (`Math.random`), so the same state gives a different outline and forecast on each run                                                                                                                                                                                                                                                       |
| Routes                          | `ROUTE_PATHS` = `/`, `/stats`, `/settings`, `/about`. `redirects.test.ts` wants every rule of `_redirects` to be a `200` rewrite to `/` of a path of `ROUTE_PATHS`; `smoke-deploy.mjs` wants 200 for every route. The dev server and `vite preview` (all e2e) serve `index.html` for any path and ignore `_redirects`. P6 M3 saw a stale edge copy of `index.html` answer a removed path for up to 7 days                                                                                         |
| Who reads `/stats`              | e2e `stats.spec.ts` (seeds at `/stats`), `routes.spec.ts`, `sync/guest-sign-in.spec.ts` and `sync/two-devices.spec.ts` (open `/stats`, read `stats-started` and `stats-finished`); the dictionary part `stats`; `App.test.tsx`, `router.test.ts`, `check-budget.test.ts`, `smoke-deploy.test.ts`, `dictionary-parts.test.ts`; `docs/spec` (phases, quality, metrics, frontend, learning, architecture, README), `docs/architecture` (pages, layout, quality-gates), `README.md`                   |
| Who reads the home's line       | e2e `learn-session`, `learn-chart`, `routes`, `latency`, `sync/*` and `e2e/lib/sync.ts` wait for `learn-mastered-count`; `learn-session` reads `learn-due`                                                                                                                                                                                                                                                                                                                                        |
| The chart's details             | `KanaChart` (`shared/ui`, 367 lines) draws an inline panel under the row (`renderDetails`, `KanaChartPanel`, ADR 062). Its strings (`learn.chart.*`) are in the English core, in the initial chunk. `displayRomaji` is in `pages/learn/lib/romaji.ts` with the table's canonical spelling (`lib/prompt/canonical.ts`)                                                                                                                                                                             |
| Dialog                          | `shared/ui/dialog.tsx`: a native `<dialog>` opened with `showModal` (Esc closes it, focus stays inside) that gives the focus back to the element focused before. Only lazy chunks use it (settings, sync), so it is a lazy chunk of its own                                                                                                                                                                                                                                                       |
| Layers                          | `features` has one slice (`sync`). `steiger` rejects a slice with one consumer (ADR 015). `App.tsx` already renders a dialog of `features/sync` through a dynamic import                                                                                                                                                                                                                                                                                                                          |
| Dictionary parts                | `stats`, `settings`, `about`, each loaded with its route (`loadDictionaryPart`); the English core is in the initial chunk, Russian is lazy                                                                                                                                                                                                                                                                                                                                                        |
| Budget script                   | `check-budget.mjs` fails when `src/features/sync/index.ts` or the model entry is in the initial chunk or statically imported by a route chunk; no such check for any other entry                                                                                                                                                                                                                                                                                                                  |
| IndexedDB                       | Schema 6: `settings`, `log`, `outbox`, `meta`; a missing store also resets the database. The comment on `PRE_RELEASE` in `shared/lib/idb/schema.ts` still says "until the P7 release tag" (the release is P14 since ADR 099)                                                                                                                                                                                                                                                                      |
| Clearing                        | Sign-out, a discarded other account and account deletion clear `USER_STORES` = `log`, `outbox`, `settings` (`features/sync/model/account.ts`); "Reset progress" calls `clearLog` (`entities/learn/model/log.ts`)                                                                                                                                                                                                                                                                                  |
| Track                           | `learn.track` is a field of `Settings`, written by `setTrack` (`entities/settings`) and synced last-write-wins. `/stats` has a view-only track switch of its own for the answer-time chart                                                                                                                                                                                                                                                                                                        |
| Hot path                        | `LearnPage` reads `learnView` only in its home branch, so a session view does not subscribe to it; `session-screen.test.tsx` gates 0 renders per recall keystroke and at most 1 on the answer. The store publishes `describe(snapshot)` after every event, in the deferred record callback                                                                                                                                                                                                        |
| Latency gate                    | `LATENCY_PATHS` has `pages/learn/`, `entities/learn/model/`, `packages/model/`, the e2e lib and the probe; `playwright.latency.config.ts` runs `latency.spec.ts` and `model-cost.spec.ts` on the probe build (`__LATENCY_PROBE__`)                                                                                                                                                                                                                                                                |
| Design export                   | Decisions up to 138. It draws `confident`, `review (N)`, the inline details panel, `/stats` and the old home; components `KanaChart`, `KanaTask`, `Dialog`, `Nav`, `Segmented`, `Stat`, `ActivityMap`, `ResultChart`, `EmptyState`, `Notice` and others. `docs/design/README.md` notes the P7 differences                                                                                                                                                                                         |

## 3. Decisions

Each decision fills a gap that the spec and ADRs 099–100 leave open. The maintainer answered four questions on 2026-11-23 ([section 5](#5-answered-questions)); everything else is decided here, with its reason. Paths are relative to the repository root.

### 3.1 The home's data

#### D1. The reason for Continue

The reason is a label of what the session does first, never a mode: it is read from the planner's first task, so it cannot promise something the session does not do. `packages/model/src/home.ts`, exported from the index:

```ts
export type Reason =
  /** The first task is a review: `due` kana of both tracks are due now. */
  | { readonly kind: 'review'; readonly due: number }
  /** The first task is a learning kana, and some learning kana are weak (track order). */
  | { readonly kind: 'weak'; readonly keys: readonly LearnKanaKey[] }
  /** The first task is a learning kana, and none is weak: `learning` kana of both tracks learn. */
  | { readonly kind: 'learning'; readonly learning: number }
  /** The first task introduces `key` of `row`; the row may be of the other track (`TRACK_LAG`). */
  | { readonly kind: 'new'; readonly key: LearnKanaKey; readonly row: RowId }
  /** The planner offers nothing: the smallest `dueFrom` of a learned or mastered kana. */
  | { readonly kind: 'none'; readonly nextAt: number };

/** What Continue does first; `view` is `describe` of `state`. Pure: no clock, no random draw. */
export function reasonOf(
  state: ModelState,
  view: LearnView,
  ctx: { readonly now: number; readonly track: Track },
): Reason;

/** A learning kana the learner has trouble with. */
export function isWeak(kana: KanaView): boolean;
```

- **Order, from the planner:** `first = nextTask(state, { now, track, previous: null, rng: ALWAYS_RECALL })`, where `ALWAYS_RECALL = { next: () => 1 }` (the draw only chooses recall or recognition, which the reason does not name). Then: `null` → `none`; a recall with `review` → `review`; an introduction → `new`; any other task (a learning kana) → `weak` when some learning kana of either track is weak, otherwise `learning`.
- **Counts:** `review.due` = kana of both tracks with `dueFrom !== null && dueFrom <= now` (what the P7 line called `due: N`); `learning.learning` = kana with state `learning`; `weak.keys` = the weak ones, in `ITEMS` order; `new.row` = `ITEMS.get(key).row`; `none.nextAt` = the smallest `dueFrom` over the learned and mastered kana (one exists whenever the planner offers nothing, [section 2](#2-what-was-checked)).
- **Weak kana** (`isWeak`), from `LearnView` only: state `learning`, and either at least `WEAK_MIN_RECALLS` recall answers among the last 10 with `accuracy < WEAK_ACCURACY`, or confusions summing to at least `WEAK_CONFUSIONS`. A kana introduced in this session has neither, so a normal start reads "finish learning". Weak kana are a subset of the learning kana, because those are the only kana the planner brings back outside reviews.
- **Constants** (`constants.ts`): `WEAK_MIN_RECALLS` = 5, `WEAK_ACCURACY` = 0.8, `WEAK_CONFUSIONS` = 2. They label and never choose a task, so they need no sim run; a change is the maintainer's.
- **Copy** (en / ru; plural keys as `learn.streak`: `.one`, `.few`, `.many`, `.other`, where en repeats `other` in `few` and `many`). The design session may reword it (the export wins, PR D records it), not change what it says:

  | Key                                       | en                                                                            | ru                                                                                                                                      |
  | ----------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
  | `learn.reason.review.*`                   | one `{count} kana is due for review`, other `{count} kana are due for review` | one `{count} кана ждёт повторения`, few `{count} каны ждут повторения`, many `{count} кан ждут повторения`, other as few                |
  | `learn.reason.weak.*`                     | `practise {count} weak kana: {kana}`                                          | one `потренировать {count} слабую кану: {kana}`, few `… {count} слабые каны: {kana}`, many `… {count} слабых кан: {kana}`, other as few |
  | `learn.reason.learning.*`                 | `finish learning {count} kana`                                                | one `доучить {count} кану`, few `доучить {count} каны`, many `доучить {count} кан`, other as few                                        |
  | `learn.reason.new`                        | `next: {row}`                                                                 | `дальше: {row}`                                                                                                                         |
  | `learn.reason.newOther`                   | `next: {row}, {track}`                                                        | `дальше: {row}, {track}`                                                                                                                |
  | `learn.row.vowels`, `learn.row.of`        | `the vowels`, `the {head} row`                                                | `гласные`, `ряд {head}`                                                                                                                 |
  | `learn.reason.none`                       | `nothing to review now`                                                       | `сейчас повторять нечего`                                                                                                               |
  | `learn.nextReview`                        | `next review: {when}`                                                         | `следующее повторение: {when}`                                                                                                          |
  | `learn.when.today`, `.tomorrow`, `.later` | `at {time}`, `tomorrow at {time}`, `{date}, {time}`                           | `в {time}`, `завтра в {time}`, `{date}, {time}`                                                                                         |

  The export (decisions 140, 141) words it so: the weak reason ends with its kana (`{kana}`: `weak.keys` joined by spaces, in a `lang="ja"` span), and `none` is two lines, the reason and `learn.nextReview` under it. `{head}` is the row's head as the chart shows it (`k`, `sh`, `fa`; romaji in every language, ADR 044); `{track}` is `learn.track.*`; `{time}` and `{date}` come from `Intl.DateTimeFormat` with the locale (`hour: 'numeric', minute: '2-digit'`; `day: 'numeric', month: 'short'`), `today` and `tomorrow` by the local day of `nextAt`.

#### D2. Nothing to do

- `reasonOf` gives `none` exactly when `nextTask` is null on the current state with `previous: null`. Continue does not start a session then: one kind of session exists, and it would end with no task. The page model holds `canStart = ready && reason.kind !== 'none'`; the action that starts a session checks it, so neither a click nor Enter starts an empty session. The summary's Continue follows the same rule.
- What takes the primary place instead is the design's ([section 4](#4-design-brief), item c). When the katakana suggestion is shown ([D5](#d5-the-katakana-suggestion)), it is the natural next action: `none` mostly happens with all hiragana introduced and katakana not started.
- **Planning again:** the home's page model computes the reason when the learn view or the track changes, when the tab becomes visible, and on a timer of `REPLAN_MS` = 60,000 while the home is mounted (the injected `Scheduler`). It sets its signal only when the reason changed (same kind and numbers keep the old object), so a tick renders nothing. `nextAt` in the past means the next tick turns `none` into `review`.

#### D3. What got stronger

`strongerSince(before, after)` of the model, with `before` = the state just before the last `start` event of the log, of any device, and `after` = the current state.

- **Source.** The learn store keeps `startSnapshot`: on a full fold (load, `reloadLearning`, an event out of order, a new target time) it folds the log up to the last `start`, takes `fold.snapshot()`, then applies the rest; when it applies a `start` event incrementally (its own or another tab's), it takes `fold.snapshot()` just before. No `start` in the log: null.
- **Cost:** the split fold costs what the plain fold does (29.2 against 29.4 ms in Node); a snapshot is O(kana + days) once per session; `describe` of the snapshot and `strongerSince` take 1.2 ms in Node and run in the insights job ([D8](#d8-insights-where-and-when)), not in a render.
- **Edge cases:**
  - before the first session (no `start`): the state `first`; the design draws it with the first visit;
  - after the first session, `before` is the empty state: every kana the session introduced is listed (`locked` → `learning` or `learned`). `Stronger.from` and `to` let the design group them ("new", "learned", "mastered", "stronger");
  - a session left without `end` still started: its start counts;
  - another device: the last `start` of the merged log; a pull folds again and moves it. A session that another device is still running when its start is pulled gives a partial list until the next pull;
  - clock skew: the order of the log decides, as for every event.

#### D4. The path

`entities/learn/lib/path.ts` (initial chunk: it reads the engine's `kanaRows`, already there, and `LearnView`; no model call):

```ts
export type RowState = 'done' | 'current' | 'locked';
export type PathRow = {
  readonly id: RowId; // `${track}:${row.id}`, as `@nekotype/model`'s RowId
  readonly head: string; // as `chartRows` gives it: '' for the vowels, 'k', 'sh', 'fa'
  readonly keys: readonly LearnKanaKey[];
  readonly state: RowState;
  /** Kana not locked. */
  readonly introduced: number;
  /** Kana learned or mastered. */
  readonly learned: number;
  readonly total: number;
};
export type PathBlock = {
  readonly category: RowCategory; // 'basic' | 'dakuten' | 'yoon' | 'extended'
  readonly state: RowState;
  readonly rows: readonly PathRow[];
  readonly introduced: number;
  readonly learned: number;
  readonly total: number;
};
export type TrackPath = {
  readonly track: Track;
  readonly blocks: readonly PathBlock[];
  /** The row being opened: the first row not done; null when every row is done. */
  readonly current: RowId | null;
};
export function pathOf(view: LearnView, track: Track): TrackPath;
```

- **Blocks** follow the engine's categories in table order: hiragana basic, dakuten (dakuten and handakuten), yōon; katakana also extended.
- **Row:** `done` = every kana of the row is introduced (not locked), as the maintainer chose ([Q3](#q3-what-done-means-on-the-path)); `current` = the first row of the track, in table order, that is not done; `locked` = every other row that is not done. So there is exactly one current row while the track is not fully introduced, and it is the row the forecast targets (`nextRow` of the model; a test checks that they agree). A row after the current one can hold introduced kana (a dakuten kana whose base was learned out of order); it stays `locked`, and `introduced` shows it.
- **Block:** `done` = every row done; `current` = holds the current row; `locked` = otherwise.
- `done` never turns back: an introduced kana never becomes locked. Learned and mastered counts are data for the design; the chart on "Progress" shows each kana's state.

#### D5. The katakana suggestion

- Shown on the home while `learn.track` is `hiragana`, `view.suggestKatakana` is true (the 46 basic hiragana are learned, ADR 100 point 5) and `view.introduced.katakana === 0`.
- Its action calls `setTrack('katakana')` (`entities/settings`), which syncs as `learn.track`. The home then shows the katakana path, and the reason and the forecast follow the new track.
- It cannot be dismissed ([Q1](#q1-can-the-katakana-suggestion-be-hidden)); nothing is stored. It ends for good once katakana has an introduced kana, which is in the log and syncs.

#### D6. The streak and the first visit

- The home shows the current streak only: `streakOfDays(view.stats.days, localDay(now))` (`entities/learn/lib/progress.ts`). The best streak, the active days, the totals and the mastered counts are on "Progress".
- First visit until P11: no answer yet (`view.stats.days.size === 0`), as the P7 line. P11 redraws the first visit; the export draws its state switched off.

#### D7. The outline

`outlineSession(state, { now, track, rng: seededRng(OUTLINE_SEED) })` gives `{ reviews, learning, introductions }`, computed in the insights job ([D8](#d8-insights-where-and-when)). A fixed seed gives the same outline for the same state, so a recomputation does not make it jump. Not shown with `none` (all zero).

- **Copy** (decision 140): `learn.outline` = `about {total} tasks: {reviews} reviews, {new} new kana` / `около {total} заданий: {reviews} повторений, {new} новые каны`, with `{total}` = reviews + learning + introductions; a part at 0 is left out (`about 25 tasks: 5 new kana`); each number takes its plural keys as `learn.streak`; the numbers in `mono-romaji`. `about` and `около` stand for `≈`, which the font subsets do not hold.

### 3.2 Computation

#### D8. Insights: where and when

The outline, what got stronger and the forecast are computed on the **main thread**, in the injected `Scheduler`'s callbacks, never in a render and never in a key handler.

- **Why not a Worker.** The home's forecast takes about 10 ms in Node and the worst measured case about 52 ms ([section 2](#2-what-was-checked)). A Worker would need the log (1–2 MB) copied to it and folded again, which costs more than the forecast, plus a second copy of the model in a worker chunk and a protocol to keep it in step with the log. It returns only if the line of 300 ms is missed ([section 9](#9-risks)).
- **Where the code lives.** The signals and `requestInsights` are in `entities/learn/model/insights-state.ts` (initial chunk, small). The computation, the history reads and writes ([D10](#d10-forecast-history)) and the seeds are in `entities/learn/model/insights.ts`, reached only by a dynamic import that the store starts together with the model chunk, so the initial chunk does not grow with it.
- **API** of `entities/learn` (index):

  ```ts
  export type ForecastBasis = 'model' | 'habits' | 'corrected';
  export type ShownForecast = {
    readonly row: RowId;
    readonly low: number;
    readonly median: number;
    readonly high: number;
    /** The median before the correction: what the history keeps. */
    readonly raw: number;
    /** `model`: `habitsOf(state).shares` is null (fewer than OUTCOMES_MIN learning answers);
     *  `habits`: fewer than FORECAST_HISTORY_MIN settled forecasts; `corrected`: otherwise. */
    readonly basis: ForecastBasis;
  };
  export type ForecastState =
    | { readonly kind: 'pending' }
    | { readonly kind: 'ready'; readonly forecast: ShownForecast }
    /** `raw` over FORECAST_MAX_SESSIONS: the row has no forecast. */
    | { readonly kind: 'beyond'; readonly row: RowId }
    /** Every kana of the track is introduced (`nextRow` is null). */
    | { readonly kind: 'complete' };
  export type StrongerState =
    | { readonly kind: 'pending' }
    /** No session has started yet: the log has no `start`. */
    | { readonly kind: 'first' }
    | { readonly kind: 'ready'; readonly kana: readonly Stronger[] };
  export type Insights = {
    /** The `learnVersion` and the track they were computed for. */
    readonly version: number;
    readonly track: Track;
    /** Null until step 1 has run. */
    readonly outline: Outline | null;
    readonly stronger: StrongerState;
    readonly forecast: ForecastState;
  };

  /** Grows by one at every publish of `learnView`. */
  export const learnVersion: ReadonlySignal<number>;
  export const insights: ReadonlySignal<Insights | null>;
  /** The home or the summary is on screen: compute for the current log and `track`. */
  export function requestInsights(track: Track): void;
  /** `reasonOf` on the live state (D1); null until the store is ready. Cheap: one planner call. */
  export function reasonAt(now: number, track: Track): Reason | null;
  ```

  The types `Reason`, `Outline`, `Stronger` and `RowId` are re-exported from `@nekotype/model` as types only. The store gains, for the insights module: `startSnapshot()` ([D3](#d3-what-got-stronger)), `version` (the signal behind `learnVersion`) and `loadedModel()` (the module, null until ready).

- **Steps.** `requestInsights(track)` does nothing when `insights` already holds this version and track with no pending part. Otherwise it sets `insights` to `{ version, track, outline: null, stronger: pending, forecast: pending }` and schedules **step 1** with `setTimeout(…, 0)`: what got stronger (`describe(startSnapshot)` and `strongerSince`) and the outline, published at once; then **step 2** in the next callback: the history is settled ([D10](#d10-forecast-history)), the forecast is computed and published, and a shown forecast is recorded. A step whose request is no longer the latest (another version or track) does nothing.
- **Triggers:** the home calls `requestInsights` on mount and when `learnVersion` or the track changes while it is mounted; the summary calls it when it is shown (the end of a session). A pull (`reloadLearning`) and another tab's append publish a new view, so a mounted home or summary asks again.
- **Cancel:** `startSession()` clears the scheduled steps and drops the request; nothing computes during a session, because no screen of a session asks. A step already running finishes first (one main-thread task, about 25 ms at 4× for the home's forecast).
- **Seeds:** `FORECAST_SEED` = 1 and `OUTLINE_SEED` = 2 (`seededRng` of the model, [D10](#d10-forecast-history)): the same state gives the same numbers.
- **While pending:** Continue and its reason are there as soon as the store is ready; the outline, what got stronger and the forecast show their pending states (drawn by the export).
- **The line of 300 ms** (phases.md): measured by `apps/web/e2e/home-cost.spec.ts` in `playwright.latency.config.ts` ([PR 4](#pr-4--the-home)). In the probe build the store sets `performance.mark('nekotype:model')` when the model chunk has loaded; an init script records the first time the forecast and the stronger blocks appear in the DOM (their `data-testid`); both must come within 300 ms of the mark at 4× CPU throttling, the median of three loads, on a seeded log of `syntheticLog({ answers: 40_000, seed: 1 })` with `learn.track` = `katakana` (with hiragana selected, every hiragana of that log is introduced and there is nothing to forecast).

#### D9. The forecast on the home and in the summary

- **Home:** `insights.forecast` of the selected track.
- **Summary:** the session captures `before` when it starts: `insights.value.forecast` when its kind is `ready` and its track is the session's, otherwise null. After the session the summary asks for insights and reads `after`:

  ```ts
  export type ForecastChange = {
    readonly before: ShownForecast | null;
    readonly after: ForecastState;
  };
  ```

  Cases the design draws: the same row (`before.row === after.forecast.row`); the row opened during the session (`after` names another row, or is `complete`); no `before` (Continue was pressed before the forecast was ready, or it was `beyond`); `after` pending, `beyond` or `complete`. The export shows medians (decision 148, [Q2](#q2-the-forecast-change-in-the-summary)): `before.median → after.median`; [ADR 108](docs/adr/108-p8-design-export.md), point 8, records that point 6 of ADR 100 ("never one number") holds for the home and not for this comparison. The data still carry both.

### 3.3 Forecast history

#### D10. Forecast history

Each forecast shown is kept on the device and settled once its row is introduced; from three settled forecasts on, `forecastRow` corrects by them (it does so already: `history`, `FORECAST_HISTORY_MIN` = 3, `FORECAST_HISTORY` = 10).

- **Model additions** (PR 1):
  - `LogStats.introducedIn: ReadonlyMap<LearnKanaKey, number>`: `started` at the moment the fold introduces a kana (an `intro` event, or an answer on a new kana), that is the number of the session that introduced it. Copied by `snapshot()` and `clone()`; the property tests compare it like the rest of the statistics.
  - `KanaView.introducedIn: number | null` (null while locked).
  - `seededRng(seed): Rng` in `packages/model/src/rng.ts` (mulberry32, as `@nekotype/shared/testing` has it), exported from the index; `testing/synthetic-log.ts` uses it, so `syntheticLog` gives the same log as before.
- **Store** `forecasts` (IndexedDB, `SCHEMA_VERSION` = 7), key `${row}@${day}` (`day`: the device's local day when it was shown):

  ```ts
  export type ForecastRecord = {
    readonly row: RowId;
    readonly day: number;
    /** When it was shown, ms. */
    readonly at: number;
    /** `ShownForecast.raw`: 1 to FORECAST_MAX_SESSIONS. */
    readonly raw: number;
    /** `LogStats.started` when it was shown: the sessions before it. */
    readonly started: number;
    /** Sessions it took; null while its row has a locked kana. */
    readonly actual: number | null;
  };
  ```

- **Created** by step 2 when a `ready` forecast is published for a screen that asked for it, only when no record has its key: the first forecast of a row on a local day is kept, as the sim kept the first forecast of each day, which is what the P7 acceptance measured. `beyond` and `complete` are never recorded.
- **Settled** by step 2, before it forecasts: an open record whose row has no locked kana gets `actual = max(introducedIn of the row's kana) − started`. A result below 1 (the row was finished in a session older than the forecast and pulled late) deletes the record instead. Example: shown with `started` = 10, the row's last kana introduced in session 11: `actual` = 1, a forecast of "1 session" was right.
- **Passed to the forecast:** the settled records in order of `at`, the last `FORECAST_HISTORY`, as `{ forecast: raw, actual }`.
- **Kept:** the newest 10 settled and the newest 60 open records by `at` (`HISTORY_OPEN_KEPT`, about two months of daily forecasts); the write that adds or settles one deletes the rest.
- **Reads and writes:** read once with `getAll` on the first step 2 after `initLearn`, then held in memory and written through, outside any key handler. Two tabs: the key makes a creation idempotent (an `update` transaction writes only when the key is absent), and settling gives the same `actual`; a tab does not hear about another tab's records until it loads again, which only delays a correction.
- **Never synced.** Cleared with the log: "Reset progress" (`clearLog` clears `forecasts` too), sign-out, a discarded other account and account deletion (`USER_STORES` gains `forecasts`). Kept by the guest merge and by a sign-in of the same user after an expired session, which keep the log. Reason: the history measures how this learner's log moved against its forecasts; it means nothing for another log.
- **Schema 7.** `STORES` gains `{ name: 'forecasts' }` and `SCHEMA_VERSION` becomes 7, so a database of schema 6 is reset ([ADR 061](docs/adr/061-schema-reset-before-release.md)): the device loses what it has not sent and starts as a guest. The maintainer syncs first (M2); signing in again pulls the log back.

### 3.4 Routes and screens

#### D11. `/progress` and the redirect from `/stats`

- `ROUTE_PATHS` = `/`, `/progress`, `/settings`, `/about`. `route-paths.ts` gains `ROUTE_REDIRECTS = { '/stats': '/progress' } as const`.
- `public/_redirects`: the rewrites of `ROUTE_PATHS` as now (`/progress / 200`, `/progress/ / 200`, …), then `/stats /progress 301` and `/stats/ /progress 301`. Cloudflare takes the first rule that matches; no rule overlaps.
- `redirects.test.ts`: the rules with status 200 are the paths of `ROUTE_PATHS` but `/`, each with and without the trailing slash, rewritten to `/`; the rules with status 301 are the entries of `ROUTE_REDIRECTS`, each with and without the slash; no other status, no `/index.html`, no catch-all. The test keeps both lists equal to the code.
- **The router follows the redirects too:** a path of `ROUTE_REDIRECTS` is replaced by its target with `navigate(target, { replace: true })` when the router starts and on `popstate`. It covers the dev server and `vite preview`, which ignore `_redirects`, and a stale edge copy of `index.html` that answers `/stats` with 200.
- `smoke-deploy.mjs`: `/stats` and `/stats/` answer 301 with `location: /progress` (fetched with `redirect: 'manual'`).
- `pages/stats` becomes `pages/progress` (`ProgressPage`); the dictionary part `stats` becomes `progress`; `page.stats` and `nav.stats` become `page.progress` and `nav.progress`. The `data-testid`s of the statistics (`stats-streak`, `stats-started`, …) keep their names, so the sync e2e change only the path.
- **Chart on top:** the kana chart of the shown track; its track switch is view-only ([Q4](#q4-the-track-switch-on-progress)): a local signal of the page, starting at `learn.track`, that never writes the setting. Whether the answer-time chart keeps its own switch or follows this one is the design's (section 4, item i).
- The chart's code moves from `pages/learn/lib/chart.ts` to `pages/progress/lib/chart.ts`; `entities/learn/lib/chart.ts` (`cellInfos`, `chartRows`) stays. `KanaChart` loses its inline panel (`renderDetails`, `KanaChartPanel`) and calls `onOpen(cell)` instead ([D12](#d12-the-kana-details-dialog)). The chart's styles leave the initial CSS for a stylesheet that the Progress page imports, except the cell and its four state styles (`nk-kc__cell`, `is-st-*`, the mastered mark): the export draws table cells on the home and in the summary (decisions 144, 148), so those stay in the initial CSS.
- The navigation links `/`, `/progress` and `/settings`.

#### D12. The kana details dialog

- **Slice** `features/kana-details`, because three places open it, the home and the summary (`pages/learn`) and the chart (`pages/progress`), and pages do not import each other. With two consuming slices `steiger` accepts it.
  - `index.ts`: `KanaDetailsHost`, `openKanaDetails(key: LearnKanaKey): void`, `prefetchKanaDetails(): Promise<void>`.
  - `model/open.ts`: the open key as a `ReadonlySignal<LearnKanaKey | null>`, `openKanaDetails`, `closeKanaDetails`. `openKanaDetails` does nothing while `immersive` is on: a running session never opens it.
  - `ui/kana-details-host.tsx` (initial chunk through `App.tsx`, which renders it once): when a key is open, it loads `ui/kana-details-dialog.tsx` and the dictionary part `details`, then renders the dialog; nothing while loading (both are prefetched on idle).
  - `ui/kana-details-dialog.tsx` (lazy): the shared `Dialog` with the kana's data; `lib/lines.ts`: the lines from `KanaView` (today's `kanaPanelLines`).
- **Data:** `learnView.value.kana.get(key)` (state, `dueFrom` and the page's clock for "due now", `nextReviewAt`, `stability`, `recall`, `medianMs`, `accuracy`, `recognitions`, `recognitionErrors`, `confusions`) and `displayRomaji(key)`. **`stability` of a learning kana:** the export's memory row shows it for every introduced kana (`holds less than a day` while learning, decision 147), so PR 1 makes `KanaView.stability` the memory's stability for every introduced kana, not only learned and mastered (`view.ts`); `strongerSince` reads it for learned and mastered only, as now, and `nextReviewAt` stays null while learning. `displayRomaji` and the canonical spelling move from `pages/learn/lib` to `entities/learn/lib/romaji.ts`, used by the session, the chart and the dialog. A locked kana has no details.
- **Focus and Esc:** the shared `Dialog` (native `showModal`): Esc closes, the focus stays inside, and closing gives it back to the element that opened it. Its title names the kana and its romaji for screen readers. The opener is a button (a chart cell, a kana of "what got stronger" or of the summary), so Enter and Space open it.
- **Not in the first load:** `check-budget.mjs` gains `DETAILS_ENTRY` = `src/features/kana-details/ui/kana-details-dialog.tsx` with the checks of `SYNC_ENTRY` (not initial, not a static import of a route chunk). The idle prefetch adds `prefetchKanaDetails` (the chunk and the dictionary part of the current language).
- **Rows** (decision 147): `state` (the state with `next review: {date}` or `review due`), `memory` (`holds about {n} days` / `holds less than a day`, then ` · mastered from 21 days` until mastered, and a 2px stroke of `min(1, stability / 21)`), `recall` (`median {ms} ms · accuracy {p}%`, with `{n} of 10 answers` under 10), `mixed up with` (`め ×4, ね ×2`), `recognition` (`{p}% ({a} of {b})`); without data `no recall answers yet`, `none yet`, `no answers yet`.
- **Strings:** the dictionary part `details` (en, ru) takes the panel's strings (`learn.chart.stats`, `.answers`, `.mixups`, `.noMixups`, `.recognition`, `.noRecognition`, `.nextReview`, `.due`, `.close`) under `details.*`, with what the export adds.

#### D13. The session screen and the summary

- **Session screen:** per the export. `KanaTask` and `createTaskController` stay the task's DOM writer; the session line and "Leave session" stay; "Leave session" returns to the home. The render rule is unchanged and `session-screen.test.tsx` stays the gate.
- **Ticks** (decision 149): under the session line a tick per task of the session, `total` of the session line (`SESSION_LENGTH`). The session keeps `misses: readonly number[]`, the 0-based numbers of its finished tasks answered with an error, an error as [Metrics](docs/spec/metrics.md) defines it (a rejected key or Esc in recall, a wrong choice in recognition); it appends to it when an answer is recorded, in the render the answer already has, never in a key handler. `KanaTask` takes it as `session.misses`. A session that ends early ends with ticks left.
- **Summary:** returns to `/`, the home; its second action is `home` / `на главную` (decision 148; `to the table` goes). It keeps its lists (`SessionSummary`) and adds `ForecastChange` ([D9](#d9-the-forecast-on-the-home-and-in-the-summary)); each listed kana opens the details dialog; its Continue follows [D2](#d2-nothing-to-do).

### 3.5 Budgets

#### D14. Budgets

- **Into the initial chunk:** the home's views, `entities/learn/lib/path.ts`, `insights-state.ts`, `reasonAt`, `KanaDetailsHost` and `openKanaDetails`, the router's redirect, the English strings of the home. **Out of it:** the chart (to the Progress route chunk, measured at 2.57 KB), its strings (to the `progress` part) and its styles but the cell and its states, which the home's "since the last session" draws (decision 144); the details dialog and its part; `insights.ts`.
- **Line:** after every pull request into `main`, initial JS ≤ 31.0 KB and initial CSS ≤ 8.5 KB gzip. Above either, the executor stops and asks. Reason: the chart pays for most of the home, and P9–P14 need what is left of the 35 KB (the first visit and the words on `/` come in P11 and P12).
- Every pull request writes the initial JS and CSS before and after in its description. The limits of [Quality](docs/spec/quality.md#budgets) are not raised; the model, `insights.ts`, the Progress route and the dialog are lazy chunks under the 25 KB of a lazy chunk.

### 3.6 How it reaches production

#### D15. No integration branch

Every pull request goes to `main`. Reasons:

- The only gap the maintainer named, a home without the chart before `/progress` exists, is closed by the order: PR 2 ships `/progress` with the chart while `/` keeps it, and PR 4 takes it off `/`.
- P8 changes no synced format and nothing on the server. P7 needed `p7-switch` because the log, the planner and format 3 had to reach production in one deployment; here the only reset (schema 7, PR 3) is one pull request.
- Between pull requests production mixes old and new screens. Before P14 only the maintainer uses it ([ADR 061](docs/adr/061-schema-reset-before-release.md)), and every pull request leaves each screen working.

### 3.7 Documents and decision records

- **ADRs,** each with the next free number when its pull request is opened (today the last is 109, five kana learning at once; the expected numbers follow): **107** in PR C (the clean-up of the design system: the catch-up with P7, the phase numbers of ADR 099, the typing trainer's leftovers, the cover); **108** in PR D (the P8 design export: the screens, the later phases drawn switched off, and the format of the forecast change if it amends ADR 100 point 6); **109** in PR L (five kana learning at once, amending ADR 100 point 2); **110** in PR 1 (the home's data from the model: the reason from the first task, weak kana, `introducedIn`, seeded plays); **111** in PR 2 (`/progress` with a 301 at the edge and in the router; the kana details dialog as a lazy feature slice; the view-only track switch); **112** in PR 3 (insights on the main thread in scheduler callbacks, what got stronger from the last start, the forecast history in schema 7).
- No A-item is added: A47–A52 hold the model, and phases.md holds P8's screens.
- `docs/architecture/` changes with the code: `model.md` (PR 1; PR 3 removes "no caller before P8"), `layout.md` and `pages.md` (PR 2, PR 4, PR 5), `entities.md` (PR 3), `sync.md` (PR 3: the cleared stores), `quality-gates.md` (PR 2, PR 4).
- `README.md`: the routes (PR 2), how learning looks on `/` (PR 4).
- `docs/design/README.md` loses the note on the P7 code (PR C).
- `docs/README.md` gets a row for this plan in this pull request; PR 6 removes it.
- `AGENTS.md` does not change.

### 3.8 Spec changes

| #   | Change                                                                                                                                                                                                             | Spec file                    | In PR |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----- |
| S1  | Metrics: "weak kana" in the learning metrics; `introducedIn` in the statistics of the data model                                                                                                                   | `metrics.md`                 | 1     |
| S2  | Frontend: the screens table (`/progress`, the redirect), the navigation, the slices (`pages/progress`, `features/kana-details`), Loading (the dialog's chunk on idle), the dialog in Keyboard                      | `frontend.md`                | 2     |
| S3  | Metrics: "Statistics (`/stats`)" becomes "Progress (`/progress`)", the chart on top with the view-only switch, then the blocks; the kana details dialog; the "Shown in" column                                     | `metrics.md`                 | 2     |
| S4  | The slices and dependency rules gain `features/kana-details`; `pages/stats` is `pages/progress`                                                                                                                    | `architecture.md`            | 2     |
| S5  | Budgets and tests: the dialog and the Progress route out of the initial chunk (`check-budget`), the e2e list                                                                                                       | `quality.md`                 | 2     |
| S6  | Learning: a section "Forecast" (what is forecast, its states, the history: records, settling, the correction) and "What got stronger" (since the last start)                                                       | `learning.md`                | 3     |
| S7  | Storage: the store `forecasts`, schema 7 in "Schema changes", what clears it (reset, sign-out, another account, account deletion) and what keeps it                                                                | `storage-sync.md`            | 3     |
| S8  | Learning: "`/` screen" becomes the home (the reason and its order, nothing to do, the forecast, the path, the outline, what got stronger, the streak, the track and the katakana suggestion); the chart leaves `/` | `learning.md`, `frontend.md` | 4     |
| S9  | Budgets: the home's insights within 300 ms of the model chunk at 4× (`home-cost.spec.ts`)                                                                                                                          | `quality.md`                 | 4     |
| S10 | Learning: the session summary (the forecast change, the details, back to `/`, Continue with nothing to do) and the session screen of the export; "Leave session" returns home                                      | `learning.md`, `frontend.md` | 5     |
| S11 | The "Closed" line of P8; the "End of P8" budget column                                                                                                                                                             | `phases.md`, `quality.md`    | 6     |

## 4. Design brief

The design session (M1) is drawn in a workbench artifact and moved into the design-system artifact, and PR D exports it ([design workflow](docs/design/workflow.md)). This section is its brief: what each screen can show, every state it has, and proposals. **The proposals are not decisions:** the session may draw something else, and the export decides. PR D wrote the numbers of the design decisions (140–152) into the last column of 4.2; PR C wrote the number of row o.

### 4.1 Data and states by screen

Names are those of [section 3](#3-decisions) and of `@nekotype/model`.

**Home `/` (desktop and phone)**

- Data: `reasonAt(now, track)` → `Reason` (`review.due`, `weak.keys`, `learning.learning`, `new.key` and `new.row`, `none.nextAt`); `insights` → `outline` (`reviews`, `learning`, `introductions`), `stronger` (`Stronger`: `key`, `from`, `to` as `ChartState`), `forecast` (`ShownForecast`: `row`, `low`, `median`, `high`, `basis`); `pathOf(view, track)` → blocks and rows (`category`, `state`, `introduced`, `learned`, `total`, `head`, `current`); the current streak; `view.suggestKatakana`, `view.introduced`; `learn.track`; `learnStatus`; the reserved notice line (load error, storage, sign-in notices).
- States:
  - H1 normal, for each reason: `review`, `weak`, `learning`, `new` (with a row of the other track too);
  - H2 the first visit until the first answer: no session yet (`stronger` is `first`), the reason `new` with the vowels, the forecast from the model's prediction;
  - H3 the insights pending: Continue and the reason work, the outline, what got stronger and the forecast are not there yet;
  - H4 little data: the forecast's `basis` is `model` (fewer than 20 answers on learning kana) or `habits` (fewer than 3 settled forecasts);
  - H5 no forecast: `beyond` (more than 60 sessions);
  - H6 the track fully introduced: `complete`, every block done;
  - H7 nothing to do: `none` with the time of the next review (today, tomorrow, later), with and without the katakana suggestion;
  - H8 the katakana suggestion;
  - H9 the track switched to katakana: four blocks, extended included;
  - H10 what got stronger is empty (a session that raised nothing), and long (a first session that introduced many kana);
  - H11 the streak at 0 after a missed day; low = high in the forecast's range;
  - H12 loading, the load error with Retry, storage unavailable, the sign-in notices;
  - switched off: P11 the first visit; P12 "words you can read now".

**Progress `/progress`**

- Data: `cellInfos(track, view, now)` per kana (`state`, `due`, `dueAt`, `opensNext`, `answers`, `medianMs`, `accuracy`); the view-only track; the statistics of today's `/stats` (current and best streak, active days of 30, the activity map, mastered per track, sessions started and finished, the answer time by day).
- States: normal; no data (the `EmptyState` of decision 130); loading; load error; a track not started (every cell locked); switched off: P11 the entry to the placement test.

**Kana details dialog**

- Data: `KanaView` (`state`, `dueFrom` with the clock, `nextReviewAt`, `stability`, `recall` (n of 10), `medianMs`, `accuracy`, `recognitions`, `recognitionErrors`, `confusions` as `{ key, count }`), the kana, `displayRomaji`.
- States: learning with fewer than 10 recall answers; learned with its next review date; due now; mastered; no confusions; no recognition answers; switched off: P9 the stroke order, P10 the sound, P11 the mnemonic.

**Session summary**

- Data: `SessionSummary` (`introduced`, `learned`, `faster` and `slower` as `{ key, from, to }`, `mixups` as `{ key, chosen }`, `errors`), `ForecastChange` (`before`, `after`), whether Continue can start ([D2](#d2-nothing-to-do)).
- States: the change on the same row; the row opened during the session; no `before`; `after` pending, `beyond` or `complete`; nothing to list (`isEmptySummary`); the summary chunk loading and failed (as now); nothing left to do; switched off: P12 the words the learner can read.

**Session screen**

- Data: `TaskView` (introduction, recall, recognition), `Choice`, `Notice`, `Phase`, the task number of `total`.
- States: as `KanaTask` draws them today (introduction with the ghost hint, recall with the buffer and the rejected key, Esc and the touch "show the romaji", the right and the wrong answer, recognition and its wrong choice waiting for Enter, the hidden tab, the window without focus); switched off: P9 contrast, transfer, build, the fluency run and the feedback that teaches with its re-check; P10 the sound in tasks.
- Rule: a keystroke of a recall task renders nothing; the screen changes through classes, text and transforms ([Frontend](docs/spec/frontend.md), "Hot path").

**Navigation and settings**

- Navigation: links to `/`, `/progress`, `/settings`; the `en`/`ru` switch; the sign-in link (guest, expired session, hidden after sign-in and on previews); hidden during a session; the footer with `about`.
- Settings: switched off: P10 the sound setting.

### 4.2 Proposals

| #   | Item                   | Proposal                                                                                                                                                                                                                                                     | Decision |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| a   | Home: what comes first | Continue with its reason as one block, the outline next to it; under it the forecast with the path; then what got stronger. The track switch and the streak sit at the top, quietly. No chart                                                                | 140      |
| b   | Reason copy            | The texts of [D1](#d1-the-reason-for-continue)                                                                                                                                                                                                               | 140      |
| c   | Nothing to do          | The reason's line takes Continue's place with the time of the next review; with the katakana suggestion, its button is the primary action                                                                                                                    | 141      |
| d   | Forecast               | A range naming the row (`the s row: in 2–4 sessions`); low = high as one number with "about"; `model` and `habits` marked as a rough estimate; `beyond` as "no forecast yet"; `complete` as "every kana of the track is open"                                | 142      |
| e   | Path                   | The blocks in a row (`basic · voiced · combinations · extended`, the chart's block names); the current block open on its rows with their counts; the current row marked as the learner's place; a block opens with Enter or Space                            | 143      |
| f   | What got stronger      | The kana as buttons, grouped by `to` (new, learned, mastered, stronger); each opens the details; hidden on the first visit                                                                                                                                   | 144      |
| g   | Streak                 | `streak: N days` by the track switch; hidden before the first answer                                                                                                                                                                                         | 140      |
| h   | Katakana suggestion    | A line under the track switch with `start katakana`; no dismiss ([Q1](#q1-can-the-katakana-suggestion-be-hidden))                                                                                                                                            | 145      |
| i   | Progress               | The title, one view-only track switch for the chart and the answer-time chart, the chart (the tooltip stays, activation opens the dialog), then the grid of decision 137                                                                                     | 146      |
| j   | Kana details dialog    | The kana large with its romaji; the state and the next review; the recall line; the confusions; the recognition accuracy; places for the stroke order (P9), the sound (P10) and the mnemonic (P11) drawn switched off                                        | 147      |
| k   | Summary                | The forecast change on top, medians or ranges as the session decides ([Q2](#q2-the-forecast-change-in-the-summary)); the lists as now, each kana a button to the details; Continue (Enter) and a second action home                                          | 148      |
| l   | Session screen         | `KanaTask` as the centre; the session line and "Leave session" as now; the P9 task types and the P10 sound drawn on the same screen, switched off                                                                                                            | 149      |
| m   | Navigation             | `learn · progress · settings` / `обучение · прогресс · настройки`; the rest as now                                                                                                                                                                           | 150      |
| n   | Settings               | The sound setting drawn switched off (P10)                                                                                                                                                                                                                   | 151      |
| o   | Catch-up with P7       | Done before the session by the clean-up (M0, PR C), as the P7 code is: `KanaChart` draws `learned` (was `confident`); no `review (N)`; `due: N` in the progress line, which item a replaces with the reason; the summary sections `introduced` and `learned` | 139      |
| p   | Later phases           | Each switched-off state of P9–P12 is in the previews behind the DemoBar and named with its phase, so the phase turns it on without redrawing the screen                                                                                                      | 152      |

**Constraints for the session:**

- one dark theme; colours, sizes and motion only from tokens;
- `KanaTask` stays the learning task's component;
- CSS within 10 KB gzip in the app (initial CSS line 8.5 KB, [D14](#d14-budgets)); fonts within their budgets, a new glyph listed under "Glyphs to add to subsets";
- every string in en and ru with key parity; UI copy in lower case as now;
- everything works from the keyboard, and every control has a name for screen readers;
- no data beyond section 3: a screen that needs other data stops the session and goes to the maintainer before the export.

## 5. Answered questions

### Q1. Can the katakana suggestion be hidden?

**Question.** The suggestion appears once the 46 basic hiragana are learned, while hiragana is selected and katakana has not started. Can the learner hide it, and where would that be stored: nowhere, on the device (`meta`), or synced (`settings.learn`)?

**Answer (2026-11-23):** it cannot be hidden. It ends once katakana has an introduced kana; nothing is stored ([D5](#d5-the-katakana-suggestion)).

### Q2. The forecast change in the summary

**Question.** phases.md gives the summary's example as medians ("about 3 sessions → about 2"); ADR 100 point 6 says a forecast is "never one number". Medians, ranges, or the design's choice?

**Answer (2026-11-23):** the design session decides; the data carry both ([D9](#d9-the-forecast-on-the-home-and-in-the-summary)). If the export shows medians, its ADR records the amendment of ADR 100 point 6 for this comparison.

**Chosen (2026-11-24):** medians, `3 → 2 sessions` under `the whole m row opens in about` (decision 148); ranges were drawn and set aside. [ADR 108](docs/adr/108-p8-design-export.md), point 8, amends ADR 100 point 6 for this comparison.

### Q3. What "done" means on the path

**Question.** Is a row done when all its kana are introduced, or when all are learned?

**Answer (2026-11-23):** introduced. The state never turns back, matches the forecast's target, and gives one current row ([D4](#d4-the-path)).

### Q4. The track switch on Progress

**Question.** Does the switch on "Progress" change `learn.track`, only the chart shown, or is there no switch and both charts are shown?

**Answer (2026-11-23):** only the chart shown. "Progress" opens on `learn.track`; where new kana come from is decided on the home ([D11](#d11-progress-and-the-redirect-from-stats)).

## 6. Maintainer's manual steps

### M0. The clean-up of the design system — before M1

An agent cleans the design-system artifact by the [design workflow](docs/design/workflow.md) ([ADR 106](docs/adr/106-design-sessions-in-a-workbench-artifact.md), point 6), with a workbench artifact `Nekotype · design clean-up`:

- the catch-up with the P7 code (row o of 4.2): `KanaChart` draws `learned`, and a kana's data are those of `cellInfos` (no Leitner box; `opensNext` for `nextUnlock`); no `review (N)` and no review session; `due: N` in the progress line; the summary sections `introduced` and `learned`; the settings' text of the target answer time; the session line of one kind of session;
- the phase numbers of ADR 099 in the guidelines and previews: the sound P10, the report dialog P12, the data on the device P14;
- the typing trainer's leftovers: the cover, `/stats#typing`, props and styles nothing uses, notes on what left with it;
- the notes of earlier sessions ("proposal", "open question") and history in the guidelines, which stays in `decisions.md`;
- the screens' script in one file that every screen preview loads, instead of a copy in each.

The workbench shows "now" and "after" of each screen that changes, and two or three variants of the cover. After the maintainer approves, the agent moves the result into the design-system artifact as design decision 139. Check after approval: no preview draws `confident`, `review (N)` or a Leitner box, and no guideline names a phase by its number before ADR 099. The workbench is deleted after PR C is merged.

### M1. The design session — after PR C, before PR D

An agent runs the session by the [design workflow](docs/design/workflow.md) in a workbench artifact `Nekotype · P8 design`, by [section 4](#4-design-brief), in five rounds:

1. the home on desktop and phone through H1–H12 (4.2 a–h);
2. "Progress" on desktop and phone, and the kana details dialog in its states (i, j);
3. the session summary in its states and the session screen (k, l); Q2 is settled here;
4. the navigation and the settings (m, n);
5. the switched-off states of P9–P12 on every screen (p).

Each round starts with the agent's questions or, when the maintainer asks for it, with the variants the agent recommends; the maintainer's remarks come in the chat. After the last round the agent moves the approved variants into the design-system artifact as decisions from 140. Check after approval: `decisions.md` has the new decisions after 139; no preview draws `/stats`; each switched-off state is in a preview and names its phase. The workbench is deleted after PR D is merged.

### M2. Sync before PR 3 is merged

PR 3 raises `SCHEMA_VERSION` to 7, and the reset deletes what a device has not sent. On every device where the maintainer is signed in: open `/settings` online and wait for `synced`. Then merge PR 3.

### M3. Production check of PR 3

After PR 3 is deployed:

1. On `https://nekotype.pages.dev` the application starts as a guest with default settings (the reset).
2. Sign in: the log comes back by the pull, the home and `/progress` show the account's progress.
3. A session ends with `synced` in `/settings`.
4. Write "done" with the date under PR 3 in [section 7](#7-pull-requests).

### M4. Production check of the screens — after PR 5, before PR 6

On a desktop and a phone: the home shows the reason, the outline, the forecast (or its absence), the path, what got stronger and the streak; Continue runs a session; the summary shows the forecast change and returns home; a kana opens its details from the home, the summary and the chart, and Esc closes them; `https://nekotype.pages.dev/stats` lands on `/progress`. Write "done" with the date under PR 5.

## 7. Pull requests

**Cards 1–6 follow the export** of PR D (decisions 140–152 in [`docs/design/source/decisions.md`](docs/design/source/decisions.md), [ADR 108](docs/adr/108-p8-design-export.md)); the maintainer approves them with PR D. A screen is built as the export's `README.md` describes it, with its strings; the previews in the design artifact show every state. No code pull request starts before PR D is merged.

Common to all: the branch is cut from fresh `main`; the acceptance items are those of [phases.md](docs/spec/phases.md), numbered in the [table at the end](#acceptance-items-and-pull-requests); sizes are changed lines with tests, a guide to what one executor session holds.

| PR  | Depends on | Can run in parallel with |
| --- | ---------- | ------------------------ |
| C   | M0         | —                        |
| D   | C, M1      | —                        |
| L   | D          | 2                        |
| 1   | D, L       | 2                        |
| 2   | D          | L, 1, 3                  |
| 3   | 1, M2      | 2                        |
| 4   | 2, 3, M3   | —                        |
| 5   | 4          | —                        |
| 6   | all, M4    | —                        |

Sign-in is hidden on previews: what needs a session is checked locally (`pnpm run dev` with `pnpm run dev:api`) and, after the merge, by the maintainer on production.

### PR C — Design clean-up export

- **Branch:** `docs/design-cleanup`. **Depends on:** M0 (approved by the maintainer).
- **Goal.** The cleaned design system exported into `docs/design/source/`, so that the P8 session starts from a design that matches the code.
- **Docs:** `docs/design/source/` (`README.md`, `decisions.md` with decision 139, the component guidelines, `bundle.js`, `bundle.css`, `index.d.ts`); `docs/design/README.md` (the note on the P7 code goes, decisions up to 139); `docs/design/workflow.md` (the screens' script in one file); ADR 107; in this plan: 139 in the last column of row o.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm run docs:check` passes; `git grep -n -i -E "confident|review \(|nextUnlock|Leitner" docs/design/source` finds only `decisions.md`; the workbench is deleted after the merge.
- **Size:** documents only.

### PR D — Design export

- **Branch:** `docs/p8-design`. **Depends on:** PR C; M1 (approved by the maintainer).
- **Goal.** The approved design exported from the artifact into `docs/design/source/` (never edited there by hand), and this plan brought in line with it.
- **Docs:** `docs/design/source/` (`README.md`, `decisions.md`, `tokens.json`, the component guidelines, `bundle.js`, `bundle.css`, `index.d.ts`, new or removed component folders); `docs/design/README.md` (the decisions it holds); ADR 108; the token CSS and `tokens.test.ts` only if tokens change; in this plan: the decision numbers in the last column of 4.2, the rewritten cards 1–6, and a line under Q2 with the format chosen.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm run docs:check` passes; every row of 4.2 names a decision; cards 1–6 name the export's components and strings; the maintainer approved the rewritten cards.
- **Size:** documents only.

### PR L — Five kana learning at once

- **Branch:** `p8-learn-max`. **Depends on:** PR D; the maintainer's consent to the constant (given on 2026-11-24).
- **Goal.** `LEARN_MAX` 4 → 5, so a row of five kana opens in one go and a first session introduces the five vowels. A change to a constant of ADR 100, so a pull request of its own outside rule 3c, with the run of `pnpm --filter @nekotype/sim run p7` before and after in the description (P7 plan, rule 3b). Pressure keeps its formula: `max(1, round(LEARN_MAX − p × (LEARN_MAX − 1)))`, 5 → 1.
- **Changes:** `packages/model/src/constants.ts`; the model tests that count the limit (`learner.test.ts`, `planner.test.ts`, `forecast.test.ts`, `index.test.ts`); `apps/web/src/pages/learn/model/session.test.ts` (the five vowels in a first session; the confusion test's seed).
- **Acceptance:** none of P8; every criterion of the P7 acceptance (ADR 100, point 10) that the sim measures still holds.
- **Docs:** ADR 109 with ADR 100's Status line and its row in `docs/adr/README.md`; `docs/spec/learning.md` (Unlocking, Memory, Constants); A47 in `docs/spec/decisions.md`; this plan.
- **Preview URL:** a fresh start: the first session introduces あ い う え お one after another before any other task.
- **Done when:** the model and web tests pass; the `p7` tables before and after are in the description and meet the P7 lines (day ≤ 8, review retention ≥ 90%, ≤ 10 min a day, slow learners within 2 points, forecast off by ≤ 1); CI is green with the latency gate.
- **Size:** about 150 lines, most of them documents.

### PR 1 — The home's data in the model

- **Branch:** `p8-01-model-home`. **Depends on:** PRs D and L.
- **Goal.** `reasonOf`, `isWeak`, `introducedIn` and `seededRng` ([D1](#d1-the-reason-for-continue), [D10](#d10-forecast-history)).
- **Creates:** `packages/model/src/home.ts`, `src/rng.ts` and their tests.
- **Changes:** `src/constants.ts` (`WEAK_*`), `src/stats.ts` and `src/fold.ts` (`introducedIn`), `src/view.ts` (`KanaView.introducedIn`; `stability` for every introduced kana, [D12](#d12-the-kana-details-dialog)), `src/index.ts`, `src/testing/synthetic-log.ts` (uses `seededRng`), `src/fold.properties.test.ts` if it lists the statistics it compares.
- **Tests:** each kind of reason on built states, and `review.due` equal to the kana with `dueFrom ≤ now`; `none` with `nextAt` the smallest `dueFrom`; a property over 200 seeded logs (prefixes of `syntheticLog` and the fold's generator): the kind of the reason agrees with `nextTask`'s first task; `new` of the other track under `TRACK_LAG`; weak at the boundaries (4 and 5 recalls, accuracy 0.8 and 0.7, confusions 1 and 2), a learned kana never weak; `introducedIn` from an `intro` and from an answer that introduces, copied by `snapshot()` and `clone()`, converging across devices; `syntheticLog({ answers: 1000, seed: 1 })` unchanged by the move of the generator; a learning kana's view has its memory's stability and `nextReviewAt` null; `strongerSince` lists the same kana as before.
- **Acceptance:** 2 (model side), 8 (the data of settling).
- **Docs:** ADR 110; S1; `docs/architecture/model.md`.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm --filter @nekotype/model test` passes with the coverage thresholds; `verify:quick` passes; budgets unchanged.
- **Size:** about 700 lines.

### PR 2 — Progress and the kana details dialog

- **Branch:** `p8-02-progress-details`. **Depends on:** PR D.
- **Goal.** `/progress` as decision 146 draws it, `/stats` redirected, the navigation of decision 150, and the kana details dialog of decision 147 opened from the chart, which stays on `/` until PR 4 ([D11](#d11-progress-and-the-redirect-from-stats), [D12](#d12-the-kana-details-dialog)).
- **The export** ([README](docs/design/source/README.md), "Progress" and "Kana details"; `Nav`, `KanaChart`):
  - Progress: the title `Progress` / `Прогресс` with one view-only `Segmented` on its right (`track shown` / `показать дорожку`); the chart of that track; then the blocks of decision 137. The answer-time chart loses its own track switch and follows the page's: its caption starts with the track's name; a track without answers reads `no katakana answers yet` / `ответов по катакане пока нет` (one key per track). Before the first answer: the chart, every kana locked, and the `EmptyState` of decision 130 under it. Loading and the load error take the place under the title.
  - The dialog: the shared `Dialog`; the title is the kana (`jp-test-sm`) and its romaji (`mono-romaji`, `fur-dim`); the rows of [D12](#d12-the-kana-details-dialog) as a `dl` of `ui-caption` captions and `ui-body` values (`kd__rows` of the export's screens), the memory stroke 2px, at most 240px, `line-strong` with a `fur-dim` fill, `fur` when mastered.
  - `KanaChart`: activation of an introduced cell calls `onOpen(key)`; the cell carries `aria-haspopup="dialog"`, no `aria-expanded`; no panel, no Esc of its own; the tooltip stays.
  - The navigation: `learn · progress · settings` / `обучение · прогресс · настройки`; the open link `fur` with `text-decoration: underline var(--stroke-mark) var(--eye)` and `text-underline-offset: 5px`, as the selected language; `aria-current="page"` as now.
- **Creates:** `features/kana-details` (index, model, host, dialog, lines, tests); `pages/progress` (from `pages/stats`, with `lib/chart.ts` from `pages/learn`); `shared/i18n/parts/progress` and `parts/details` (en, ru); `entities/learn/lib/romaji.ts`.
- **Changes:** `app/route-paths.ts` (`ROUTE_REDIRECTS`), `routes.tsx`, `route-view.tsx` (titles), `App.tsx` (navigation, the host), `prefetch.ts`; `shared/lib/router.ts` (the redirect on start and `popstate`); `public/_redirects`, `redirects.test.ts`; `scripts/smoke-deploy.mjs` and its test; `scripts/check-budget.mjs` and its test (`DETAILS_ENTRY`); `shared/ui/kana-chart.tsx` (no inline panel, `onOpen`); `pages/learn` (the chart opens the dialog, `displayRomaji` from `entities/learn`); the navigation's styles (the open link); `shared/i18n` (keys of D11, D12 and the strings above; the part `stats` renamed); e2e: `stats.spec.ts` becomes `progress.spec.ts` with the chart tests of `learn-chart.spec.ts`, `routes.spec.ts` (`/stats` → `/progress`, the navigation), `sync/guest-sign-in.spec.ts`, `sync/two-devices.spec.ts` and `e2e/lib/sync.ts` (the path).
- **Deletes:** `pages/stats`, `pages/learn/lib/romaji.ts` and `lib/prompt/canonical.ts` (moved), `KanaChartPanel`.
- **Tests:** the redirect lists equal the code; the router replaces `/stats` and `/stats/`; the smoke test expects 301 to `/progress`; the dialog opens from a chart cell by click, Enter and Space, Esc closes it and the focus returns to the cell, its title names the kana, a locked cell opens nothing, `openKanaDetails` does nothing while `immersive`; the memory row reads `holds less than a day` under one day and `holds about {n} days` above, without ` · mastered from 21 days` when mastered; the Progress switch never writes `learn.track` and the answer-time chart follows it; the budget test fails when the dialog is in the initial chunk or statically imported by a route; the Progress page renders loading, error, no data and the blocks; the open navigation link has `aria-current="page"`.
- **Acceptance:** 6, 7, 14 (Progress and the dialog).
- **Docs:** ADR 111; S2–S5; `README.md` (the routes); `docs/architecture/` (`layout.md`, `pages.md`, `quality-gates.md`).
- **Preview URL:** `/progress` shows the switch by the title, the chart and the statistics; switching the track changes the chart and the answer time, not `/`; `/stats` lands on `/progress`; a chart cell opens the dialog by mouse and keyboard, Esc closes it; the navigation reads `learn · progress · settings` with the open page underlined; `/` still has its chart.
- **Done when:** `verify:quick` passes; CI is green with the e2e; the initial JS and CSS within D14; the dialog and Progress are lazy chunks.
- **Size:** about 1,500 lines, much of it moved.

### PR 3 — Insights and the forecast history

- **Branch:** `p8-03-insights`. **Depends on:** PR 1, M2 before the merge.
- **Goal.** The insights of [D8](#d8-insights-where-and-when) with what got stronger ([D3](#d3-what-got-stronger)) and the forecast history ([D10](#d10-forecast-history)), not yet shown by any screen.
- **Creates:** `entities/learn/model/insights-state.ts`, `entities/learn/model/insights.ts`, `entities/learn/model/forecasts.ts` (the store's reads and writes) and tests.
- **Changes:** `entities/learn/model/learn-store.ts` (`startSnapshot`, `version`, `loadedModel`, the dynamic import of `insights.ts`, the probe mark, cancelling at `startSession`), `model/log.ts` (`clearLog` clears `forecasts`), `entities/learn/index.ts`; `shared/lib/idb/schema.ts` (7, `forecasts`; the `PRE_RELEASE` comment says P14); `features/sync/model/account.ts` (`USER_STORES`); `scripts/check-budget.mjs` and its test only if `insights.ts` needs a check like the model's.
- **Tests:** with a held fake scheduler nothing is computed until its callbacks run, and Continue's reason is there before; step 1 publishes the outline and what got stronger, step 2 the forecast; a stale request does nothing; `startSession` drops a pending request; the same state gives the same outline and forecast; `startSnapshot` after a full fold, after an incremental `start`, after a pull, and null without a `start`; what got stronger after a first session lists the introduced kana; the history: created once per row and day, never for `beyond` or `complete`, settled when the row's last kana is introduced with `actual` from `introducedIn`, deleted when `actual < 1`, passed in order of `at`, the correction applied from the third settled forecast (a fixed state with three settled records of ratio 2 doubles the median), trimmed to 10 settled and 60 open; reset, sign-out and account deletion clear `forecasts`, the guest merge keeps it; a database of schema 6 is reset to 7.
- **Acceptance:** 3 and 4 (computation), 8, 9.
- **Docs:** ADR 112; S6, S7; `docs/architecture/` (`entities.md`, `model.md`, `sync.md`).
- **Preview URL:** the app starts with empty data (schema 7) and behaves as before.
- **Done when:** `verify:quick` passes; CI is green with the latency gate (it runs: `entities/learn/model/` changed); initial JS and CSS within D14; after the merge the maintainer does M3.
- **Size:** about 1,200 lines.

### PR 4 — The home

- **Branch:** `p8-04-home`. **Depends on:** PRs 2 and 3, M3.
- **Goal.** `/` as decisions 140–145 draw it, on D1–D9, without the chart.
- **The export** ([README](docs/design/source/README.md), "Learning home"):
  - Layout: on a desktop a grid of four columns, the action and "since the last session" in the left two, the path in the right two (the areas `act act path path` / `str str path path`), `space-12` apart; below 640px one column: action, path, since the last session. At the top the track switch and the streak (`streak: 6 days`, the number in `mono-romaji`).
  - The action: the reason in `ui-title` (D1's copy; the weak kana in a `lang="ja"` span); `continue` (`primary`, `lg`, with `Kbd enter` except on a phone) with the outline after it (D7's copy, `ui-label`, `fur-dim`, numbers `fur`); the reserved `Notice` line as today. `continue` takes focus when the screen is ready. Nothing to do (decision 141): the reason and `next review: {when}` (`ui-body`, `fur-dim`) under it, no `continue`; with the suggestion, `start katakana` (`primary`, `lg`) instead.
  - The katakana suggestion (145): over the reason, the line `The basic hiragana are learned. You can start katakana.` / `Основная хирагана выучена. Можно начинать катакану.` and `start katakana` / `начать катакану` (`secondary`, `sm`).
  - The forecast (142), one line under `path · {track}` (`ui-heading`): `the whole {head} row opens in {low}–{high} sessions` / `весь ряд {head} откроется через {low}–{high} сессии`, the vowels `all the vowels open in …` / `все гласные откроются …`; low = high `… in about {n} sessions` / `… примерно через {n} сессий` (plural keys); `basis` `model` or `habits` add `A rough estimate for now. It gets more precise as you answer.` / `Пока это грубая оценка. Она уточнится по вашим ответам.` (`ui-caption`); `beyond` `no forecast for the {head} row yet` / `для ряда {head} прогноза пока нет`; `complete` `every hiragana is open` / `вся хирагана открыта` (`every katakana is open` / `вся катакана открыта`); pending keeps the line's height.
  - The path (143): the blocks in a row as buttons (`aria-expanded`, `aria-controls`), each with its name (the chart's block names), `{introduced}/{total}` in `mono-small` and a 2px tick per row (`done` `fur-dim`, `current` `eye`, `locked` `line-strong`), widths in proportion to their rows; the current block open. The open block is an `ol` of columns: the head on its tick (the same colours), the kana downwards in `jp-body` (introduced `fur-dim`, locked `fur-faint`, the current row's introduced `fur`), `{introduced}/{total}` under the current row; `aria-current="step"` and the label `{row}: {n} of {total} open, you are here` / `{row}: открыто {n} из {total}, вы здесь`.
  - Since the last session (144): `since the last session` / `с прошлой сессии` (`ui-heading`), then the groups `new · learned · mastered · stronger` / `новые · выучены · освоены · окрепли` (`ui-caption`) of [D3](#d3-what-got-stronger)'s list: new = `from` locked, learned = `to` learned, mastered = `to` mastered from below, stronger = `from` = `to`. Each kana is a chart cell button (`jp-cell`, `jp-cell-sm` for two characters) with the state it has now (new: learning; stronger: its own) that opens the dialog; `aria-label` `{kana}, {romaji}, {state}: details` / `…: подробнее`. Empty: `no changes since the last session` / `с прошлой сессии изменений нет`; pending keeps a height; not shown on the first visit.
- **Creates:** `pages/learn/model/home.ts` (the page model: the reason with `REPLAN_MS`, `canStart`, the path, the streak, the suggestion, the requests of insights), the home's views (the action, the forecast, the path, since the last session), `entities/learn/lib/path.ts`, `apps/web/e2e/home-cost.spec.ts`, `apps/web/e2e/home.spec.ts` and tests.
- **Changes:** `pages/learn/ui/learn-page.tsx` (the home; the chart and its strings leave); `pages/learn/lib/constants.ts` (`REPLAN_MS`); `shared/i18n` (the strings above, D1's and D7's copy); `app/styles/index.css` (the home's styles; the chart's to the Progress page but the cell and its state styles, which the home draws, [D14](#d14-budgets)); `playwright.latency.config.ts` (`testMatch`), `scripts/latency-gate.mjs` and its test (`LATENCY_PATHS` gains `e2e/home-cost.spec.ts`); e2e that wait for `learn-mastered-count` or read `learn-due` (`learn-session`, `routes`, `latency`, `sync/*`, `e2e/lib/sync.ts`) wait for the home's new test id; `learn-chart.spec.ts` deleted if PR 2 left anything in it.
- **Tests:** DOM tests of the home in each state of 4.1 (H1–H12), from a fake learn store: the reason's copy per kind, the weak kana listed, Continue absent with `none` and Enter starting nothing, the time of the next review, the suggestion switching the track and becoming the primary action with `none`, the forecast's lines (a range, about, the rough estimate, none, complete), the path's states and its labels, the groups of what got stronger and a cell opening the dialog; `pathOf` (`current` equals `nextRow`, a dakuten kana out of order keeps its row locked, blocks per track); the page model plans again on its tick and sets nothing when the reason did not change; e2e: a fresh home reads "next: the vowels" and a session introduces them; `home-cost.spec.ts` within 300 ms at 4×.
- **Acceptance:** 1, 2, 3, 5, 14 (the home).
- **Docs:** S8, S9; `README.md` (how learning looks on `/`); `docs/architecture/pages.md`.
- **Preview URL:** a fresh start shows the first visit (`next: the vowels`); after a session, the reason, the outline, the forecast, the path and what got stronger as cells; Continue by Enter; a cell of what got stronger opens its details; on a phone one column in the export's order.
- **Done when:** `verify:quick` passes; CI is green with the latency gate and `home-cost.spec.ts`; initial JS ≤ 31.0 KB and CSS ≤ 8.5 KB.
- **Size:** about 1,400 lines.

### PR 5 — The session screen and the summary

- **Branch:** `p8-05-session-summary`. **Depends on:** PR 4.
- **Goal.** The session screen of decision 149 and the summary of decision 148 ([D9](#d9-the-forecast-on-the-home-and-in-the-summary), [D13](#d13-the-session-screen-and-the-summary)).
- **The export** ([README](docs/design/source/README.md), "Learning session" and "Session summary"; `KanaTask`):
  - Ticks: under the session line a row of 2px ticks, `stroke-mark` apart, one per task of `SESSION_TASKS`: before `n` `fur-dim`, `n` `eye`, after it `line-strong`, a number of `misses` `miss`; `aria-hidden`. `KanaTask` takes `session.misses`; the ticks render with the task, so a keystroke still renders nothing.
  - The forecast change on top: `the whole {head} row opens in about` / `весь ряд {head} откроется примерно через` (`ui-caption`, `fur-dim`), under it `{before} → {after} sessions` (`mono-stat`; `{before}` and the arrow `fur-dim`, the unit in `mono-romaji` with plural keys); its `aria-label` `before the session: {before}, now: {after} sessions` / `до сессии: {before}, теперь: {after} …`. A row opened in the session first says `the {head} row is fully open` / `ряд {head} открыт целиком`; no `before`: `{after}` alone; `beyond` and `complete` as on the home; pending keeps a height. Medians: `ShownForecast.median` ([ADR 108](docs/adr/108-p8-design-export.md), point 8).
  - The sections: `new` and `learned` (`introduced` reads `new` in English too) as chart cells under captions, as on the home; `faster`, `slower`, `confused` as now; every kana a button to the dialog (`aria-haspopup="dialog"`, at least `touch-min` under `pointer: coarse`).
  - Actions: `continue` (`Kbd enter`) and `home` / `на главную` (`secondary`; `to the table` goes). With nothing left to do (D2): no `continue`; `nothing to review now · next review: {when}` and `home` as the primary action with `Kbd enter`.
- **Changes:** `pages/learn/ui/session-screen.tsx`, `summary-screen.tsx`, `summary-panel.tsx`, `model/session.ts` (`before` of the forecast at `start()`; `misses` appended when an answer is recorded), `lib/summary.ts` (`ForecastChange`); `shared/ui/kana-task.tsx` (the ticks); `shared/i18n`; `e2e/learn-session.spec.ts`.
- **Tests:** `session-screen.test.tsx` still shows 0 renders per recall keystroke and at most 1 on the answer, with the ticks drawn; a wrong answer marks its tick `miss` when the task is answered and not on the rejected key; the session never calls `requestInsights`; `before` is captured only when the forecast was ready for the session's track; the summary in each state of 4.1, the medians in the forecast change; Continue on the summary with nothing to do starts nothing and `home` takes Enter; a kana of the summary opens the details and the focus returns; "Leave session" and `home` show the home; e2e: home → session → summary → home finds a kana under what got stronger and opens it.
- **Acceptance:** 4 (hot path), 10, 11, 14 (summary and session).
- **Docs:** S10; `docs/architecture/pages.md`.
- **Preview URL:** a session by keyboard and by tap with the ticks under the session line, a wrong answer's tick turning red; the summary with `3 → 2 sessions`, the kana as cells and `home`; back home, the kana of the session under what got stronger.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; budgets within D14; after the merge the maintainer does M4.
- **Size:** about 900 lines.

### PR 6 — Close the phase

- **Branch:** `p8-06-close`. **Depends on:** every other pull request, M4.
- **Does:**
  - the leftovers audit, with its command and result in the description: `git grep -n -i -E "/stats|pages/stats|confident|review \(|learn-mastered-count|learn-due|KanaChartPanel|KanaChartDetails|renderDetails|nextUnlock|to the table"` over `apps`, `packages`, `scripts`, `docs/spec`, `docs/architecture`, `docs/design/source`; each hit removed or explained (the redirect, migrations, research, ADRs);
  - the export against the code: each screen of the code matches its preview in the design artifact — the home, Progress, the dialog, the session with its ticks, the summary, the navigation (a list in the description); the states of P9–P12 are in the previews under `later` (decision 152) and none of them is in the code;
  - `pnpm run build && pnpm run budget` and the CI figures of the latency, `model-cost` and `home-cost` tests;
  - `docs/research/2026-11-NN-p8-acceptance.md` (the day of the check) with a row per acceptance item, its line, its measure and its proof, and its row in `docs/README.md`.
- **Docs:** S11; `README.md` and `docs/architecture/` reread against the code; `docs/adr/README.md` has ADRs 106–112; this file moved to `docs/archive/p8-plan.md` with a note on top; its row in `docs/README.md` removed.
- **Done when:** every row of the table below names a passing test or check in the description.
- **Size:** about 400 lines, documents.

### Acceptance items and pull requests

The items of the P8 acceptance in [phases.md](docs/spec/phases.md), in its order.

| #   | Acceptance item                                                                                                                   | PR          | Proved by                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| 1   | `/` shows the action with its reason, the forecast or its absence, the path, the outline, what got stronger, the streak, no chart | 4           | home DOM tests per state; `e2e/home.spec.ts`                                               |
| 2   | The state with nothing to offer has a test                                                                                        | 1, 4        | `home.test.ts` (`none`, `nextAt`); the home's DOM test of H7                               |
| 3   | Continue works before the forecast and what got stronger are ready                                                                | 3, 4        | `insights-state.test.ts` with a held scheduler; the home's DOM test of H3                  |
| 4   | Both are computed outside the first render and outside keystroke handlers                                                         | 3, 5        | `insights.test.ts` (scheduler callbacks only); `session.test.ts` (no request in a session) |
| 5   | At 4× they appear within 300 ms of the model chunk for 40,000 answers                                                             | 4           | `e2e/home-cost.spec.ts` in the latency job                                                 |
| 6   | `/stats` redirects to `/progress`                                                                                                 | 2           | `redirects.test.ts`, `router.test.ts`, `smoke-deploy.mjs`, `e2e/routes.spec.ts`            |
| 7   | Neither "Progress" nor the kana details dialog is in the initial chunk, and every budget holds                                    | 2, every PR | `check-budget.mjs` (`DETAILS_ENTRY`, route chunks); the figures of each PR                 |
| 8   | The forecast history is settled when its row is introduced and corrects from the third settled forecast (unit tests)              | 1, 3        | `forecasts.test.ts`, `insights.test.ts`; `forecast.test.ts` (the ratio)                    |
| 9   | A database of schema 6 is reset                                                                                                   | 3           | `database.test.ts`                                                                         |
| 10  | A keystroke of a recall task renders nothing, and the latency test holds                                                          | 5, every PR | `session-screen.test.tsx`; `latency.spec.ts` in CI                                         |
| 11  | An e2e goes home → session → summary → home and finds a kana under what got stronger                                              | 5           | `e2e/learn-session.spec.ts`                                                                |
| 12  | The export matches the code, with the states of P9–P12 drawn and switched off                                                     | D, 6        | ADR 108 and the export; the check of PR 6                                                  |
| 13  | `en` and `ru` keep key parity                                                                                                     | every PR    | the existing parity test                                                                   |
| 14  | Every new screen and the dialog work from the keyboard and are named for screen readers                                           | 2, 4, 5     | DOM tests by role and name; e2e by keyboard                                                |
| 15  | learning.md, metrics.md, frontend.md and storage-sync.md describe the screens and the forecast history of P8                      | 1–5, 6      | S1–S11; the audit of PR 6                                                                  |

## 8. Instructions for executor agents

One executor takes one pull request of section 7.

1. **Read first:** `AGENTS.md`; in this file sections 1, 8 and 9, your card in section 7, the decisions it names in section 3 and the ones they link; for a pull request with screens, section 4 and the export in `docs/design/source/`; the spec sections your card names. Check the Status table: every pull request yours depends on is merged and every manual step it waits for is marked done. If not, stop and tell the maintainer what is missing.
2. **Make no decision this plan does not hold.** Types, names, stores, keys and constants of section 3 are copied as written. How a screen looks is the export's: build what it draws, with its names and strings. If something is missing, ambiguous or turns out wrong against the code, ask the maintainer (in Russian) and wait.
3. **Rules of P8:**
   - a. The design comes first: no code pull request before PR D is merged, and no visual decision outside the export.
   - b. Nothing of P9–P12 is built: their states stay in the design.
   - c. The model's rules and constants do not change. The additions of PR 1 label and count; they choose no task. A change to the planner, the fold's rules or a constant of ADR 100 stops the pull request (P7 plan, rule 3b); such a change is a pull request of its own with a sim run and an ADR, as PR L was.
   - d. Nothing new on the hot path: no insights, planner call, fold or IndexedDB access in a key handler of a task; nothing computes during a session; the render rule (0, at most 1) holds.
   - e. Insights run in the injected `Scheduler`'s callbacks, never in a render.
   - f. The raw keystroke log is never persisted; the forecast history is never synced.
4. **Stay in scope.** Build what your card lists. Anything else you had to touch is named in the pull request description.
5. **Follow `AGENTS.md`:** the code rules (no `any`, no assertions, strings through i18n with `en` and `ru` in parity, injected time and randomness), the layer rules, the hot-path and budget rules. Never bypass a hook.
6. **Budgets.** Run `pnpm run build && pnpm run budget` before and after and write the initial JS and CSS in the description. Above the lines of D14: stop and ask.
7. **Tests.** Write the tests your card lists and name, for each acceptance item you close, the test that proves it. Run the e2e files you touched on Chromium (`pnpm exec playwright test e2e/<file>.spec.ts --project=chromium`), `pnpm run e2e:sync` when a sync e2e changed, and `pnpm run e2e:latency` when `pages/learn`, `entities/learn/model` or `packages/model` changed (CI is the gate). Report results as they are.
8. **Documents** change in the same pull request: the spec items of [section 3.8](#38-spec-changes), the ADR named, `README.md` and `docs/architecture/` when the code they describe changed. A new ADR takes the next free number and a row in `docs/adr/README.md`.
9. **Finish:** when the work is done and `pnpm run verify:quick` passes, commit with a Conventional Commits message, push the branch (the pre-push hook runs the checks) and open the pull request against `main`. Its description lists: what changed, why, anything outside the scope, what to check on the preview URL (from your card), the acceptance items closed with their tests, and the budget figures before and after. No AI attribution in commits or in the pull request. Never merge: the maintainer does.
10. **Mark the plan:** after `gh pr create`, set your row of the Status table to `done` with the pull request number, in a second commit on the same branch (`docs: mark P8 PR n done`).
11. **Communication:** with the maintainer in Russian; code, comments, commits and documents in English.

## 9. Risks

| Risk                                                   | How it shows                                                                                   | What to do                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The design session takes long                          | No code pull request can start                                                                 | The spec puts the design first. M0 is small and goes first; M1 runs in rounds that can be reviewed on different days (ADR 106). PR 1's model work is small and waits with the rest                                                                         |
| The export needs data section 3 does not give          | A screen of the artifact shows a number the model does not compute                             | Section 4's constraint: the session stops and asks before the export. A new contract is added to section 3 by PR D with the maintainer's consent                                                                                                           |
| The line of 300 ms is missed in CI                     | `home-cost.spec.ts` over 300 ms                                                                | Profile first (the fold, the split, step 2). Then split the forecast's ten plays into callbacks of their own (a model function that plays one at a time), and only then a Worker, by an ADR. The estimate is 100–235 ms ([section 2](#2-what-was-checked)) |
| A long task when the forecast runs                     | A click or a key on the home waits up to about 25 ms at 4× (worst measured state about 146 ms) | Accepted: the home has no hot path and Continue's click runs right after. If the latency test or a manual check shows a delay, split the plays as above                                                                                                    |
| The history is off for a learner with several devices  | A pull brings sessions older than a forecast: `introducedIn` counts them, `actual` grows       | Accepted: the correction takes the median of ten ratios. A result below 1 is dropped ([D10](#d10-forecast-history))                                                                                                                                        |
| The schema reset loses unsent progress                 | After PR 3 the account misses the last session of a device                                     | M2. Before the release nobody else uses production ([ADR 061](docs/adr/061-schema-reset-before-release.md))                                                                                                                                                |
| A stale edge copy of `index.html` answers `/stats`     | `/stats` shows the application, not a redirect, for up to 7 days                               | The router's redirect ([D11](#d11-progress-and-the-redirect-from-stats)) sends it to `/progress` on the client                                                                                                                                             |
| The reason changes while the learner reads it          | A learning step passes or a kana becomes due: `learning` turns into `new` or `review`          | The page model plans again every minute; the session follows the planner whatever the label said. The reason is a label (ADR 100)                                                                                                                          |
| `steiger` rejects `features/kana-details`              | The slice has one consumer                                                                     | PR 2 already has two (`pages/learn` through the chart on `/`, `pages/progress`); after PR 4 the home's "what got stronger" and the summary keep `pages/learn` a consumer                                                                                   |
| The chart's styles move while the home still uses them | `/` loses the chart's look between PR 2 and PR 4                                               | PR 2 keeps the styles global; PR 4 moves them when the chart leaves `/`, unless the export keeps chart cells on the home                                                                                                                                   |
| The initial chunk passes 31.0 KB                       | The budget figures of PR 4                                                                     | Stop and ask (D14). Candidates: the home's strings of rare states in a lazy part, the path's rows rendered only when a block opens                                                                                                                         |
| A pull request outgrows its session                    | Well past the size of its card                                                                 | Propose a split to the maintainer instead of cutting scope                                                                                                                                                                                                 |
