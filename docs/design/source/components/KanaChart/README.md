# KanaChart

The kana table of a track. MVP mode: `state` — the learning table on `/` (ADR 058). It replaces the `box` mode. The heatmap modes `miss` and `time` are not used in the MVP; `box` is superseded by `state`.

**Composition — the groups of `docs/spec/learning.md`, rows by the engine's `RowId`:**

| block | rows | hiragana | katakana |
| --- | --- | --- | --- |
| basic | vowels, k, s, t, n, h, m, y, r, w_n (わ を ん) | 10 | 10 |
| voiced | g, z, d, b, p | 5 | 5 |
| combinations | ky, sh, ch, ny, hy, my, ry, gy, j, by, py | 11 | 11 |
| extended | ext_fa, ext_va, ext_wi, ext_ti, ext_che | — | 5 |
| **total groups / kana** | | **26 / 104** | **31 / 125** |

Basic and voiced rows are aligned to the a·i·u·e·o columns (`y` has gaps). The vowel row has no consonant head: its head column stays empty at the same width, so あ い う え お line up with the columns below, and its row header is named `vowels` / `гласные` for screen readers (`aria-label` on the `rowheader` cell — the name a screen reader announces for the row). `a` is never used as the head: it would read as the a column. `w_n`, combinations and extended rows run consecutively. Two-character kana is set in `jp-cell-sm` to fit a 44px cell. Take the composition from `kanaRows(script)` and `kanaOf(script)`. At 360px everything is one column (the widest row, `ext_ti`, is 6 cells, 320px). Unlocked cells of a row need not be consecutive: in `ext_va`, ヴ unlocks before ヴァ and ヴィ.

## `state` mode

Data per kana: `{ state, box, due, next, median, acc, answers, mixups, recog }`. A kana without data is locked. `nextUnlock` names the locked kana that opens next. Four states, each with a marker that does not depend on colour (checked in grayscale on the preview), plus one mark:

| state | meaning | marker | contrast |
| --- | --- | --- | --- |
| locked | not unlocked | no border, no fill, kana `fur-faint`; `aria-disabled` but focusable | 2.78:1 — disabled, exempt |
| learning | unlocked, not confident, any box (incl. box 4–5 that lost confidence — it holds the next unlock) | `line-strong` border | kana 13.82:1; border 3.31:1 on `bg` |
| confident | confident, box 1–3 | `heat-fur-3` fill | kana `fur` 5.28:1; fill 2.62:1 on `bg` |
| mastered | confident, box 4–5 | `heat-fur-4` fill + 2px `eye` mark under the cell (the system's signature) | kana `on-fur` 6.10:1; mark 9.47:1 |

**Review due is a mark, not a state.** It sits over confident or mastered when the review date has come: a folded corner (top right, `space-2`) in the cell's ink — 5.28:1 on confident, 6.10:1 on mastered; on mastered the `eye` mark stays. `due` on a learning kana is ignored (learning kana are not scheduled for review). The legend sets the mark apart from the four states. Preview: あ in state A is mastered and due at once; し, つ, ふ, へ are confident and due — `review (5)`.

- The due mark is drawn in the cell's ink (`currentColor`), not in `eye` (which means "where you are now") and not in `miss` (errors and blocked actions only).
- **Tooltip** (hover and focus; exception to Tooltip's one-line rule) and **`aria-label`** carry the same lines — `kanaStateLines()`:
  1. `し · shi`
  2. state; for confident and mastered add `review due` / `пора повторить` or `next review: 9 Nov` / `повторение: 9 нояб.`
  3. `median 1050 ms · accuracy 90%` / `медиана 1050 мс · точность 90%` over the last 10 recall answers; with fewer than 10 add `6 of 10 answers` / `6 из 10 ответов`. An unlocked kana that has not been introduced: `not introduced yet` / `ещё не показана`. Locked: kana and `locked` / `закрыта`, no romaji; the kana that opens next (`nextUnlock`) adds `opens next` / `откроется следующей`: `み` · `locked · opens next`. The cell itself carries no extra marker.
- **Activation** (click, tap, `Enter`, `Space`) on an unlocked cell opens the details inline under the cell's row (`KanaChartDetails`): `mixed up with` / `путали с` + the kana chosen instead in recognition, most first (`め ×4, ね ×2`), or `no mixups yet` / `путаниц пока нет`; and `recognition accuracy 78% (14 of 18)` / `точность узнавания 78% (14 из 18)`. Not a card: no fill, no border. Closes with the same cell, `Esc` (focus returns to the cell) or `close` / `закрыть`. The cell carries `aria-expanded`.
- One tooltip at a time; the table is a grid of buttons, no charts, no animation — it is in the initial chunk of `/`.
- `role="grid"`, cells are buttons with a roving `tabIndex` (one Tab stop). ← → go in order, ↑ ↓ — to the nearest column of the adjacent row, including across blocks.

## `miss`, `time`, `box` — not used in the MVP (ADR 058)

| mode | steps | text in the cell |
| --- | --- | --- |
| `miss` — error rate | `heat-miss-1…5` (> 0, 3, 7, 12, 20%) | 1–3 `fur`, 4–5 `on-fur` |
| `time` — reaction, ms | `heat-fur-1…5` (< 450, 600, 750, 950, more) | 1–3 `fur`, 4–5 `on-fur` |
| `box` — superseded by `state` | `heat-fur-1…5`; 4–5 = mastered, `eye` mark | same |
