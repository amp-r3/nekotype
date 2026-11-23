# ADR 107: The Design System Catches Up With P7 and Loses Its Leftovers Before P8

- **Status:** In force.
- **Context:**
  - P7 changed learning ([ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), [ADR 104](104-learning-on-the-model.md)), but the design export still drew the model before it: `confident`, Leitner boxes, `review (N)` and a review session. The P7 code kept the old names in places and [docs/design/README.md](../design/README.md) listed the differences.
  - The export also kept the phase numbers before [ADR 099](099-learning-home-methods-and-phases-after-p6.md), a cover drawn for the typing trainer, and notes of earlier sessions ("proposal", "left with the typing trainer").
  - [ADR 106](106-design-sessions-in-a-workbench-artifact.md), point 6, put a clean-up before the P8 session, so that the P8 workbench shows the real application as "now". The maintainer reviewed it in a workbench on 2026-11-23: "now" and "after" of each changed screen, and three rounds of the cover.
- **Decision:** Design decision 139 in [`decisions.md`](../design/source/decisions.md), exported from the design artifact.
  1. **`KanaChart`.** `learned` replaces `confident`, with the same fill: learned with stability under 21 days; `mastered` is 21 days or more. Locked means not introduced, so on a first visit every kana is locked and the first vowel opens next. A kana's data lose `box`; `nextUnlock` becomes `opensNext`. An introduced kana without a recall answer has no third tooltip line.
  2. **`/`.** One action, `continue`. The progress line gains `due: N`, hidden at 0, as the P7 code shows it.
  3. **Session and summary.** One kind of session, up to 30 tasks. The summary lists `introduced` and `learned`.
  4. **Settings.** The hint of the target answer time is the code's.
  5. **Phases** of ADR 099 in the guidelines and previews: the sound P10, words and the report dialog P12, the data on this device P14.
  6. **Cover** (artifact only). The main logo with the tagline «Кана с нуля до автоматизма.» beside a fragment of the kana table in its four states.
  7. **Guidelines** describe what is; the history of a change stays in `decisions.md`. The option rule of `OptionCard` follows [Learning](../spec/learning.md), "Recognition options".
  8. **Previews** (artifact only). The screen previews load one script and one stylesheet instead of fifteen copies of them.
- **Justification:**
  - The P8 session redraws the home, Progress, the summary and the session screen. Starting from a design that matches the code shows what P8 changes, not what P7 already changed.
  - The rename and the removals follow decisions already taken in ADRs 099, 100 and 104, so the clean-up makes no new product decision. The cover is the one visual choice, and the maintainer made it.
  - One copy of the screens' script makes a change to the screens' data one edit instead of fifteen. The P8 workbench loads the same file for "now".
- **Rejected alternatives:**
  - _Leave the catch-up to the P8 session_, as item o of the P8 brief planned. The session would mix P7's renames with P8's new screens, and its "now" would show a model that no longer exists.
  - _Keep the typing cover until P8._ It shows a product that left with ADR 093.
  - _Covers without the logo:_ one task, or an abstract path of squares. The first shows input rather than learning; the second needs its tagline to be read. Taglines `Кана с нуля — с клавиатуры.` and `Кана с нуля. Повторения — вовремя.` were set aside: the first names the means, not the result; the second is longer and reads as work.
- **Consequences:**
  - The export changes `README.md`, `decisions.md`, `tokens.json` (usage notes only, no value), twelve component guidelines, `bundle.js`, `bundle.css` and `index.d.ts`. No token, text style or glyph changes, so `tokens.css` and `tokens.test.ts` do not change.
  - The code already does what the export draws. The class `is-st-learned` and the `due: N` line were the code's names before this export.
  - [docs/design/README.md](../design/README.md) loses its note on the P7 code. [docs/design/workflow.md](../design/workflow.md) names the shared screens' script.
  - [p8-plan.md](../../p8-plan.md): row o of the brief names decision 139, and the P8 session numbers its decisions from 140.
