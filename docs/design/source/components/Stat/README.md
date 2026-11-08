# Stat

A metric: label, number, unit, and — for KPM on typing results — comparisons.

- `size="hero"` — KPM, one per screen: `mono-hero`, below 640 — `mono-hero-sm`. Label `kpm`, no unit. Other metrics — `mono-stat`: `kana accuracy` / `точность по кане` `94 %`, `time` / `время` `60 s` / `60 с`; on `/stats` — `current streak` / `текущая серия`, `best streak` / `лучшая серия` with `days` / `дней`.
- `badge` — the slot for `PersonalBestBadge` next to the KPM label.
- `comparisons` — lines under KPM, `ui-label` / `fur-dim`, the signed number in `mono-romaji` / `fur`:
  - `+8 vs average (84)` / `+8 к среднему (84)` — the average of the last 10 tests with the same mode, repeats excluded, before this test. No earlier tests — no line.
  - `−9 vs personal best (101)` / `−9 до рекорда (101)`.
  - On a personal best: `+3 vs previous best (101)` / `+3 к прежнему рекорду (101)` instead of the personal best line.
- **No colour judgement:** the number is always `fur`, never green or `miss`. Minus is U+2212 (on "Glyphs to add to subsets").
- Out of the MVP: IPM, keystroke accuracy, best in-test streak, reaction time (ADR 058).
