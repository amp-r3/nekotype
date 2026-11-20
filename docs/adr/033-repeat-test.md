# ADR 033: Repeat Test

- **Status:** Superseded by [ADR 093](093-learning-only-words-in-learning.md): the repeat of a typing test left with the typing trainer in P6.
- **Context:** The design system had a "Repeat" button on the results screen that the spec did not define. With new prompts it would duplicate "Next test", so it needs behaviour of its own. Repeating known text is easier, which affects personal bests.
- **Decision:**
  - "Repeat" runs the prompts of the finished test in the same order with the same settings. When a time or zen test runs out of them, new prompts follow.
  - The result is saved and counted as usual, with `TestResult.repeated` = true. It never gives a personal best; the shared eligibility rule checks the flag, so the client and the server agree.
  - During a repeat the live line shows "repeat" in `fur-dim` with a `stroke-hair` outline. `miss` stays reserved for errors and blocked actions: the mark sits next to the accuracy figure, where red would read as an error.
  - A repeat stays out of the KPM-per-test chart, because known text would distort the trend. History keeps it, marked in the mode column.
  - "Repeat" has no shortcut: Enter stays on "Next test". Restart during a repeat starts an ordinary test.
- **Justification:** Practising the same text is useful and its statistics are real, but a record set on known text would not compare with the others. Alternatives rejected: new prompts with the same settings (identical to "Next test"); not saving repeats (loses real practice data); allowing personal bests (inflates them); a red mark, first considered by the maintainer, who then left the choice open (reads as an error).
