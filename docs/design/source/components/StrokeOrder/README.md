# StrokeOrder

The stroke order of a kana at the top of its details (decision 174), and `Strokes`, the drawing it is made of, which a transfer's introduction also uses for the origin kanji (decision 169).

**Data.** KanjiVG centre lines (CC BY-SA 3.0, Ulrich Apel) in a 109 × 109 box: per glyph the paths in writing order (`s`), the place of each stroke's number (`n`), `small` for ゃ ゅ ょ っ, and for an origin kanji the strokes the kana kept (`kept`). In the app they come from the stroke chunk of the track and `origins.json` (D2, D27).

**StrokeOrder** — `glyphs` (one per character; a yōon gives two), `label` (`stroke order: ぬ` / `порядок черт: ぬ`, the image's name for a screen reader), `replayLabel`.

- Each glyph in a box: 112px (88px below 640px), `line` border, `radius-sm`, `bg` fill. Strokes `fur`, 3.5 units wide, round caps. Numbers at the start of each stroke: Mono, 11 units, `fur-dim`.
- A small kana is drawn at 70% from the bottom left of its box, as it sits in writing; KanjiVG draws it full size.
- **Drawing.** When the dialog opens the strokes draw one after another. The pen moves at one speed: a stroke takes its length / 0.16 units per ms, at least 260ms, and 140ms pass between strokes (ぬ: 0.4 s, then 1.8 s). The stroke being drawn is `eye`, then `fur`; its number appears when it starts. The glyphs of a yōon draw in turn.
- `replay` / `ещё раз` — `Button secondary sm` with the `reset` icon, under the boxes — draws them again.
- Under `prefers-reduced-motion` everything is there at once.
- While the data loads and after a failure the box keeps its size and holds nothing; `replay` is disabled. No message: the details read without it.

**Strokes** — `glyphs`, `numbers`, `boxed`, `size` (`md` 112, `sm` 88, `origin` 88 / 56 below 640px), `still`, `run` (a new value draws again), `label`. For an origin kanji: no box and no numbers, the kept strokes `eye`, the rest `fur-dim`; it draws once when the introduction appears.

The drawing animates `stroke-dashoffset` and the stroke's colour — the one exception to "only `transform` and `opacity`", allowed because it is never on the hot path (decision 177).
