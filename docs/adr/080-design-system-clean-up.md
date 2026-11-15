# ADR 080: The Design System Keeps Only What the Product Uses

- **Context:** The design artifact had grown parts that nothing in the product uses. The `line` and `silhouette` cats and marks were archived when the `geometry` style was chosen. `RowPicker` left with kana tests (ADR 058) and `VerticalLabel` with Japanese mode labels (design decision 85), but their code, guidelines and previews stayed, marked "not used in the MVP". `KanaChart` carried the `time` and `box` modes next to `state` and `miss`. Four tokens and one text style were referenced by no rule. The `StatsExplorations` sheet of chart variants stayed after its choices were recorded (ADR 076). Every component preview carried the whole demo script of the screens, about 30 KB each, and used a few functions of it. A reader of the system could not tell the reference from the leftovers. The maintainer asked for the clean-up on 15 November 2026.
- **Decision:** Design decision 125 in [`decisions.md`](../design/source/decisions.md), exported from the design artifact.
  1. **Cat.** One style. The six `line` and `silhouette` cat files and the two marks are deleted from the artifact, with their drawings in `bundle.js`, the `variant` prop of `Cat` and the `stroke-cat` token. `grumpy` stays reserved (ADR 065).
  2. **Components.** `RowPicker` and `VerticalLabel` are removed: guidelines, previews, reference code, styles and types.
  3. **`KanaChart`.** Two modes: `state` and `miss`.
  4. **Tokens.** `radius-0`, `test-lines`, `test-lines-sm`, `stroke-cat` and the text style `jp-vertical` are removed from `tokens.json` and from `shared/styles/tokens.css`, which a test keeps equal to it. The stream still shows 3 lines, 2 below 640 px: the rule is in the `TestArea` guidelines.
  5. **Previews** (artifact only). `StatsExplorations` is removed. Each component preview keeps only the demo code it uses. The screen previews still share one identical script, without the variants sheet and without the code nothing called.
- **Justification:**
  - The export is the reference the application is checked against. A component marked "not used" still has to be read, kept in step with the tokens and skipped in every audit.
  - Nothing is lost: the earlier rows of `decisions.md` keep the removed names and the reasons, and the files are in the git history before this change.
  - The tokens are removed from the code in the same change because `tokens.test.ts` compares the two files; no rule in the application used them.
  - The previews were checked in a browser before and after: every remaining preview renders the same DOM, except the `Cat` card, which lost its archive row.
- **Rejected alternatives:**
  - _Keep the archive in the artifact._ It was not exported and not used; a third cat style would be a new decision with new drawings.
  - _Prune each screen preview to its own code._ The 21 screen previews share one script on purpose: a change to the demo data is made once and copied. Component previews do not share data in that way.
  - _Remove `bp-narrow`._ CSS cannot use a variable in a media query, so no rule reads it, but the system and the code name the 640 px breakpoint by it.
- **Consequences:**
  - The token test now expects 18 text styles.
  - If the vertical label, the row picker or another cat style returns, it is drawn again from the git history as a new decision.
- **Status:** In force.
