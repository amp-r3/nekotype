# P6 plan: learning only

Working file of phase P6 ([phases.md](docs/spec/phases.md), item 7). It tells the executor of each pull request what to build, in which order, and which decisions are already made. It is not part of `docs/`: the last pull request of the phase moves it to `docs/archive/`.

- Written on 2026-11-19 against `main` at 9b4ba62 (PR 179 merged, [ADR 093](docs/adr/093-learning-only-words-in-learning.md)).
- Where this plan and `docs/spec/` disagree, the spec wins until the pull request named here changes the spec. Every such change is listed in [section 3.6](#36-spec-changes) with its pull request.
- The phase removes; it adds no feature. Its decisions are about the order of removal, the data that changes shape (settings, counters, the sync batch, the D1 tables) and what each screen looks like without typing.
- Sections: [status](#status), [goal and scope](#1-goal-and-scope), [what was checked](#2-what-was-checked), [decisions](#3-decisions), [answered questions](#4-answered-questions), [manual steps](#5-maintainers-manual-steps), [pull requests](#6-pull-requests), [executor instructions](#7-instructions-for-executor-agents), [risks](#8-risks).

## Status

The executor of a pull request fills its row (see [section 7](#7-instructions-for-executor-agents)).

| PR  | Branch                      | Status | Pull request |
| --- | --------------------------- | ------ | ------------ |
| D   | `docs/p6-design`            | done   | #181         |
| 1   | `p6-01-remove-type`         | done   | #182         |
| 2   | `p6-02-content-out`         | done   | #183         |
| 3   | `p6-03-stats-settings`      | done   | #184         |
| 4   | `p6-04-learning-only-data`  | done   | #185         |
| 5   | `p6-05-drop-typing-columns` | done   | #192         |
| 6   | `p6-06-close`               | —      | —            |

## 1. Goal and scope

**What the user gets.** Nekotype is a learning app: `/` teaches kana, `/stats` shows learning progress, `/settings` holds the learning settings and the account, `/about` the terms of the project. There is no typing trainer. Learning progress of a signed-in user keeps syncing between devices, and nothing a learner does depends on code that only typing needed.

**In scope** ([phases.md](docs/spec/phases.md), P6; [ADR 093](docs/adr/093-learning-only-words-in-learning.md), points 2 and 3):

- the `/type` route and page, typing sessions, test end, results, records, the results screen and the repeat, `KanaStat` and word weights, the report dialog and its Turnstile loader;
- the typing section of `/stats`, the typing settings, the "Typing" section of `/settings`;
- the typing part of sync: `results`, `kanaStats`, typing records, server history (`GET /api/results`), the `results` and `records` stores, the typing keys of `delta`, the D1 table `results` and the columns `kana_stats` and `typing_records` of `user_stats`;
- word and phrase chunks out of the web build; `/about` credits only what is shipped;
- browser tests of input, IME and layout notices, focus and keystroke latency on learning recall;
- the spec, `README.md`, `docs/architecture/`, `AGENTS.md` and the design system without the typing trainer; the design export renames the phases (audio P8, release P12).

**What stays** ([ADR 093](docs/adr/093-learning-only-words-in-learning.md), point 3): the input engine (`packages/engine`) unchanged, stream matching and both strictness modes included; the input source with its layout and IME notices; the content pipeline (`packages/content`) and its committed output; `POST /api/reports` and the table `content_reports`; the Turnstile secrets and widgets on Cloudflare (unused by the client until P10).

**Out of scope:**

- Any change to how learning works (confidence, boxes, unlocking, the session): P7 replaces it with the knowledge model.
- The search for kana sounds (O6): it runs alongside P6 and P7, outside this plan.
- Words in learning and the report dialog on word tasks: P10.
- IndexedDB migrations: a schema change still resets the local data ([ADR 061](docs/adr/061-schema-reset-before-release.md)).
- A new Cloudflare measurement: P6 only takes work out of the sync handler (see [D9](#d9-the-server-and-d1-in-two-steps)).
- The font subsets: unchanged (see [D4](#d4-content-stays-in-the-repository-and-leaves-the-build)).

## 2. What was checked

Checked on 2026-11-19 against the code on `main` at 9b4ba62.

| Item                          | Finding                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budgets today                 | `pnpm run build && pnpm run budget`: initial JS 32.64 of 35 KB gzip, initial CSS 8.83 of 10 KB, first load 102.65 KB; `/type` route chunk 12.46 KB, `/stats` 10.44 KB, report dialog 2.09 KB, results panel 1.68 KB                                                                                                                                                             |
| Learning needs from typing    | `pages/learn` uses the engine binding of `entities/prompt` (`compile`, `start`, `step`, `isComplete`, `spellingsFor`, `canonicalFor`) and the kana table; `app/route-view.tsx` takes `useEnterForNext` from `features/training` for the not-found screen. Nothing else of `features/training`, `pages/trainer` or `entities/stats` is used by learning                          |
| `/stats` learning section     | Imports `lib/activity`, `lib/answer-time`, `lib/days`, `lib/selection` (the `Period` type), `lib/trend` (`timeAxis`), `ActivityMap`, `PeriodSwitch`, `SectionEmpty`, `StatsChart`, `TrackSwitch`, `useNarrow`, `layout`. Typing only: `typing-section*`, `filter-row`, `history-table`, `kana-heat` (ui and lib), `lib/metrics`, `lib/typing-data`, `lib/section`               |
| Recall already measured       | `e2e/latency.spec.ts` has a recall test (two sessions of 25 tasks under 4× throttling, p95 and worst against the same budgets); `session-screen.test.tsx` checks 0 renders per recall keystroke and at most 1 per answer. The trainer's `render-isolation.test.tsx` and the Words and Phrases latency tests are the typing copies                                               |
| Notices in recall             | The session screen shows the layout and IME notices of the input source (`session-screen.tsx`, "as on /type"), so the browser tests of `input.spec.ts` can run on recall                                                                                                                                                                                                        |
| Sync e2e                      | All three files (`e2e/sync/*.spec.ts`) type a count test on `/type` and read `stats-typing-tests`; `e2e/lib/sync.ts` has the typing helper                                                                                                                                                                                                                                      |
| Counters                      | `Counters` is `{ started, finished }` per `Mode` (`typing`, `learn`). Learning uses `started.learn` and `finished.learn` only (`/stats` learning line, the "has data" test)                                                                                                                                                                                                     |
| Settings                      | `ValidSettings.typing` holds script, content, strictness, weak focus, test and `showTranslation`; the valibot schema and `isSettings` are strict objects, so a document with or without `typing` is rejected by the other version                                                                                                                                               |
| `meta.typingIntervals`        | The device's keystroke intervals for K of the answer time (learning, `entities/learn/model/store.ts`). It is learning data under a typing name                                                                                                                                                                                                                                  |
| Content in the build          | The chunks in `apps/web/src/entities/prompt/content/` reach `dist` only through the dynamic imports of `content-loader.ts` and `credits-loader.ts`. `subset-fonts.mjs` reads the word and phrase files for the Noto glyph set; the content is kana, so the glyph set is the kana table's plus punctuation (Noto 20.38 KB)                                                       |
| Typing-only styles and tokens | `app/styles/index.css` (initial CSS) holds `nk-test`, `nk-word`, `nk-stage`, `nk-hist`, `nk-credits`, `nk-rchart` and others of the stream and results. Tokens `chart-kpm` and `heat-miss-1…5` are used only by the typing parts of `/stats` (decision 110). Corrected in PR D: `chart-kpm` also draws the answer-time median tick and is renamed `chart-median` (decision 134) |
| Shared UI with one consumer   | `PersonalBestBadge` (results), `Toggle` (stats filter row, config bar), `Textarea` (report dialog), `Pagination` (stats history, phrase credits on `/about`): no learning screen uses them                                                                                                                                                                                      |
| Preview database              | Sign-in is off on previews (`/api/auth/*` answers 404 there, P5 S3), so `nekotype-preview` holds no user rows: a data rewrite in a migration can break no preview                                                                                                                                                                                                               |
| D1 migration rule             | P5 plan D5 (now in [backend.md](docs/spec/backend.md) and `deploy.yml`): a migration must work with the code deployed before it; preview is migrated before a preview deploy, production after the candidate's smoke test and before the production deploy                                                                                                                      |
| Not confirmed: `DROP COLUMN`  | That D1 runs `ALTER TABLE … DROP COLUMN` (SQLite 3.35+). PR 5 confirms it with the API tests (local D1) and the preview migration step; the fallback is in [D9](#d9-the-server-and-d1-in-two-steps)                                                                                                                                                                             |

## 3. Decisions

Each decision fills a gap that ADR 093 and the spec leave open. The maintainer answered the two questions of [section 4](#4-answered-questions) on 2026-11-19; everything else here is decided by this plan.

### 3.1 Removal

#### D1. What leaves the web application

A module goes in the pull request that removes its last consumer, with its tests, styles, strings and the documents that describe it. Nothing is kept "for later": P10 restores what it needs from git history.

| Slice or file                       | Fate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | PR   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `pages/trainer`                     | Deleted whole: the page, the stage, the mode panel, the live line, the results panel and its loader, the weak kana list, the report dialog, `report-action.tsx`, `lib/turnstile.ts`, `api/reports.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 1    |
| `features/training`                 | Deleted whole. `useEnterForNext` moves to `shared/lib` (its one remaining consumer is the not-found screen in `app/route-view.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 1    |
| `entities/prompt`                   | Keeps the kana table (`model/data`), the engine binding (`lib/engine.ts`), `lib/canonical.ts` and the types they need. Deleted: `lib/picker.ts` and the content types (PR 1); `api/content-loader.ts`, `api/credits-loader.ts`, `api/content-version.ts` (PR 2); `model/fixtures.ts` with its last test user. The slice keeps its name: P10 brings words back as prompts. **Changed in PR 4 (maintainer's decision, [ADR 096](docs/adr/096-learning-only-data-and-sync-format-2.md)):** with `entities/stats` gone `pages/learn` is the only consumer and `steiger` rejects the slice, so the table, the binding and `canonicalFor` moved to `pages/learn/lib/prompt`; `entities/prompt/content/` stays, ignored by `steiger` | 1, 2 |
| `entities/stats`                    | Deleted whole (the typing store, weights, the mode line, the history API)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 4    |
| `pages/stats`                       | Loses everything in the "typing only" list of [section 2](#2-what-was-checked) and the section switch; takes the grid of design decision 137: the streak column, the totals row, an activity map that fills its width and marks the current streak                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 3    |
| `pages/about`                       | Loses `phrase-credits.tsx`, `lib/paging.ts` and the sources section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 2    |
| `pages/settings`                    | Loses the "Typing" section; reset calls only `resetLearning` from PR 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 3, 4 |
| `shared/ui`                         | `PersonalBestBadge`, `Textarea` and `RestartIcon` (PR 1); `Pagination` (whichever of PR 2 and PR 3 merges second); `Toggle` (PR 3); `KanaChart` loses `mode="miss"` (PR 3); `Stat` loses the hero size and the badge slot if nothing else uses them (PR 3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 1–3  |
| `shared/i18n`                       | The `type` part (en, ru) and the core keys only typing uses (`nav.type`, `page.type`, the mode line keys, the stream's keys) go with their last consumer; `en` and `ru` keep key parity (the existing test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 1–4  |
| `app/styles/index.css`, `stats.css` | The classes of removed components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 1–3  |
| `shared/styles/tokens.css`          | `heat-miss-1…5` and `dur-draw` (PR 3); `layout-test`, `dur-stagger`, `dur-blink`, `ease-inout` and the `jp-test` text style (PR 1), as design decision 134 removed them. `chart-kpm` was renamed `chart-median` by PR D; `tokens.test.ts` counts what the export holds                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 1, 3 |
| `packages/shared`                   | `typing-runtime.ts` and its tests; the typing types (`KanaStat`, `KanaKey`, `TestResult`, `TestEndReason`, `TypingRecords`, `ValidTestConfig`, `ResultsResponse`, `Mode`); the typing parts of the guards and schemas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 4    |
| `apps/api`                          | `routes/results.ts`, `db/results.ts` and their tests; the typing parts of `sync/apply-batch.ts` and `db/sync.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 4    |

The input source (`shared/lib/input`) keeps its behaviour. A key rule that only the typing screen used (`Ctrl+Enter` to finish zen, `Tab` to Restart) goes with its test in PR 1; a rule that recall also follows stays, and its browser test moves to recall (D3).

#### D2. Routes and navigation

- `/type` leaves `ROUTE_PATHS`, `routes.tsx`, `init.ts` and `public/_redirects`. It is not redirected: it answers 404 with the static not-found page ([ADR 077](docs/adr/077-static-404-page.md)), as `/learn` does since P3. `smoke-deploy.mjs` expects 404 for `/type` and keeps `/learn`.
- The navigation is `learn · stats · settings` with the sign-in link on the right (design item a of [Q1](#q1-design-first)).
- The idle prefetch loads the routes, the session runtime, the summary panel and both dictionaries; it no longer loads content chunks or the results panel. `PrefetchDeps` loses `content`, `script` and `loadChunk`, and `schedulePrefetch` takes no settings.

#### D3. Browser tests and the latency gate move to recall

What happens to each e2e file in PR 1:

| File                                                                      | Fate                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input.spec.ts`                                                           | Moves to recall on `/`: the layout notice for a Cyrillic key and for `beforeinput` text (`@mobile`), a key pressed on a button, `Ctrl+Enter` on a link, the five IME composition tests. "does not start the test" becomes "is not taken as an answer"                                                             |
| `app.spec.ts`                                                             | Keeps (g), the language switch, run on `/`; the rest is deleted                                                                                                                                                                                                                                                   |
| `routes.spec.ts`                                                          | `/type` shows the not-found screen (new); Back after navigation returns to a working `/` (was the trainer); the reset dialog stays; "typing on another screen" and "show the translation" are deleted                                                                                                             |
| `lazy-chunks.spec.ts`                                                     | The dictionary and sync tests stay; the results screen tests are deleted                                                                                                                                                                                                                                          |
| `stats.spec.ts`                                                           | The activity map test stays; "shows a finished test in the history" is deleted                                                                                                                                                                                                                                    |
| `latency.spec.ts`                                                         | The recall test stays and is the gate; the Words and Phrases tests are deleted                                                                                                                                                                                                                                    |
| `sync/*.spec.ts`, `lib/sync.ts`                                           | Rewritten on learning: a guest's learning session reaches the account and shows on a new device (`guest-sign-in`); a session answered offline arrives when the network returns and the other device's `/stats` shows it (`offline-online`); two tabs each finish a session and both are counted once (`two-tabs`) |
| `stream`, `test-end`, `test-screen`, `zen`, `results-screen`, `lifecycle` | Deleted                                                                                                                                                                                                                                                                                                           |
| `learn-session`, `learn-chart`                                            | Unchanged                                                                                                                                                                                                                                                                                                         |

- The WebKit project keeps running the tests tagged `@mobile`: after the move these are the learning session by tap, the layout notices on recall and a recognition choice ([quality.md](docs/spec/quality.md), "WebKit scope").
- The recall latency test stays as it is (two sessions of 25 tasks, p95 and the worst keystroke against the existing budgets and ceilings). `quality.md` "Latency measurement" describes it instead of the 200-keystroke timed test.
- `LATENCY_PATHS` in `scripts/latency-gate.mjs` loses `features/training/` and the trainer files and gains `apps/web/src/pages/learn/` (non-test files: the session, its runtime and loader, the screen, `use-session-input`), `apps/web/src/shared/ui/kana-task.tsx` and `apps/web/src/shared/ui/task-controller.ts`. `entities/prompt/` stays in the list (the engine binding). The gate runs on PR 1 by its own rule.
- The render-isolation rule is checked by `session-screen.test.tsx`; the trainer's copy is deleted.

#### D4. Content stays in the repository and leaves the build

- The generated chunks stay in `apps/web/src/entities/prompt/content/`, where the pipeline writes them and `output.test.ts` checks them; nothing in `apps/web/src` imports them until P10. Moving them would change the pipeline twice.
- `check-budget.mjs` fails when the manifest holds a chunk whose source is under `content/` (the existing `CONTENT_SOURCE` test), with the message that no content is shipped before P10 ([ADR 093](docs/adr/093-learning-only-words-in-learning.md), point 3). The "Content chunk" budget row stays in `quality.md` for P10. P10 removes the check.
- `subset-fonts.mjs` keeps reading the content files: the glyph set is the same with or without them (kana and punctuation), so the fonts are not rebuilt and the subsets stay as they are. P10 needs no font change for the same words.
- `/about` shows only the "Nekotype" section (design item d); `packages/content/README.md` no longer says the typing screen loads the chunks.

### 3.2 Data

#### D5. Settings: the `typing` block goes

- `ValidSettings` becomes `{ learn: { strictness, track, targetMs, sound }, updatedAt }`. The `learn` block keeps its name: P8 and later phases add learning settings next to `sound`, and a flat document would rename every key for nothing.
- `isSettings`, `settingsSchema` (strict) and the defaults change with it; `entities/settings` loses `ScriptMode`, `ContentKind`, `TestConfig`, `PracticeSettings` and the typing signals and actions.
- A stored document with `typing` is rejected by the new guard. Locally the schema reset ([D7](#d7-indexeddb-schema-5)) removes it; on the server migration `0002` rewrites it ([D9](#d9-the-server-and-d1-in-two-steps)).

#### D6. Counters count learning sessions

- `Mode` is removed. `Counters = { readonly started: number; readonly finished: number }`: learning sessions started and finished. `addCounters` and `isCounters` follow.
- The same shape on the wire, in `delta/learn`, in the snapshot and in the D1 column `counters` (rewritten by `0002`). The `/stats` line `learning sessions: 41 started · 36 finished` reads `started` and `finished`.

#### D7. IndexedDB schema 5

- `SCHEMA_VERSION` = 5, so a P5 database is reset at the first start ([ADR 061](docs/adr/061-schema-reset-before-release.md)).
- Stores: `settings`, `delta`, `snapshot`, `outbox`, `meta`. `results` and `records` are gone; `delta` holds one record, `learn` (`{ learn, counters }`).
- `meta.typingIntervals` is renamed `keyIntervals`: it is the K of the learning answer time, not typing data, and the reset makes the rename free. Sign-out keeps `schemaVersion` and `keyIntervals`.
- The `BroadcastChannel` `nekotype:typing` is gone; `nekotype:learn` and `nekotype:settings` stay.
- "Reset progress" (guests) clears `delta`; it still keeps `settings`.
- The reset loses what the device had not sent; the maintainer syncs before PR 4 is deployed (M2). After the reset the device is a guest; signing in again pulls the account's learning state from the server.

#### D8. Sync format 2

- `SYNC_FORMAT_VERSION` = 2. `SyncRequest = { v: 2, deviceId, seq, delta: { counters, learn, settings } }`: no `results`, no `kanaStats`. `Outbox = { seq, request }`.
- The server accepts only `v: 2`. The schema is strict, so a body with `v: 1`, `results` or `kanaStats` is `400 invalid_body`: this is the acceptance item "`/api/sync` rejects a batch with typing data". The old format is not accepted for a release, as the P5 risk table planned for later format changes: before the release only the maintainer syncs, and a stale P5 tab that sends `v: 1` is blocked until it reloads (A28), when the schema reset empties its `outbox`.
- `Snapshot = { settings, counters, learn }`. `GET /api/sync?part=rest` answers `{ part, lastSeq, version, settings, counters, learn }` (the `learn` without `recent` and `recallBuckets`, as now); `recent` and `buckets` are unchanged.
- `MAX_RESULTS_PER_BATCH` and the catch-up for results go; the catch-up of a split learning delta (`splitLearnDelta`, 60 kana, 31 bucket days) stays, 5 seconds apart. The body limit (256 KB) and the keepalive limit (60 KB) stay.
- `GET /api/results` is removed: the path answers `404 not_found`. `entities/stats/api/history.ts` and the "History" section of `storage-sync.md` go.
- Sign-out with unsent data (`outbox` or `delta` not empty) names only "some progress has not been sent" (design item e); the result count goes with its plural strings.

#### D9. The server and D1 in two steps

The rule of the P5 plan (D5) stands: a migration works with the code deployed before it. So the code stops using the typing columns first, and the columns are dropped after that code is in production.

- **PR 4** writes `apps/api/migrations/0002_learning_only.sql`, which rewrites data and changes no schema:
  - `UPDATE user_settings SET json = json_remove(json, '$.typing')`;
  - `UPDATE user_stats SET counters = json_object('started', json_extract(counters, '$.started.learn'), 'finished', json_extract(counters, '$.finished.learn')), kana_stats = '{}', typing_records = '{}'`;
  - `DELETE FROM results`.

  PR 4's server code neither reads nor writes `kana_stats`, `typing_records` or `results`, except that creating a user still inserts `'{}'` into the two `NOT NULL` columns. Between the production migration and the production deploy (minutes) the P5 code meets rewritten rows and answers the maintainer's sync with `500`; the sync retries after the deploy. Preview has no user rows ([section 2](#2-what-was-checked)).

- **PR 5**, after the maintainer's check of PR 4 on production (M3), writes `0003_drop_typing.sql`: `DROP TABLE results` (its index goes with it), `ALTER TABLE user_stats DROP COLUMN kana_stats`, `ALTER TABLE user_stats DROP COLUMN typing_records`; and the user insert stops naming them. PR 4's code, still deployed while `0003` runs, never names the dropped table or columns except in that insert, which only a first sign-in runs.
- If D1 refuses `DROP COLUMN`, PR 5 rebuilds the table instead (create `user_stats_new` without the columns, copy, drop, rename) and records it in its ADR; the executor stops and asks only if the rebuild also fails.
- No Cloudflare measurement: the handler does less (no results insert, no records, no `kana_stats` parse). The API tests keep their bounds: a learning sync writes at most 2 rows and uses at most 50 statements.

### 3.3 Screens

#### D10. `/stats` is the learning section

- One section: the switch, `lib/section.ts` and the URL hash are removed; `/stats#typing` and `/stats#learning` open the same page.
- The page reads the learning store only. With no answers and no started session it shows one empty state (design item b); otherwise the layout of design decision 137: four equal columns (two below 640 px); `streak and activity` with the current streak in column 1 (`mono-hero`, the best streak, the active days of the last 30) and the activity map in columns 2–4; the totals as four `Stat`s (mastered per track, sessions started, sessions finished; the sessions line goes); `answer time` across the page.
- The track switch, period switch and answer-time chart are unchanged. The activity map fills its width (as many weeks as fit at 16 px, at most 26; cells up to 28 px) and marks the days of the current streak with a dot (`run`), as in the design's `ActivityMap`.

#### D11. `/settings` and `/about`

- `/settings`: sections Learning, Data (guests), Account. The reset strings name learning progress only (design item c).
- `/about`: the "Nekotype" section (code, name and cat, fonts); no sources, no phrase authors, no lazy content chunk. The reserved sections become "Kana audio — P8" and "Data on this device — P12" in the design export; neither is rendered.

### 3.4 Budgets

- Every pull request writes the initial JS and CSS before and after in its description. None may grow either; PR 1 and PR 4 are expected to shrink them (the trainer's styles in the initial CSS, the prefetch, the typing settings and the typing store's code in the initial chunk). A growth stops the pull request (section 7).
- PR 6 adds an "End of P6" column to the budget table of `quality.md`; the latency rows become "recall" only.

### 3.5 Documents and decision records

- ADRs (the number is the next free one when the pull request is opened; today the last is 093): PR D — the design system without typing; PR 1 — browser tests and the latency gate on recall (D3), the routes (D2); PR 4 — learning-only data: settings, counters, schema 5, sync format 2 and the two-step D1 change (D5–D9). PR 5 amends PR 4's ADR only if the fallback of D9 is used.
- The A-items of [decisions.md](docs/spec/decisions.md) that only concern typing (A39 among them) get a line "Superseded by ADR 093" in PR 6; their text is not rewritten.
- `docs/architecture/training-session.md` is deleted in PR 1 and its row removed from the folder index; the other architecture files change with the code they describe.

### 3.6 Spec changes

Changes to the spec that follow from ADR 093 and the decisions above, by pull request. Removals take the text of the removed behaviour out; they do not leave "removed in P6" notes, except in `phases.md`.

| #   | Change                                                                                                                                                              | Spec file                       | In PR |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----- |
| S1  | The text stream, the typing screen's keyboard rows, chrome, loading of vocabulary and the results chunk go; the hot-path rule is stated for recall                  | `frontend.md`                   | 1     |
| S2  | "Typing metrics", "Test end" and the results screen of "Screens" go                                                                                                 | `metrics.md`                    | 1     |
| S3  | "Latency measurement" describes the recall test; the e2e list, the WebKit scope and the smoke test (`/type` 404) follow D3                                          | `quality.md`                    | 1     |
| S4  | The report action and dialog leave "Attribution and reporting" until P10; `/api/reports` stays                                                                      | `content.md`, `frontend.md`     | 1     |
| S5  | "Output": the chunks are generated and committed but not shipped before P10; the budget check of D4                                                                 | `content.md`, `quality.md`      | 2     |
| S6  | The typing part of the `/stats` screen and the typing settings go; the `/stats` composition and the activity map of design decision 137                             | `metrics.md`, `storage-sync.md` | 3     |
| S7  | Data model: no `KanaStat`, `TestResult`, records; counters per D6; settings per D5                                                                                  | `metrics.md`, `storage-sync.md` | 4     |
| S8  | Stores, `delta`, two tabs, merge rules, batches (format 2), sign-out and reset per D7 and D8; "History" goes                                                        | `storage-sync.md`               | 4     |
| S9  | Request bodies (format 2), `GET /api/results` gone, "Applying a batch" without results, the free-tier figures per sync; the D1 schema with the unused columns noted | `backend.md`                    | 4     |
| S10 | A streak day: "an introduction or a typing test alone does not" loses the typing test; A39 has nothing left to separate                                             | `learning.md`                   | 4     |
| S11 | The D1 schema without `results`, `kana_stats`, `typing_records`                                                                                                     | `backend.md`                    | 5     |
| S12 | The tree and dependency rules without `features/training`, `entities/stats` and the typing route                                                                    | `architecture.md`               | 1, 4  |
| S13 | The "Closed" line of P6; the "End of P6" budget column                                                                                                              | `phases.md`, `quality.md`       | 6     |

## 4. Answered questions

### Q1. Design first

**Question.** Should the screens change in code from proposals approved in this plan, with the design export catching up, or should the design system be changed and approved first?

**Answer (2026-11-19):** design first. An agent changes the design system artifact from the proposals below (M1), the maintainer approves the previews, and PR D exports the result with an ADR. PR 1 and every later code pull request start after PR D is merged. Where an approved design decision differs from a proposal, the decision wins; PR D writes the decision numbers into this table. Decisions 128–137 were approved on 2026-11-19 and exported by PR D ([ADR 094](docs/adr/094-design-system-without-typing.md)). They differ from the proposals in three places: `chart-kpm` is renamed `chart-median`, not removed, because the answer-time median tick uses it (134); five more tokens and the `jp-test` style are removed (134); and `/stats` stands on a fixed four-column grid with the streak next to an activity map that fills its width and marks the streak's days (137).

| #   | Item                    | Proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Decision |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| a   | Navigation              | `learn · stats · settings`, the sign-in link on the right as now; `type` / `набор` is gone. The footer with `about` is unchanged                                                                                                                                                                                                                                                                                                                                                                                                                             | 129      |
| b   | `/stats`                | No section switch: the title `Stats` / `Статистика`, then the learning blocks as drawn (the `Stat` row, `activity`, `answer time`, the sessions line). No data at all (no answer, no session): one `EmptyState` (`sleep`), `No answers yet` / `Ответов пока нет`, `Finish a learning session: the streak, the activity and the answer times will appear here.`, action `to learning` / `к обучению`. Loading and error as now, without the switch. Keyboard: no switch stop                                                                                  | 130, 137 |
| c   | `/settings`             | Sections Learning, Data, Account. The "Typing" section goes. Learning strictness keeps its label; its description drops the comparison with the typing strictness. Reset hint: `Erases learning progress stored in this browser.` / `Стирает прогресс обучения в этом браузере.`; dialog text: `Learning progress in this browser will be erased. This cannot be undone.` / `Прогресс обучения в этом браузере будет стёрт. Это нельзя отменить.` The note on the deferred "reset learning" drops "typing statistics stay". "Sound appears in P6" becomes P8 | 131      |
| d   | `/about`                | Only the "Nekotype" section (code AGPL-3.0-only with the source link, name, logos and cat, fonts OFL-1.1). "Sources and licences" and "Phrase authors" go until a phase ships content; the reserved sections are "Kana audio — P8" and "Data on this device — P12"                                                                                                                                                                                                                                                                                           | 132      |
| e   | Sign-out dialog         | Unsent data is always named as `Some progress has not been sent yet. If you sign out now, it will be lost.` (the existing line of decision 126); the result count and its plural forms go                                                                                                                                                                                                                                                                                                                                                                    | 133      |
| f   | Removed components      | `TestArea`, `ModePanel`, `TranslationLine`, `PersonalBestBadge`, `HistoryTable`, `WeakKanaList`, `Textarea` and `Pagination` (no consumer left); `Char` if only the stream uses its states. `KanaChart` loses `mode="miss"`; `Stat` loses the KPM uses (hero, badge, comparisons) if nothing else needs them; `ResultChart`, `Segmented`, `Select`, `Input`, `Notice`, `Dialog` lose their typing and report-dialog examples and strings                                                                                                                     | 128      |
| g   | Tokens                  | `chart-kpm` and `heat-miss-1…5` are removed (used only by typing on `/stats`, decisions 110 and 111)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 134      |
| h   | Guidelines and previews | `README.md` loses "Text stream performance", "Test screen", "Typing results" and the report dialog (Q2); "Stats", "Settings", "About", "Loading and errors" and "Keyboard" are rewritten; the `Screen*` previews of `/type`, the results and the typing section are removed, `ScreenStats` and `ScreenStatsMobile` are redrawn; phase names: audio P8, release P12                                                                                                                                                                                           | 136      |

### Q2. The report dialog in the design system

**Question.** The report dialog (decisions 23, 114–117, 127) leaves the code with `/type` and returns with word tasks in P10. Keep its design in the system as a reference, or remove it?

**Answer (2026-11-19):** remove (design decision 135). The design system loses the dialog, its strings and states and `Textarea`; the decision log keeps 114–117 as history, and P10 draws the dialog again for word tasks. In code, PR 1 deletes the dialog, the Turnstile loader and the site keys; the server route and the secrets stay.

## 5. Maintainer's manual steps

### M1. Design session — before PR D

An agent changes the design system artifact by the proposals of [Q1](#q1-design-first) (the workflow: read the files, edit copies, publish with `root`, then `project/design-system.json` last; all `Screen*/preview.html` files share one script, so a change to shared preview data goes into each). The maintainer reviews the previews of `ScreenStats`, `ScreenStatsMobile`, `ScreenSettings`, the about screen and the navigation, and approves. Only then PR D exports.

Check: the artifact has no `TestArea`, `ModePanel`, `TranslationLine`, `PersonalBestBadge`, `HistoryTable`, `WeakKanaList`, `Textarea`, `Pagination` component and no typing screen preview; `decisions.md` has the new decisions after 127.

### M2. Sync before PR 4 is deployed

The schema reset of PR 4 deletes what the device has not sent. On every device where the maintainer is signed in: open `/settings` online and wait for `synced`. Then merge PR 4.

### M3. Production check of PR 4 — before PR 5

After PR 4 is deployed:

1. `pnpm exec wrangler d1 migrations list DB --remote --env production` shows no unapplied migration.
2. On `https://nekotype.pages.dev`: the app starts as a guest with default settings (the schema reset); `/type` shows the not-found page; sign in; the kana chart and `/stats` show the learning progress the account had; finish a learning session and see `synced` in `/settings`.
3. Write "done" with the date under PR 4 in [section 6](#pr-4--learning-only-data-and-sync-format-2) (or tell the executor of PR 5).

### M4. After PR 5 is deployed

`pnpm exec wrangler d1 execute nekotype --remote --command "SELECT name FROM pragma_table_info('user_stats')"` lists no `kana_stats` and no `typing_records`, and `pnpm exec wrangler d1 execute nekotype --remote --command "SELECT name FROM sqlite_master WHERE name = 'results'"` returns no row. A learning sync on production still shows `synced`. The executor of PR 6 may run the two read-only commands itself when the maintainer allows it.

## 6. Pull requests

Common to all: the branch is cut from fresh `main`; the acceptance items are those of [phases.md](docs/spec/phases.md), numbered in the [table at the end](#acceptance-items-and-pull-requests); sizes are changed lines including tests, a rough guide to how much one executor session holds (deletions are cheap; the written lines are the effort).

Order. A pull request starts when the ones it depends on are merged; pull requests with no path between them can run in parallel.

| PR  | Depends on | Can run in parallel with |
| --- | ---------- | ------------------------ |
| D   | M1         | —                        |
| 1   | D          | —                        |
| 2   | 1          | 3                        |
| 3   | 1          | 2                        |
| 4   | 1, 3, M2   | 2                        |
| 5   | 4, M3      | 2                        |
| 6   | all, M4    | —                        |

Sign-in is hidden on previews: what needs a session is checked locally (`pnpm run dev` with `pnpm run dev:api`) and, after the merge, by the maintainer on production.

### PR D — Design export

- **Branch:** `docs/p6-design`. **Depends on:** M1 (approved by the maintainer).
- **Goal.** The approved changes of [Q1](#q1-design-first) and [Q2](#q2-the-report-dialog-in-the-design-system) exported from the artifact into `docs/design/source/` (never edited there by hand).
- **Docs:** `docs/design/source/` (`README.md`, `decisions.md`, `tokens.json`, the component guidelines, `bundle.js`, `bundle.css`, `index.d.ts`; deleted folders for removed components); `docs/design/README.md` if it lists them; an ADR (the design system without typing, citing the new decisions); the decision numbers written into the Q1 table of this plan.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm run docs:check` passes; every Q1 row names its decision.
- **Size:** documents only.

### PR 1 — Remove `/type`

- **Branch:** `p6-01-remove-type`. **Depends on:** PR D.
- **Goal.** No typing screen: the route, the trainer and everything only it used (D1, D2, D3); the browser tests and the latency gate on recall.
- **Deletes:** `pages/trainer`; `features/training` (`useEnterForNext` moves to `shared/lib` with its test); `entities/prompt/lib/picker.ts` and the content types; `PersonalBestBadge`, `Textarea`; the `type` i18n part and the core keys of the stream and the results; the trainer's styles in `app/styles/index.css`; `docs/architecture/training-session.md`.
- **Changes:** `route-paths.ts`, `routes.tsx`, `init.ts`, `App.tsx` (navigation), `route-view.tsx`, `prefetch.ts` (D2), `public/_redirects` and `redirects.test.ts`; `readonly-store.test.ts` (no trainer session); `smoke-deploy.mjs` and its test (`/type` → 404); `latency-gate.mjs` and its test (D3); the e2e files per D3, `e2e/lib/prompt.ts` deleted if nothing uses it; `check-budget.mjs` and its test only where they name the trainer's chunks.
- **Stays until later PRs:** the typing store and the typing section of `/stats` (PR 3, PR 4), the settings `typing` block (PR 4), the content loader and `/about` credits (PR 2). With no producer, the typing section only shows what a device already has.
- **Dependencies:** none.
- **Tests:** the moved browser tests pass on Chromium and, for `@mobile`, on WebKit; the rewritten sync e2e pass (`pnpm run e2e:sync`); the recall latency test passes in CI (the gate runs by its own path rule); `session-screen.test.tsx` still proves 0 renders per recall keystroke; the route tests: `/type` is not a route, `_redirects` equals `ROUTE_PATHS`.
- **Acceptance:** 1, 7 (the e2e side), 9, 10 (this PR's figures).
- **Docs:** an ADR (D2, D3); spec S1–S4, S12 (the tree); `docs/architecture/` (`pages.md`, `input.md`, `layout.md`, `quality-gates.md`, the index); `README.md` (what the app is, the routes, the latency script); `AGENTS.md` (the project paragraph: `/type` gone; "No IndexedDB writes during a test" becomes "inside a keystroke handler"; the `e2e:latency` line; the hot-path rule names recall).
- **Preview URL:** `/type` shows the not-found page with a 404; the navigation has no `type`; a learning session by keyboard and by tap; the layout notice on recall with a Cyrillic layout; `/stats`, `/settings`, `/about` open as before.
- **Done when:** `verify:quick` passes; CI is green including the latency gate; the initial JS and CSS did not grow.
- **Size:** about 9,500 lines deleted, about 900 written (the sync e2e, the moved input tests, documents).

### PR 2 — Content out of the build, `/about`

- **Branch:** `p6-02-content-out`. **Depends on:** PR 1. Parallel with PR 3.
- **Goal.** No word or phrase chunk in `dist`; `/about` credits only what is shipped (D4, D11).
- **Deletes:** `entities/prompt/api/*` (the loaders and `CONTENT_VERSION`), `model/fixtures.ts` if this removes its last user; `pages/about/ui/phrase-credits.tsx`, `lib/paging.ts` and the sources section; `Pagination` if PR 3 is already merged; the `about` i18n keys of sources and credits.
- **Changes:** `about-page.tsx` and its test; `check-budget.mjs` and `check-budget.test.ts` (the content rule of D4); `packages/content/README.md`.
- **Dependencies:** none.
- **Tests:** the about page renders the "Nekotype" section and nothing loads lazily; the budget test fails on a manifest with a content chunk and passes without one.
- **Acceptance:** 11; 2 (content part).
- **Docs:** spec S5; `docs/architecture/` (`pages.md`, `entities.md`); `README.md` if it describes the content in the app; `NOTICE.md` only if it claims the app ships the generated data.
- **Preview URL:** `/about` shows one section; the network panel shows no content chunk after the idle prefetch.
- **Done when:** `pnpm run build && pnpm run budget` lists no lazy content chunk; `verify:quick` passes.
- **Size:** about 1,000 lines deleted, about 150 written.

### PR 3 — `/stats` and `/settings` without typing

- **Branch:** `p6-03-stats-settings`. **Depends on:** PR 1. Parallel with PR 2.
- **Goal.** The learning section is all of `/stats`; `/settings` has no typing section (D10, D11).
- **Deletes:** in `pages/stats` the typing files of [section 2](#2-what-was-checked), `lib/section.ts`, the switch, `SectionEmpty` if the single empty state replaces it; `Toggle`; `KanaChart` `mode="miss"` and its tests; `Pagination` if PR 2 is already merged; the tokens `heat-miss-1…5` and `dur-draw` (`tokens.css`; `chart-kpm` was renamed `chart-median` by PR D); the typing keys of the `stats` and `settings` i18n parts; the stats e2e test of the history if PR 1 left it.
- **Changes:** `stats-page.tsx` (learning store only, the empty state of design item b, the grid of design decision 137); `learning-section.tsx` (the streak column and the totals, the sessions line goes); `activity-map.tsx` (fills its width, streak dots, `current streak` / `текущая серия` in the legend and tooltip, and the i18n keys for the new strings); `settings-page.tsx` (no "Typing" section, the reset strings of item c; reset still calls `resetTyping` until PR 4); `stats.css`.
- **Dependencies:** none.
- **Tests:** DOM tests of `/stats`: loading, error with retry, the empty state, the learning blocks; the streak number and the dotted days agree; the active days count the last 30 days; the map's week count follows its width (at most 26); `/settings` without the typing section; the existing learning-section tests unchanged.
- **Acceptance:** 8; 2 (UI part).
- **Docs:** spec S6; `docs/architecture/pages.md`.
- **Preview URL:** `/stats` with no data shows the empty state and with a finished session the learning blocks, no switch; the map reaches the right edge of its columns on a desktop and a phone; `/settings` shows Learning, Data, Account.
- **Done when:** `verify:quick` passes; the `/stats` chunk is smaller than 10.44 KB gzip.
- **Size:** about 2,800 lines deleted, about 300 written.

### PR 4 — Learning-only data and sync format 2

- **Branch:** `p6-04-learning-only-data`. **Depends on:** PR 1, PR 3, M2 before the merge.
- **Goal.** No typing data anywhere: types, guards, schemas, the local stores, the sync engine, the server and the D1 rows (D5–D9).
- **`packages/shared`:** the types and runtime of D5, D6, D8; `typing-runtime.ts` deleted; `schemas.ts` (format 2, settings, counters); `sync-format.ts` (`SYNC_FORMAT_VERSION` = 2); `applyBatch` and the snapshot guards without typing; `testing/year.ts` without typing data.
- **`apps/api`:** `0002_learning_only.sql`; `sync/apply-batch.ts` and `db/sync.ts` without `kana_stats`, `typing_records`, `results` (reads, writes, the `part=rest` text); `auth/users.ts` keeps inserting `'{}'` into the two columns; `routes/results.ts` and `db/results.ts` deleted; `app.ts` stops mounting them.
- **`apps/web`:** `entities/stats` deleted; `shared/lib/idb/schema.ts` (D7); `entities/settings` (D5); `entities/learn` (`Counters`, `keyIntervals`); `features/sync` (`build-batch.ts`, `apply-ack.ts`, `stored.ts`, `account.ts`, the engine and its tests: no results, no typing delta, no history, sign-out per item e); `pages/settings` (reset calls `resetLearning` only; the sign-out dialog); `pages/stats` (the sessions line on the new counters); `shared/lib/idb/sync-request.ts` (one caller); the i18n keys `signOut.results.*`.
- **Dependencies:** none.
- **Tests:** API: a `v: 1` body, a body with `results` and a body with `kanaStats` are each `400 invalid_body`; a format-2 learning sync applies, writes at most 2 rows and uses at most 50 statements; `GET /api/results` is `404`; `part=rest` carries `settings`, `counters` and `learn` only; migration `0002` on a P5 row (built with the P5 shapes in the test) gives flat counters, settings without `typing`, empty typing columns and no results; account deletion still empties every table of the user. Shared: the property and equivalence suites without typing, counters additive, commutative and associative. Web: the schema reset from version 4 (a database with `results` and `records`) gives schema 5 with default settings; a batch carries the learning delta and the settings only; sign-out with an unsent delta shows the progress line; two engines against one fake server converge; the sync e2e of PR 1 still pass.
- **Acceptance:** 2 (data part), 4, 6, 7.
- **Docs:** an ADR (D5–D9); spec S7–S10, S12; `docs/architecture/` (`sync.md`, `entities.md`); `README.md` (what syncs); `AGENTS.md` (the "Learning and typing data are separate (A39)" rule goes; "The raw keystroke log must never be persisted" stays).
- **Preview URL:** the first load starts from empty data (the schema reset) with default settings; a learning session, a reload, the progress is kept; reset progress empties it. Locally with `.dev.vars`: sign in, a learning session syncs; a second browser profile signs in and sees it.
- **Done when:** `verify:quick` passes and CI is green with the sync e2e; the initial JS did not grow; M2 was done before the merge.
- **Production check (M3):** done 2026-11-20. Migrations applied; guest start, sign-in, progress and `synced` after a session checked on production. Found and fixed: the status stayed `pending` because a fractional `settingsSyncedAt` was read as absent (#187). Accepted: the exact URL `/type` is still answered from a stale Cloudflare edge cache (old `index.html`) until it expires, at most 7 days; the code and fresh URLs answer 404.
- **Size:** about 3,000 lines deleted, about 1,000 written. If the session cannot hold it, the executor proposes a split to the maintainer; the format change of client and server stays in one pull request, because a deployment carries both.

### PR 5 — Drop the typing table and columns

- **Branch:** `p6-05-drop-typing-columns`. **Depends on:** PR 4 deployed and M3 done.
- **Goal.** The D1 schema holds learning data only (D9).
- **Adds:** `apps/api/migrations/0003_drop_typing.sql` (or the rebuild of D9).
- **Changes:** `auth/users.ts` (the insert without the columns); the API test that checks the tables and columns of the schema.
- **Dependencies:** none.
- **Tests:** API: after the migrations `user_stats` has no `kana_stats` and `typing_records` and there is no table `results`; a new user signs in and syncs; account deletion still cascades.
- **Acceptance:** 5.
- **Docs:** spec S11; PR 4's ADR gets a Status line only if the rebuild was needed (then a new ADR records it).
- **Preview URL:** nothing changes for the user; the CI step "Apply D1 migrations (preview)" passes.
- **Done when:** CI is green including the preview migration; after the merge the maintainer does M4.
- **Size:** about 100 lines.

### PR 6 — Close the phase

- **Branch:** `p6-06-close`. **Depends on:** every other pull request and M4.
- **Goal.** The acceptance checked as a whole and the documents brought in line with the code.
- **Does:**
  - an audit for leftovers, its command and result in the pull request description: `git grep -n -i -E "typing|/type\b|kpm|personal best|zen|TestResult|KanaStat|kanaStats|results store|TranslationLine"` over `apps`, `packages`, `scripts`, `.github` and `docs/spec`, `docs/architecture`, `docs/design/source`; every hit is removed or explained (the engine's stream API, the content pipeline, `content_reports`, migration `0001` and history files are expected);
  - `pnpm run build && pnpm run budget` and the CI latency figures of the last code commit for the "End of P6" column;
  - the A-items of [section 3.5](#35-documents-and-decision-records) marked superseded.
- **Docs:** `phases.md` (the "Closed" line of P6 with the commit and the pull requests); `quality.md` ("End of P6"); `README.md`, `docs/architecture/` and `AGENTS.md` reread against the code (the project paragraph: P6 done, P7 next); `docs/adr/README.md` has every ADR of the phase; this file moved to `docs/archive/p6-plan.md` with a note on top; its row in `docs/README.md` removed.
- **Done when:** every row of the table below names a passing test or check in the pull request description.
- **Size:** about 300 lines, documents.

### Acceptance items and pull requests

The items of the P6 acceptance in [phases.md](docs/spec/phases.md), in its order.

| #   | Acceptance item                                                                      | PR                       |
| --- | ------------------------------------------------------------------------------------ | ------------------------ |
| 1   | `/type` answers 404 with the static not-found page                                   | 1 (smoke test, e2e)      |
| 2   | No module, test, string or design component of typing is left                        | 1–4, D; audit in 6       |
| 3   | `en` and `ru` keep key parity                                                        | every PR (existing test) |
| 4   | `SCHEMA_VERSION` is raised, so a database of P5 is reset                             | 4                        |
| 5   | A D1 migration drops `results` and the typing columns of `user_stats`                | 5 (data cleared in 4)    |
| 6   | `/api/sync` rejects a batch with typing data with `400`                              | 4                        |
| 7   | A learning sync of a signed-in user still converges between two devices (the P5 e2e) | 1 (rewritten e2e), 4     |
| 8   | `/stats` shows the learning section only                                             | 3                        |
| 9   | The render-isolation test and the latency test run on recall                         | 1                        |
| 10  | The initial JS does not grow and every budget passes                                 | every PR; figures in 6   |
| 11  | No word or phrase chunk is in `dist/`                                                | 2 (budget check)         |

## 7. Instructions for executor agents

One executor takes one pull request of section 6.

1. **Read first:** `AGENTS.md`; this file whole; [ADR 093](docs/adr/093-learning-only-words-in-learning.md) and [ADR 061](docs/adr/061-schema-reset-before-release.md); the spec sections your pull request names and the files it links. Check the Status table: every pull request yours depends on is merged, and every manual step it waits for is recorded as done. If not, stop and tell the maintainer what is missing.
2. **Make no decision this plan does not hold.** Data formats, names of stores and keys, user-visible behaviour and copy are decided here, in the spec or in the design (PR D). If something is missing, ambiguous or turns out wrong, ask the maintainer (in Russian) and wait.
3. **Removal rules.** Delete a module in the pull request that removes its last consumer, with its tests, styles, strings and documents; find consumers with `git grep`, not by memory. Never delete something learning uses: the learning unit tests and e2e are the regression suite and are not weakened. A browser test that covers a behaviour recall also has moves to recall (D3); it is not deleted.
4. **Stay in scope.** Build what your pull request lists. Anything else you had to touch is named in the pull request description.
5. **Follow `AGENTS.md`:** the code rules (no `any`, no assertions, strings through i18n with `en` and `ru` in parity, injected time and randomness), the layer rules, the hot-path and budget rules. Never bypass a hook.
6. **Budgets.** Run `pnpm run build && pnpm run budget` before and after, and write the initial JS and CSS figures into the pull request description. If either grew, stop and ask.
7. **Tests.** Write the tests your pull request lists and name, for each acceptance item you close, the test that proves it. Run the e2e files you touched on Chromium (`pnpm exec playwright test e2e/<file>.spec.ts --project=chromium`) and the sync e2e when sync or learning changed. Report results as they are.
8. **Documents** change in the same pull request: the spec items of [section 3.6](#36-spec-changes), the ADR named, `README.md` and `docs/architecture/` when the code they describe changed, `AGENTS.md` only where named and within 250 lines. A new ADR takes the next free number and a row in `docs/adr/README.md`.
9. **Finish:** when the work is done and `pnpm run verify:quick` passes, commit with a Conventional Commits message, push the branch (the pre-push hook runs the checks) and open the pull request. Its description lists: what changed, why, anything outside the scope, what to check on the preview URL (from your pull request's entry here), the acceptance items closed with their tests, and the budget figures before and after. No AI attribution in commits or in the pull request. Never merge: the maintainer does.
10. **Mark the plan:** after `gh pr create`, set your row of the Status table to `done` with the pull request number, in a second commit on the same branch (`docs: mark P6 PR n done`).
11. **Communication:** with the maintainer in Russian; code, comments, commits and documents in English.

## 8. Risks

| Risk                                                                  | How it shows                                                                                 | What to do                                                                                                                                                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removing typing breaks learning through shared code                   | A learning unit test or e2e fails; the input source behaves differently on recall            | The learning tests are the regression suite (section 7, rule 3). Restore the shared part; if it holds typing-only logic tangled with learning logic, stop and ask before untangling it                  |
| The latency gate on recall alone is noisier                           | The recall test fails in CI without a code reason (fewer samples than the 3 × 200 of typing) | It already runs in CI next to the typing tests (`quality.md`, End of P5). If it fails twice on unrelated changes, stop and report the numbers; the maintainer chooses more sessions or a median of runs |
| PR 4 is too large for one session                                     | The executor is well past the size of section 6                                              | Propose a split (for example the local stores and settings first, then the format and the server together) instead of cutting scope                                                                     |
| Unsent progress is lost at the schema reset                           | After PR 4 the account misses the last session of a device                                   | M2. Before the release nobody else uses production (ADR 061)                                                                                                                                            |
| The P5 code meets rewritten rows during the production deploy of PR 4 | A sync in those minutes is answered `500`                                                    | Accepted (D9): it retries after the deploy, and only the maintainer syncs                                                                                                                               |
| A stale P5 tab after the deploy                                       | It sends `v: 1`, gets `400` and stops syncing                                                | A28 working as designed: a reload loads the new client, whose schema reset clears the old `outbox`                                                                                                      |
| D1 refuses `DROP COLUMN`                                              | Migration `0003` fails in the API tests or the preview step                                  | The rebuild of D9; it touches `user_stats` only and keeps its foreign key to `users`                                                                                                                    |
| The design session takes long                                         | PR 1 cannot start                                                                            | The maintainer chose design first (Q1). The session needs no code and can start right after this plan is merged                                                                                         |
| Parallel PR 2 and PR 3 conflict                                       | Both touch `Pagination`, the i18n files and `quality.md`                                     | The second to merge rebases; the rule of D1 says which of them deletes `Pagination`                                                                                                                     |
| Something typing-specific stays unnoticed                             | The acceptance item 2 fails in the audit of PR 6                                             | PR 6 removes it, or names why it stays (the engine's stream API, the content pipeline and `content_reports` stay by ADR 093)                                                                            |
