# Tooltip

A short hint: what a metric means, the value of a chart point.

- Inverted: `fur` / `on-fur`, `ui-caption`, `radius-sm`, no shadow.
- Opens on hover and focus; the trigger has `aria-describedby`. One line, up to 40 characters.

**Exception (ADR 058): the kana table tooltip.** `KanaChart` shows up to three lines, which may exceed 40 characters: kana and romaji; state and review timing; median answer time and accuracy (+ `n of 10 answers`). The same text is the cell's `aria-label`. It opens above the cell and is not shown on a cell whose details panel is open (decision 94). Example: `し · shi` / `learned · review due` / `median 1050 ms · accuracy 90%`.

**Exception (decisions 107, 130): the `/progress` chart and the activity map.** A day or week bar of `ResultChart` shows three lines (the date; the median; the middle half and the number of answers), a cell of `ActivityMap` two to four (the date; the answers; `current streak`; `today`). Same reason as the kana table: the tooltip is where the numbers behind a mark are.
