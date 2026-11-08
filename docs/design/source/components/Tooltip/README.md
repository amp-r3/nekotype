# Tooltip

A short hint: what a metric means, the value of a chart point.

- Inverted: `fur` / `on-fur`, `ui-caption`, `radius-sm`, no shadow.
- Opens on hover and focus; the trigger has `aria-describedby`. One line, up to 40 characters.

**Exception (ADR 058): the kana table tooltip.** `KanaChart` in the `state` mode shows up to three lines, which may exceed 40 characters: kana and romaji; state and review timing; median answer time and accuracy (+ `n of 10 answers`). The same text is the cell's `aria-label`. Example: `し · shi` / `confident · review due` / `median 1050 ms · accuracy 90%`.
