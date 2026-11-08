# ResultChart

A one-line chart on `/stats` (a lazy route: charts are allowed there, never on `/`). The per-second chart on typing results is out of the MVP (ADR 058).

Used twice:

| chart | values | axis | extras |
| --- | --- | --- | --- |
| daily median answer time, per track (`daily median answer time, ms` / `медиана ответа по дням, мс`) | midpoints of 100ms bins (1050, 1150, …); `null` for a day without answers — a gap, never an invented value | `domain` 1000–2000, ticks 1000 / 1500 / 2000; x — dates `16 Oct` / `16 окт.` | `reference` — the target answer time as a dashed hair line `target 1500 ms` / `цель 1500 мс`; `dots` — every point marked, so isolated points stay visible; caption `lower is better` / `меньше — лучше` |
| `kpm per test` / `kpm по тестам` | KPM of finished tests, repeats excluded | 0 / 60 / 120; x — test number | — |

- One line per chart. Two tracks: one chart with a track switch (`Segmented`, `hiragana` / `katakana`), not two charts (decision 68).
- "Lower is better" reads without colour: the caption and the target line — points under the line are faster than the target. The axis is not inverted (decision 67).
- Line `chart-kpm` 2px — the token keeps its name and now draws every line on `/stats` (decision 69); grid `chart-grid`; target line `line-strong`, dashed; axis labels `fur-dim`, `mono-small`.
- Drawn at the container's real width (`ResizeObserver`), so axis text does not scale on a phone.
- Hover or ← → with focus on the chart: a `chart-cursor` vertical and a tooltip (`tip(i, v)`): `31 Oct · no answers`, `test 14 · 84 kpm` / `тест 14 · 84 kpm`.
- Drawn in over `dur-draw` (`stroke-dashoffset`), once when the screen appears.
