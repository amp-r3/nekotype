# Pages and shared UI

Part of the [architecture description](README.md) of the current code.

## The learning screen (`pages/learn`)

- `pages/learn` is the learning screen: the chart of the selected track (`KanaChart`: blocks side by side with captions, a legend, a details panel per kana — `KanaChartPanel`), `mastered X of N` and the streak on one row with the track switch (the streak is hidden until the first answer; a first-visit line takes its place), `continue` (focused when the screen is ready) and `review (N)`, then one reserved `Notice` line (loading, a failed read with `retry`, or progress that cannot be saved), where N counts the due kana — confident, box 1 or higher, `dueAt` passed (`isDueKana`, ADR 062) — exactly the due marks of the chart.
  - `model/session.ts` is `createLearnSession(deps)` (`Clock`, `Scheduler`, `Rng`, the learning store, `AudioProvider`), a session of 25 tasks, and a review session of at most 20 recalls.
  - The romaji shown to the learner is `displayRomaji` (`lib/romaji`): the table's canonical spelling, except ん and ン, shown as `n`; an introduction takes only the romaji it shows (another spelling is a rejected key), recall takes every spelling of the learning strictness.
  - After a wrong choice the screen draws the hint to go on: `enter` and `next`, or a `next` button under `pointer: coarse`.
  - `lib` holds task choice, distractors, the review queue, the summary and the hook binding the session to the input source.
  - The session runtime and the summary panel are lazy chunks; the summary screen (its actions and the place of the panel) is part of the session runtime chunk, loaded before a session can end (ADR 067).
  - ADR 015 keeps the session in the page, which is its only consumer.
- `shared/ui` holds `KanaTask`, `createTaskController`, `OptionCard` and `KanaChart` as presentational components: data, states and strings come as props, and they import nothing from `entities` or `pages`. The input source (`shared/lib/input`) serves the learning session.

## The statistics screen (`pages/stats`)

- `pages/stats` (a lazy route; ADR 076, design decisions 130 and 137) is the learning progress, all of the screen: no section switch, no URL hash. It reads the learning store, shapes the data in `lib/` (pure functions with tests) and draws it in `ui/`.
  - **Page** (`ui/stats-page.tsx`): the `h1`, then the state of the learning store. Loading shows `loading…`, an error the message with `retry` (`retryLearn`); with no answer and no started session one `EmptyState` with an action to `/` replaces the blocks. Only the page reads the clock (`defaultClock`); the section gets `today` as a prop.
  - **Learning** (`ui/learning-section.tsx`): a grid of four equal columns, two below 640 px. `streak and activity`: column 1 is the current streak in the large mono face, the best streak and the active days of the last 30 (`activeDaysIn`, a fixed window), columns 2–4 the activity map. Then four `Stat`s: mastered kana of both tracks, sessions started, sessions finished. Then `answer time` across the page: the track switch is local state (it does not change `settings.learn.track`) and is drawn only when both tracks have answers; the period `Segmented` is 7 / 30 days or all, 30 by default. `lib/answer-time.ts`: `dayBars` (one bar per day from `quartilesOf` of `entities/learn`, one per Monday-to-Sunday week above 45 days on the axis), `msAxis` (covers the bars and the target answer time, which is a dashed `reference` line). A period without answers shows a notice with `show all time`.
  - **Chart** (`ui/stats-chart.tsx`): draws `ranges` (a bar from the first to the third quartile of a day or a week with a tick at its median) at the container's real width. Axes: `axisOf` in `lib/trend.ts` picks the smallest step of a list for which the snapped domain has at most four intervals, so every axis ends on a tick; `timeAxis` follows the period. Hover picks the nearest bar; ← → `Home` `End` `Esc` walk them; the tooltip lines are built only for the bar under the cursor, and the tooltip is the chart's `aria-describedby`.
  - **Activity map** (`ui/activity-map.tsx`): a column per Monday-first week and a button per day up to today. The map measures its own width (`ResizeObserver`) and `fitMap` in `lib/activity.ts` gives the frame: as many weeks as fit at 16 px, at most 26, cells growing to 28 px (not rounded, so the last column reaches the edge); without a width it draws 12 weeks. `activityDays` joins the recall answers of both tracks, the `activeDays` runs and the days of the current streak (the last run, while it ends today or yesterday: the cells with a dot, `is-run`); `levelOf` gives the fill step 0–5 at 1 / 10 / 25 / 50 / 100 answers (an active day without recall answers is 1). One Tab stop (today until a cell is chosen) with the arrows by day and week, `Home` / `End`; focus or hover shows the tooltip (the date, the answers, `current streak`, `today`).
  - **Styles and shared parts**: `ui/period-switch.tsx` (`PeriodSwitch`) and `ui/track-switch.tsx` (`TrackSwitch`); `lib/days.ts` holds `DAY_MS`, `HALF_DAY_MS`, `MIN_DAYS_ALL`, `mondayOf` and the `Period` type. The screen's styles (`.nk-rc*`, `.nk-am*`) are in the lazy `ui/stats.css`, not in the initial stylesheet. `Stat`, `Cat`, `EmptyState` and `Pagination` are in `shared/ui` and out of its barrel, so they stay in the lazy chunk; `Pagination` takes its labels as props (`/about` uses other ones).
  - **Tests**: `lib/*.test.ts` cover the pure functions; `ui/*.test.tsx` are per widget and page (`stats-page`, `stats-page-error`, `learning-section`, `learning-section-data`, `stats-chart`, `activity-map`); `e2e/stats.spec.ts` checks the map on a phone and on a desktop.

## The about screen (`pages/about`)

- `pages/about` (a lazy route; P4 PR 13, ADR 066) shows, in the route chunk, the sources and licences (`ui/source-rows.tsx`: four rows, `CC BY` of Waller's lists without a link, A3) and the terms of Nekotype (code, name and cat, fonts), then the phrase authors (`ui/phrase-credits.tsx`).
  - The list is read from `credits.json`, a content chunk of its own: `loadCredits` in `entities/prompt/api/credits-loader.ts` imports it, checks its shape and keeps the result; a failure is forgotten so `retry` fetches again.
  - The component starts the load when it mounts, and only the list's place shows `loading…` or the error with `retry`. The idle prefetch does not fetch this chunk.
  - `lib/paging.ts` sorts by sentence id and slices pages of 25; the whole list is in memory, so a page change is synchronous, the count line (`role="status"`) announces the range and focus stays on the pressed page button. `Pagination` is the one from `/stats` with its own labels.
  - In a container of 480px or less a row is a block (CSS `.nk-credits`, the `td[data-label]` values become the line labels).
  - The kana audio (P8) and stored data (P12) sections are not rendered yet.

## The settings screen (`pages/settings`)

- `pages/settings` (a lazy route) is in sections: `Learning` (the learning strictness as a `Segmented`, the target answer time as a `Select` of nine values from 1000 to 3000 ms in steps of 250) and `Data` (reset progress, with a confirmation `Dialog`); each row has the setting's name and what it does on the left and the control on the right, under the text below 640 px. `Select` is in `shared/ui` and out of its barrel.

## SVG in components

- SVG attributes are written in kebab-case (`stroke-width`, `text-anchor`): Preact core writes JSX names as they are, and the browser ignores a camelCase one. `app/svg-attributes.test.ts` fails on a camelCase attribute.
