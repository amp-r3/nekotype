# ADR 094: The Design System Without the Typing Trainer; `/stats` on a Fixed Grid

- **Status:** In force. Amends [ADR 059](059-design-system-v10.md), [ADR 076](076-stats-screen-redesign.md), [ADR 079](079-account-and-report-states.md) and [ADR 089](089-sign-out-text-and-dialog-fields.md), item 1.
- **Context:** [ADR 093](093-learning-only-words-in-learning.md) removes the typing trainer, and phase P6 takes it out of the code ([p6-plan.md](../archive/p6-plan.md)). The maintainer chose to change the design first (plan question Q1) and to remove the report dialog from the design too (Q2). The design session (plan step M1) changed the artifact by the proposals of Q1, items a–h. Reviewing the previews, the maintainer found the activity map on `/stats` narrow, with empty space beside it whose size depended on the length of the history. Variants were drawn side by side, and the maintainer chose one large streak number next to the map, with the streak's days marked on it, and asked for the whole screen to be composed again.
- **Decision:** Design decisions 128–137 in [`decisions.md`](../design/source/decisions.md), exported from the design artifact.
  1. **Typing leaves the system** (128). Removed: `TestArea` with `createTestController`, `Char`, `ModePanel` with `modeLine`, `TranslationLine`, `PersonalBestBadge`, `WeakKanaList`, `HistoryTable`, `Pagination`, `Textarea`; the `Toggle` item and the `lg` size of `Segmented`; the hero size, badge and comparisons of `Stat`; the `miss` mode of `KanaChart`; the points, line and band of `ResultChart`, which keeps the day bars and the target; the hidden chrome of `Nav` and `Footer`; the `restart` icon. The `/type`, setup and results previews are deleted. `Switch` stays for the sound setting of P8.
  2. **Navigation** is `learn · stats · settings` (129).
  3. **`/stats` is the learning section** (130): no section switch; with no answer and no started session, one `EmptyState` (`No answers yet` / `Ответов пока нет`, `to learning`).
  4. **`/settings`** has the sections Learning, Data and Account (131); the reset and delete texts name learning progress only. **`/about`** shows only the "Nekotype" section (132). **Sign-out** names unsent data with one line, `Some progress has not been sent yet…` (133).
  5. **Tokens** (134). Removed: `heat-miss-1…5`, `layout-test`, `dur-stagger`, `dur-draw`, `dur-blink`, `ease-inout` and the type style `jp-test`. Renamed: `chart-kpm` → `chart-median`, the same value. The proposal removed it, but the median tick of the answer-time chart uses it.
  6. **The report dialog leaves the design** (135). Decisions 23 and 114–117 stay as history; P10 draws the dialog again for word tasks.
  7. **Guidelines** (136): the typing sections of the design README go, and phase names follow ADR 093 (kana audio P8, release P12). The `content` cat waits for a place, as `grumpy` does.
  8. **`/stats` on a fixed grid** (137). Four equal columns across `layout-max`, two below 640 px. `streak and activity`: the current streak in `mono-hero` in column 1, with the best streak and the active days of the last 30, and the `ActivityMap` in columns 2–4. Then the totals: four `Stat`s for the mastered kana of each track and the sessions started and finished. Then `answer time` across the page. The map fills its width: as many weeks as fit at 16 px, at most 26, cells up to 28 px. A day of the current streak carries a dot in the cell's ink.
- **Justification:**
  - _Removal, not archiving._ The design system describes the product; components without a consumer would be read as current. P10 redraws what words need from history.
  - _`chart-median`._ The old name, kept by decision 69, names a metric that no longer exists. The value and the use stay, so the rename costs four lines of code.
  - _A fixed grid._ When block widths follow the data, the empty space moves with every new week of history. The grid fixes the widths by the screen, and a short history becomes empty cells inside a frame of known size. The streak goes next to the map because the map is the streak's picture. The dots make the number and the picture show the same days.
  - _Active days in a fixed window._ A count over the shown weeks would differ between a phone and a desktop, because the number of weeks follows the width.
- **Consequences:**
  - **The export** in `docs/design/source/` loses nine component folders. `bundle.js`, `bundle.css` and `index.d.ts` change with them: `ActivityMap` takes `maxWeeks`, `minCell` and `maxCell` instead of `weeks` and `weeksNarrow`, and a day gains `run`.
  - **In this PR** the code renames `--chart-kpm` to `--chart-median` (`tokens.css`, `pages/stats/ui/stats.css`) and updates the counts in `tokens.test.ts`, which reads the export: 17 text styles, at least 25 colours.
  - **Later P6 PRs:**
    - PR 1 removes the stream tokens and styles;
    - PR 3 removes `heat-miss-1…5` and `dur-draw` and builds the `/stats` grid, the streak column, the totals and the fitting `ActivityMap` with streak dots;
    - the plan's D1 and PR 3 entries name these changes.
  - **Amended ADRs:**
    - [ADR 076](076-stats-screen-redesign.md): its typing section, filters, test marks and the weak kana map are gone, and its section switch is replaced by one section;
    - [ADR 079](079-account-and-report-states.md): its report dialog states leave the design;
    - [ADR 089](089-sign-out-text-and-dialog-fields.md), item 1: the result count gives way to one line.
