# ADR 108: The P8 Design: a Learning Home, `/progress` With a Kana Details Dialog, the Forecast Change as Medians

- **Status:** In force.
- **Context:**
  - P8 ([phases.md](../spec/phases.md), item 9) turns `/` into a learning home that answers "what now", moves the kana table and the statistics to `/progress`, opens a kana's details in a dialog and shows in the session summary how the session moved the forecast. Its plan ([p8-plan.md](../archive/p8-plan.md)) fixed the data (section 3) and left how the screens look to a design brief (section 4), with one open question (Q2): the forecast change as medians or as ranges.
  - The session ran as [ADR 106](106-design-sessions-in-a-workbench-artifact.md) describes: a workbench artifact, five rounds (the home; Progress and the kana details; the summary and the session screen; the navigation and the settings; the states of P9–P12), each with the maintainer's answers before it and a review after it, all on 2026-11-24. The approved variants were moved into the design artifact as decisions 140–152 and are exported here.
  - [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), point 6, says a forecast is shown "as a range, never as one number". phases.md gives the summary's example as medians ("about 3 sessions → about 2").
- **Decision:** Design decisions 140–152 in [`decisions.md`](../design/source/decisions.md), exported from the design artifact.
  1. **`/`** (140–145). Two columns: the action — the reason of D1 in `ui-title`, `continue` and the outline (`about 30 tasks: 6 reviews, 2 new kana`) — and "since the last session" on the left; the path with the forecast on the right; one column on a phone. The track switch and the streak at the top. Nothing to do: the reason's line with the time of the next review replaces `continue`. The forecast is one line over the path, a range naming the row. The path is the track's blocks with a tick per row; the open block shows its rows as columns, a tick over each, the current one in `eye`. What got stronger is kana in table cells under the captions new, learned, mastered, stronger. The katakana suggestion sits over the reason. No kana table on `/`.
  2. **`/progress`** (146). The title with one view-only track switch, the kana table of that track, then the statistics of decision 137, whose answer time follows the same switch. Before the first answer: the table, every kana locked, and the `EmptyState` under it.
  3. **The kana details dialog** (147). Opened from a table cell, a kana of "since the last session" and a kana of the summary. Rows: state, memory (the model's stability, with a stroke that fills at 21 days), recall, mixed up with, recognition. `KanaChart` calls `onOpen` and loses its inline panel (decision 94).
  4. **The session summary** (148). The current row's forecast before and after the session as medians, `3 → 2 sessions`; then `new` and `learned` as table cells and the lists as before, every kana opening its details; `continue` and `home`. With nothing left to do, `home` is the primary action.
  5. **The session screen** (149). A 2px tick per task of the session under the session line: done, current (`eye`), the rest, and `miss` for a task answered with an error. The tick changes when the task is answered, never on a keystroke.
  6. **The navigation** (150) reads `learn · progress · settings`; the open page carries the `eye` underline of the selected language. **The settings** (151) have the place of the P10 sound switch in Learning.
  7. **Later phases** (152). Every P8 screen preview can switch on the states of P9–P12, each named with its phase: small elements sketched in place and size (the first visit's question on `/`, the placement test on `/progress`, the mnemonic, the stroke order's place and `listen` in the details, the teaching feedback after an error, the words on `/` and in the summary), and new task types as places only.
  8. **ADR 100, point 6, does not hold for the summary's forecast change.** That one comparison shows the medians before and after the session; the home, and every other forecast shown, stays a range.
- **Justification:**
  - The home keeps what decides the next action on the left and what it moves towards on the right, so neither scrolls away on a desktop, and the reason reads before the button that acts on it. The path's rows as columns keep the open block as short as one row of kana; the ticks keep the columns apart and use the same marks as the blocks.
  - Kana in table cells say where each kana is now with the table's own states, which the learner already knows from `/progress`; the captions say what changed.
  - A dialog shows the same details from three places, where the panel could live only under the table.
  - A change of a range is two ranges to compare, and they often overlap ("3–5 → 2–4"); the medians make the move readable at a glance, which is the comparison's only job. The home keeps the range, so the uncertainty ADR 100 asks to show is still where a forecast is read on its own.
  - Ticks show how much of the session is left and where it went wrong, and they change only with an answer, which keeps the hot-path rule.
  - The eye underline is what the language switch and the path already use for "where you are"; the open page's brightness alone was hard to see on a phone.
  - Drawing the later phases switched off fixes where they go, so each phase fills a place instead of redrawing a screen, without designing tasks whose phases are not yet specified.
- **Rejected alternatives:**
  - _Home:_ one column (the path falls below the fold); a narrow centred column (wasted width on a desktop); the forecast on the current row of the path; a disabled `continue` when there is nothing to do.
  - _Path:_ the rows as a list under the blocks (too tall, empty right of the kana); the blocks as a list; the rows as one wrapping line of kana; two columns of rows; a hair line between the columns.
  - _What got stronger:_ plain kana under captions; cells without captions (the maintainer could not tell what they meant); cells in one line with the table's legend.
  - _Progress:_ the switch under the title with the track's counts. _Details:_ a large kana with three `Stat` tiles.
  - _Summary:_ ranges before and after.
  - _Session screen:_ the session line alone.
  - _Navigation:_ the new labels alone; the links in a bar at the bottom of a phone. One row on a phone does not fit (about 430px of 328 with `войти снова`).
  - _Settings:_ a section of its own for the sound.
  - _Later phases:_ dashed places only; drafts of every new task type; the first visit as a screen of its own.
- **Consequences:**
  - The export changes `README.md` (the home, Progress with the kana details, the summary, the session line, the settings, a section on later phases), `decisions.md`, the guidelines of `KanaChart`, `KanaTask`, `Nav` and `Switch`, `bundle.js`, `bundle.css` and `index.d.ts`. No token, text style or glyph changes, so `tokens.css` and `tokens.test.ts` do not change. The previews `ScreenStats` and `ScreenStatsMobile` became `ScreenProgress` and `ScreenProgressMobile` in the artifact.
  - The data gain one item that p8-plan.md section 3 did not hold: the session keeps the numbers of its finished tasks answered with an error, for the ticks (D13). The table cells on the home keep the cell and state styles of the chart in the initial CSS (D11, D14).
  - [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md) is amended by point 8; its Status line says so.
  - [p8-plan.md](../archive/p8-plan.md): the decisions fill the last column of section 4.2, Q2 records the medians, and the cards of PRs 1–6 are rewritten against the export.
  - The P8 workbench artifact is deleted after this export is merged.
