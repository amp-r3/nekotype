# Switch

A switch for a binary setting. No setting uses it now: the only one, `show the translation under the text`, left with the typing trainer (decision 131). The sound setting draws it in P8.

**In code: `Toggle`** — track 32×16, knob 12px, label to the right of the track. The system keeps its own spec (decisions.md, 14): label and description on the left, 34×20 track on the right, so a settings row can carry a description and the control sits at a predictable edge.

- Knob: off — `fur-dim` on the left, on — `eye` on the right. The state also reads from the knob's position, not only its colour.
- The description is a consequence, a sentence.
- Disabled — `fur-faint` label and knob, `line` border.
- **Sound (P8)** is not shown before P8: a switch that changes nothing has no function (decision 72).
