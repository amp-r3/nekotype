# ADR 063: A Kana That Lost Its Confidence Is in Focus Again

- **Status:** In force. Amends [ADR 058](058-learning-first.md) (A40).
- **Context:** After the design review ([ADR 062](062-design-review-of-the-p3-build.md), decision 95) a kana that lost its confidence is shown as learning, and "the learning session trains it". Nothing in the task choice did that. A kana with 10 or more recall answers was out of focus whatever its accuracy, and out of focus a kana is chosen by weight: about 2.6 for the unconfident kana against about 100 in total for 30 confident ones. That is about 0.4 recall answers per session. Unlocking waits until the dependencies of the next kana are confident, so the unlock stopped for ten sessions or more.
- **Decision:** A kana is **in focus** when it has fewer than 10 recall answers or is not confident (the median of its last 10 answers above the target, or the accuracy below `CONFIDENT_ACCURACY`). The share of tasks that go to the kana in focus and the weight of a kana out of focus do not change.
- **Justification:**
  - Decision 95 promises that the learning session trains a kana that lost its confidence; the focus is the only mechanism that gives it enough answers.
  - A new kana is in focus for the same reason: it has to reach confidence for the unlock to go on.
- **Consequences:**
  - `chooseKana` in `pages/learn/lib/task-choice.ts` uses `isConfident` for the focus.
  - [Learning](../spec/learning.md) ("Other tasks") and decision A40 in [Decisions](../spec/decisions.md) change.
  - A simulation test of 40 sessions checks that the unlocking does not stall and that the dependencies of an unlocked kana are confident.
