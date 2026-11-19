# ResultChart

The answer-time chart of `/stats` (a lazy route: charts are allowed there, never on `/`). It draws what the page computed and nothing else: hand-written SVG, no library. Since decision 130 it has one use; the typing trend chart (points, the median line and band, decisions 103–107 and 113) left with the typing trainer.

| chart | marks | axis |
| --- | --- | --- |
| `answer time` / `время ответа` — one track | `ranges`: one bar per day — the middle half of the day's recall answers with a tick at the median, both read from the day's 100ms bins; one bar per week when more than 45 days are on the axis (the bins added up) | x — time over the chosen period; y follows the data (below); `reference` — the target answer time, a dashed hair line `target 1500 ms` / `цель 1500 мс` |

**The y axis follows the data (decisions 109, 113).** The range — every bar's middle half and the target — is snapped out to the smallest step of 250, 500, 1000, 2000, 5000 ms that gives at most four intervals, so the axis ends on a labelled gridline. The target is never on the upper edge. `lower is better` / `меньше — лучше` in the legend.

- **Not colour alone.** A bar is a position and a length; every value is in the tooltip.
- **Tooltip** (hover, or ← → with focus on the chart; exception to Tooltip's one-line rule, decision 107): a day bar — `29 Oct` / `median 1050 ms · 19 answers` / `middle half 850–1350 ms`; a week bar starts with `week of 26 Oct` / `неделя с 26 окт.` A `chart-cursor` vertical and a ring mark the item.
- **Keyboard.** The chart is one Tab stop: ← → step through the bars in time order, `Home` / `End` jump to the first and the last, `Esc` clears. The tooltip is a live region.
- Tokens: bars `heat-fur-3`, median tick `chart-median`, grid `chart-grid`, cursor and ring `chart-cursor`, target line `line-strong` dashed, axis `fur-dim` `mono-small`.
- Drawn at the container's real width (`ResizeObserver`), so axis text does not scale on a phone; x labels thin out below 640px.
- No animation: the bars appear with the chart.
