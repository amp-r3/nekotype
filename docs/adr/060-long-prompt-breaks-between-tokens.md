# ADR 060: A Prompt Longer Than a Line Breaks Between Tokens

- **Status:** In force. Amends [ADR 047](047-stream-trimmed-by-whole-lines.md), item 1.
- **Context:** ADR 047 never breaks a prompt: `.nk-word` is `nowrap`, and a line breaks only between prompts. A phrase wider than the whole stream line, which happens at 360 px, then runs past the edge of the stream. Design system version 10 (decision 33, [ADR 059](059-design-system-v10.md)) asks for a break inside such a prompt only, at a place that does not split what is read as one unit.
- **Decision:**
  1. A prompt that fits a line is never broken, as before; lines break between prompts.
  2. A prompt wider than the whole line may break inside, only between tokens. A break never splits a yōon (`きょ`), `っ` from the kana after it, a kana from the `ー` after it, a kana from the punctuation after it, or an opening bracket from the kana after it.
  3. The characters of each such unit are grouped in a `nowrap` element. The writer's measurement marks a prompt wider than the line as long, which lets it wrap at those groups. The mark is set when the stream is measured (start, resize, fonts loaded), never on a keystroke.
- **Justification:** A phrase that overflows cannot be read or typed; breaking it between tokens keeps each kana with what modifies it, so the reading of the line does not change. Marking only prompts wider than a line keeps every other prompt whole, so ADR 047's guarantee that trimming whole lines leaves the rest in place still holds: the breaks of a long prompt depend only on the line width, which a keystroke does not change. Alternatives rejected:
  - scrolling the stream sideways: the caret could leave the screen;
  - a smaller font for long phrases: it changes the size of the text the user is reading and still fails for the longest phrases.
- **Consequences:** The stream writer groups characters by token and measures prompt widths on layout; the e2e stream test gains a case with a phrase wider than a 360 px line. Implemented in P3 ([Implementation phases](../spec/phases.md)).
