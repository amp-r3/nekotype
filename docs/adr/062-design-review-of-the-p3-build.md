# ADR 062: Design Review of the P3 Build: Details Panel, Due Kana, Displayed Romaji

- **Status:** In force. Amends [ADR 059](059-design-system-v10.md).
- **Context:** The maintainer reviewed the P3 build of `/` and found four questions that the code alone could not settle:
  - On a desktop the right half of `/` is empty.
  - The details of an activated kana read as loose text between the rows, and their `close` looks misaligned.
  - `review (N)` counts kana that the chart does not mark as due. The spec counted every kana in box 1 or higher with a past `dueAt`, while design decision 38 and the `KanaChart` README put the mark on confident and mastered kana only.
  - The introduction shows `nn` for ん, although one `n` completes it, and highlights the wrong letters of the ghost hint when the learner types another spelling (`hu` for ふ `fu`).

  The design export may not be edited by hand ([Design system](../design/README.md)), so these decisions were made in the design artifact (decisions 93–96 in `docs/design/source/decisions.md`) and exported again.

- **Decision:**
  1. **Layout of `/` (design 93).** The design stands: one track with the track switch. On a desktop the chart's blocks (basic · voiced · combinations · extended) stand side by side across the page width and wrap into one column below 640 px, with the legend under the chart. The empty half comes from the code, which draws every block in one column, so the fix belongs to the code.
  2. **Details panel (design 94).** Activating a cell opens a panel under its row: `bg-raised`, `radius-sm`, padding `space-3` × `space-4`, at most 360 px wide, with no border and no shadow.
     - The panel holds a head (the kana, its romaji, `close` aligned to the right padding), then the state with the review timing, the median and accuracy, the mixups and the recognition accuracy.
     - The panel is an exception to the "no fills" principle, like fields and dialogs.
     - The tooltip opens above the cell and is not shown on a cell whose panel is open.
     - `Esc` in the panel closes it and returns focus to the cell.
  3. **Due is the mark (design 95).** A kana is due when it is in box 1 or higher, its `dueAt` has passed and it is confident. `review (N)` counts exactly the due marks, and a review session asks only those kana. A kana that lost its confidence is learning: it is not reviewed, and the learning session trains it until it is confident again.
  4. **Displayed romaji (design 96).** Learning shows `canonicalFor` everywhere it shows a kana's romaji: the introduction, the recognition prompt, the romaji revealed by Esc, and the chart's tooltip and panel. The exception is ん and ン, which are shown as `n`. An introduction accepts only the shown spelling; another spelling is a rejected key (the caret flashes, nothing is recorded). Recall accepts every spelling of the learning strictness, as before.
- **Justification:**
  - **Layout.** Two tracks side by side were considered and rejected. `continue` and `review (N)` start a session of one track, the progress line is per track, and the blocks already fill the width. A side panel for the active kana was rejected as a second layout for one piece of information.
  - **Details panel.** Without a surface the details do not read as one unit. A panel that repeats the tooltip's lines lets a touch screen, which has no hover, see everything about a kana.
  - **Due kana.** Counting the marks makes the button and the chart agree. Reviewing a kana the learner has just lost would only send it back to box 1, which a learning session does anyway with more practice.
  - **Displayed romaji.** One accepted spelling keeps the ghost hint and the typed letters in step. `n` is the keystroke the learner actually needs for ん.
- **Consequences:**
  - The `docs/design/source/` export is updated:
    - `decisions.md` gets entries 93–96, and decisions 22 and 38 point to them;
    - the `KanaChart`, `KanaTask` and `Tooltip` READMEs, the README and the `bg-raised` usage text change;
    - `bundle.js` and `bundle.css` get the panel, and the tooltip is hidden on a cell whose panel is open;
    - the previews' romaji map shows ん as `n`.
  - [Learning](../spec/learning.md) changes:
    - a new "Displayed romaji" rule, used by the introduction, recall and recognition;
    - a strict introduction;
    - "due" requires confidence, and N equals the due marks;
    - the tooltip shows the review date for confident and mastered kana;
    - the details panel.
  - The code follows in separate PRs: the chart layout and legend, the panel, the review queue and `dueCount`, the displayed romaji and the strict introduction.
