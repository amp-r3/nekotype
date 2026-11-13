# ActivityMap

Activity by day on `/stats` → learning (decision 108): a calendar grid that shows the streak as a picture. One column per week (Monday first, in both languages), one cell per day, the last cell is today. As many weeks as there is history: at least 12, at most 26; at most 13 below 640px.

| what | data | look |
| --- | --- | --- |
| fill | recall answers of the day, both tracks — the sum of the day's answer-time bins (`recallBuckets`) | `heat-fur-1…5`: 1–9, 10–24, 25–49, 50–99, 100 and more |
| no answers | — | an empty cell with a `line` outline |
| typing test that day | finished tests by `endedAt` | a `space-1` square in the cell's ink (`fur-dim`, `fur` or `on-fur`) |
| today | — | a `stroke-mark` border in `eye` ("where you are now") |

- Learning and typing are not added into one number (A39): the fill is learning, the square is typing.
- **Not colour alone:** empty is an outline, a test day is a shape, and every cell has the numbers in its tooltip and `aria-label`: `6 Nov` / `51 answers · 3 tests` / `today`; `no activity` / `нет активности` for an empty day.
- A day that is active (`activeDays`) but has no recall answer — recognition tasks only — is drawn at step 1 (`active`).
- Cells are `space-4` squares `space-1` apart, `radius-xs`. Month names over the first week of a month, `Mon` `Wed` `Fri` / `пн` `ср` `пт` at the left, `mono-small` `fur-dim`. The legend under the grid is part of the component.
- **Keyboard.** One Tab stop (roving `tabIndex`): ← → move by a week, ↑ ↓ by a day, `Home` / `End` to the first and the last day. Focus shows the tooltip; a tap does the same on a phone.
- The cells are smaller than `touch-min`: a cell is not an action, it only shows a tooltip, and the same numbers are not needed to use the page.
- No animation. It is drawn only in the lazy `/stats` chunk, never on `/`.
