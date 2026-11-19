# ActivityMap

Activity by day on `/stats` (decisions 108, 137): a calendar grid that shows the streak as a picture. One column per week (Monday first, in both languages), one cell per day, the last cell is today.

**It fills the width it is given** (decision 137). As many weeks as fit at the smallest cell (`minCell`, 16px), at most 26; the cells then grow to the edge, at most 28px. The layout never depends on the length of the history: three weeks of answers sit in the same frame as half a year, and the weeks before the first answer are empty outlines. On `/stats` the map takes three of the four columns: 26 weeks with cells of about 24px on a desktop, about 15 weeks with 16px cells on a phone. Wider than 26 × 32 + 40 = 872px it stops growing.

| what | data | look |
| --- | --- | --- |
| fill | recall answers of the day, both tracks — the sum of the day's answer-time bins (`recallBuckets`) | `heat-fur-1…5`: 1–9, 10–24, 25–49, 50–99, 100 and more |
| no answers | — | an empty cell with a `line` outline |
| a day of the current streak (`run`) | the days counted by the current streak, ending today or yesterday | a dot in the cell's ink (`fur-dim`, `fur` or `on-fur`), a quarter of the cell, at least `space-1` |
| today | — | a `stroke-mark` border in `eye` ("where you are now") |

- **The dots tie the map to the number.** The streak number next to the map and the run of dotted cells show the same days; the legend names the dot `current streak` / `текущая серия`. The dot is in the cell's ink, not `eye`: `eye` is only today.
- **Not colour alone:** empty is an outline, the streak is a shape, and every cell has the numbers in its tooltip and `aria-label`: `6 Nov` / `51 answers` / `current streak` / `today`; `no answers` / `нет ответов` for an empty day.
- A day that is active (`activeDays`) but has no recall answer — recognition tasks only — is drawn at step 1 (`active`).
- Cells are `space-1` apart, `radius-xs`. Month names over the first week of a month, `Mon` `Wed` `Fri` / `пн` `ср` `пт` at the left, `mono-small` `fur-dim`. The legend under the grid is part of the component; its swatches keep the base size (`space-4`).
- **Keyboard.** One Tab stop (roving `tabIndex`): ← → move by a week, ↑ ↓ by a day, `Home` / `End` to the first and the last day. Focus shows the tooltip; a tap does the same on a phone.
- The cells may be smaller than `touch-min`: a cell is not an action, it only shows a tooltip, and the same numbers are not needed to use the page.
- No animation. It is drawn only in the lazy `/stats` chunk, never on `/`.
