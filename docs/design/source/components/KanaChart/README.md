# KanaChart

The kana table of a track on `/progress`: where each kana stands; a kana opens its details.

**Composition — the groups of `docs/spec/learning.md`, rows by the engine's `RowId`:**

| block | rows | hiragana | katakana |
| --- | --- | --- | --- |
| basic | vowels, k, s, t, n, h, m, y, r, w_n (わ を ん) | 10 | 10 |
| voiced | g, z, d, b, p | 5 | 5 |
| combinations | ky, sh, ch, ny, hy, my, ry, gy, j, by, py | 11 | 11 |
| extended | ext_fa, ext_va, ext_wi, ext_ti, ext_che | — | 5 |
| **total groups / kana** | | **26 / 104** | **31 / 125** |

**Layout.** The blocks stand side by side and wrap (`nk-kc__grid`: `flex-wrap`, `space-8` between blocks, `space-6` below 640px): on a desktop basic, voiced, combinations and extended fill the width of the page in columns; on a phone they stack into one column. Each block has its caption (`basic` / `основные`, …). The table is never a single column of all rows on a wide screen (decision 93).

Basic and voiced rows are aligned to the a·i·u·e·o columns (`y` has gaps). The vowel row has no consonant head: its head column stays empty at the same width, so あ い う え お line up with the columns below, and its row header is named `vowels` / `гласные` for screen readers (`aria-label` on the `rowheader` cell — the name a screen reader announces for the row). `a` is never used as the head: it would read as the a column. `w_n`, combinations and extended rows run consecutively. Two-character kana is set in `jp-cell-sm` to fit a 44px cell. Take the composition from `kanaRows(script)` and `kanaOf(script)`. At 360px everything is one column (the widest row, `ext_ti`, is 6 cells, 320px). Introduced cells of a row need not be consecutive: in `ext_va`, ヴ is introduced before ヴァ and ヴィ.

## States

Data per introduced kana: `{ state, due, next, median, acc, answers, mixups, recog }`. A kana without data is locked: the knowledge model has not introduced it. `opensNext` names the locked kana that opens next. Four states, each with a marker that does not depend on colour (checked in grayscale on the preview), plus one mark:

| state | meaning | marker | contrast |
| --- | --- | --- | --- |
| locked | not introduced | no border, no fill, kana `fur-faint`; `aria-disabled` but focusable | 2.78:1 — disabled, exempt |
| learning | introduced, learning (a forgotten kana returns here) | `line-strong` border | kana 13.82:1; border 3.31:1 on `bg` |
| learned | learned, stability under 21 days | `heat-fur-3` fill | kana `fur` 5.28:1; fill 2.62:1 on `bg` |
| mastered | learned, stability 21 days or more | `heat-fur-4` fill + 2px `eye` mark under the cell (the system's signature) | kana `on-fur` 6.10:1; mark 9.47:1 |

**Review due is a mark, not a state.** It sits over learned or mastered when the model reviews the kana before the next session: a folded corner (top right, `space-2`) in the cell's ink — 5.28:1 on learned, 6.10:1 on mastered; on mastered the `eye` mark stays. `due` on a learning kana is ignored. `continue` on `/` reviews them first: the reason `5 kana are due for review` counts the marked kana of both tracks. The legend (`nk-kc__legend`, under the table: the four states, a gap, then the due mark) sets the mark apart from the four states; it is part of the component and is always drawn. Preview: あ in state A is mastered and due at once; し, つ, ふ, へ are learned and due — `due: 5`.

- The due mark is drawn in the cell's ink (`currentColor`), not in `eye` (which means "where you are now") and not in `miss` (errors and blocked actions only).
- **Tooltip** (hover and focus; exception to Tooltip's one-line rule; above the cell, never below it, so it does not cover the row under it; one at a time, gone when the pointer leaves the table) and **`aria-label`** carry the same lines — `kanaStateLines()`:
  1. `し · shi`
  2. state; for learned and mastered add `review due` / `пора повторить` or `next review: 9 Nov` / `повторение: 9 нояб.`
  3. `median 1050 ms · accuracy 90%` / `медиана 1050 мс · точность 90%` over the last 10 recall answers; with fewer than 10 add `6 of 10 answers` / `6 из 10 ответов`; an introduced kana without a recall answer yet has no line 3. Locked: kana and `locked` / `закрыта`, no romaji; the kana that opens next (`opensNext`) adds `opens next` / `откроется следующей`: `み` · `locked · opens next`. The cell itself carries no extra marker.
- **Activation** (click, tap, `Enter`, `Space`) on an introduced cell calls `onOpen(kana)`: the page opens the kana details in a `Dialog` (decision 147; the content is in README, "Kana details"). The cell carries `aria-haspopup="dialog"`; a locked cell opens nothing. The dialog gives the focus back to the cell. The table has no panel of its own.
- One tooltip at a time; the table is a grid of buttons, no charts, no animation.
- `role="grid"`, cells are buttons with a roving `tabIndex` (one Tab stop). ← → go in order, ↑ ↓ — to the nearest column of the adjacent row, including across blocks.
