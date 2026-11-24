# Switch

A switch for a binary setting. Its setting is the sound of P10, `kana sound` / `звук каны` in the Learning section of `/settings` (decision 151); the `ScreenSettings` preview shows it with `later` → P10.

**In code: `Toggle`** — track 32×16, knob 12px, label to the right of the track. The system keeps its own spec (decisions.md, 14): label and description on the left, 34×20 track on the right, so a settings row can carry a description and the control sits at a predictable edge.

- Knob: off — `fur-dim` on the left, on — `eye` on the right. The state also reads from the knob's position, not only its colour.
- The description is a consequence, a sentence.
- Disabled — `fur-faint` label and knob, `line` border.
- **Sound (P10)** is not shown before P10: a switch that changes nothing has no function (decision 72).
