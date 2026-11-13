# ResultChart

The chart of `/stats` (a lazy route: charts are allowed there, never on `/`). It draws what the page computed and nothing else: hand-written SVG, no library. The per-second chart on typing results is out of the MVP (ADR 058).

Used twice:

| chart | marks | axis |
| --- | --- | --- |
| `trend` / `динамика` — typing, one metric of the selected tests | `points`: one mark per test; `line`: the median of the last 10 tests; `band`: their middle half (25–75%) | x — time over the chosen period; y follows the data (below) |
| `answer time` / `время ответа` — learning, one track | `ranges`: one bar per day — the middle half of the day's recall answers with a tick at the median, both read from the day's 100ms bins; one bar per week when more than 45 days are on the axis | x — time; y in steps of 250 or 500 ms; `reference` — the target answer time, a dashed hair line `target 1500 ms` / `цель 1500 мс` |

**Form (decision 103).** Every test is a mark, so one test is one honest mark and 200 tests show their spread. The line is the median of the last 10 tests of the selection — the same window as the average on the results screen — and the band is the middle half of that window. Speeds of different modes do not compare: with `all modes` selected there is no line and no band, only the marks, and a caption says so.

**Few tests (decision 104).** Fewer than five tests: no time axis and no line. The chart is at most 480px wide and has five slots in a row; the tests fill the first ones in order, each with its number above (`pointLabels`) and its date below. The empty slots are the tests still missing; under the chart: `the median line appears from the 5th test` / `линия медианы появится с 5-го теста`. No tests in the selection: no chart, a `Notice` (`no tests in this selection` / `в этой выборке тестов нет`) with `show all time` / `показать всё время`.

**The y axis follows the data (decision 106).** One metric at a time, chosen with a `Segmented`; never two y scales on one chart.

| metric | domain | note |
| --- | --- | --- |
| `kpm` | the tests' own range rounded to tens, at least 20 wide; never forced to 0 | a mark's height is a position, not a bar: no zero is needed |
| `kana accuracy` / `точность по кане` | top 100%, bottom 90% or the lowest test rounded down to 5 | so 94% and 97% are told apart |
| `rejected keys` / `отброшенные нажатия` — `rejectedKeystrokes / keystrokes`, % | 0 to at least 5% | `lower is better` / `меньше — лучше` in the legend |
| `hints` / `подсказки` — `assisted`, a count per test | 0 to at least 3 | `lower is better` |

- **Not colour alone.** A test is a `fur-dim` dot; the personal best of the mode is a ring in `eye` (the badge's outline), a repeat is a hollow dot; the legend under the chart names each mark that is on it. Every value is in the tooltip.
- **Tooltip** (hover, or ← → with focus on the chart; exception to Tooltip's one-line rule, decision 107): `6 Nov, 15:02 · words · 60 s` / `92 kpm · accuracy 94%` / `rejected 5% · hints 0`, then `personal best` or `repeat` when it applies. A day bar: `29 Oct` / `median 1050 ms · 19 answers` / `middle half 850–1350 ms`; a week bar starts with `week of 26 Oct` / `неделя с 26 окт.` A `chart-cursor` vertical and a ring mark the item.
- **Keyboard.** The chart is one Tab stop: ← → step through the marks in time order (the tests, or the bars when there are no tests), `Home` / `End` jump to the first and the last, `Esc` clears. The tooltip is a live region. The history table under the chart is the same data as text.
- Tokens: marks `fur-dim`, line and median tick `chart-kpm`, band `heat-fur-1`, bars `heat-fur-3`, grid `chart-grid`, cursor and ring `chart-cursor`, target line `line-strong` dashed, axis `fur-dim` `mono-small`, numbers over marks `fur`. No new token.
- Drawn at the container's real width (`ResizeObserver`), so axis text does not scale on a phone; x labels thin out below 640px.
- The line is drawn in over `dur-draw` (`stroke-dashoffset`) and the band fades in (`opacity`), once when the chart appears; no motion under `prefers-reduced-motion`.
