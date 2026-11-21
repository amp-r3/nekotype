# P7 knowledge model: simulated learners, part 1

Part 1 of the research note that P7 starts with ([Phases](../spec/phases.md), P7; [ADR 099](../adr/099-learning-home-methods-and-phases-after-p6.md), point 8). It sets up the method: a simulated reference learner, the current rule as a baseline and a first candidate. It decides nothing yet. The code is `packages/sim` (`pnpm --filter @nekotype/sim run sim`); every number below comes from it at the commit of this note.

## Method

- **Track:** the 104 hiragana of the engine's table, with the dependencies of [Learning](../spec/learning.md) (が → か, きゃ → き, や) and the engine's visually-similar table. Katakana and its transfer from hiragana come in a later part.
- **Routine:** two sittings a day, at 08:00 and 20:00, of 5 minutes each. A learner skips a sitting with a chance of 15%, which gives about 8.5 minutes on an average day. The target is 10–15 minutes a day ([Learning goals](../spec/README.md#learning-goals)). A sitting runs sessions back to back until its 5 minutes are used or the policy has nothing to offer.
- **Time on screen per task:** 1 s to read the prompt, the answer time, the 400 ms pause, 1.5 s to read the right answer after an error, and 3 s more for an introduction.
- **Runs:** 50 seeds per learner and policy, 60 days each. A table cell is the median with the 10th–90th percentiles. A day cell also gives the share of runs that reached it within 60 days.
- **Metrics:**
  - _reads 46 basic_ is the first day whose morning, before practice, the learner's expected recall of the 46 basic hiragana is at least 90%. It is measured on the reference learner, not on what the policy believes;
  - _reads 104_ is the same for the whole track;
  - _unlocked 46_ and _unlocked by day 7_ are the policy's own view;
  - _retention_ is the correct share of answers on a kana last seen on an earlier day, the broad sense of "review answers" in the goals;
  - _min/day_ is the time on screen per practised day over the first 14 days.

## Reference learner

The candidates are measured against a model none of them uses, of another family than FSRS, as the P7 scope asks. Each kana has a stability `S` in days, and the recall probability `t` days after the last exposure is `exp(−t / S)`.

- **Difficulty:** `d` = 1.4 for a kana with a similar-looking partner, × 0.7 for a composite, × a log-normal factor (σ = 0.25).
- **First study:** an introduction sets `S = 0.02 / d` days, about 30 minutes for an average kana.
- **Successful recall** at probability `p`: `S ← S × (1 + 8 × (1 − p)^0.4 / d)`. A recall right after study (`p` near 1) gains little; a recall of a half-forgotten kana gains much. This is the spacing effect.
- **Recognition** gains 0.4 of a recall. When recall would fail, recognition still succeeds by familiarity with a chance of 30%; otherwise the learner guesses among the 4 options, drawn to a similar-looking one.
- **Failed recall:** `S` keeps 30% of its value, at least the first-study stability, and the right answer shown after the error counts as a new study. A recall error is a confusion with a similar kana the learner knows in half of the cases.
- **Answer time:** `(500 + 1800 × (1 − p) + 120 × keys) ms × log-normal (σ = 0.2)`.
- **Profiles:**
  - a beginner who has seen no kana;
  - a knower who read the basic and dakuten kana two days ago with `S` = 120 days (yōon 20 days);
  - a learner who forgot: the whole track learned once, `S` = 20 days, last seen 300 days ago, relearned 4 times faster.

The constants were calibrated on one kana, practised with 10 recalls 40 seconds apart:

| After                                           | Expected recall |
| ----------------------------------------------- | --------------- |
| 1 day                                           | 0.67            |
| 3 days                                          | 0.34            |
| 7 days after correct reviews on day 1 and day 4 | 0.92            |
| 30 days after one more review on day 11         | 0.86            |

These are assumptions, not a fit to real learners: a single session forgets most of a new kana within days, and a few spaced reviews keep it for weeks. Part 2 repeats the comparison with the constants moved by ±50% to see whether the ranking of the candidates holds.

## Candidates in this part

- **Current rule** (`policies/current.ts`): [Learning](../spec/learning.md) as it stands.
  - One kana unlocks at a time when every unlocked kana is confident: 10 recall answers, a median of at most 1500 ms and 90% correct.
  - Sessions have 25 tasks, with focus, weights and a third of the tasks as recognition.
  - Leitner boxes (1, 3, 7, 14, 30 days) give the review session at the start of a sitting.
- **A: FSRS-6 with default parameters and a planner** (`policies/fsrs-planner.ts`).
  - Each kana has an FSRS-6 memory state (`src/fsrs.ts`, tested against ts-fsrs 6.0.0).
  - Grades: a wrong answer is 1, a recall within 1500 ms 3, a slower recall 2, a correct recognition 2.
  - A kana is new, learning or graduated. Up to 4 kana are learning at once; a new kana is introduced in track order when its parts have graduated.
  - A learning kana comes back after 3 tasks, doubled after each correct recall, and graduates after 3 correct recalls in a row. A failed review sends it back to learning.
  - Each task is a due review (predicted recall below the requested retention, lowest first), else a learning kana whose gap has passed, else an introduction. A session ends after 30 tasks or when there is nothing to do.

A first version of A graduated a kana after three recalls a few seconds apart. The reference learner forgot those kana overnight, and only 4% of next-day answers were right. The growing gap fixed it. It is the first result of the method: a candidate that looks sound on paper can fail against a learner who forgets.

## Results

| policy                    | learner  | reads 46 basic, day | reads 104, day   | unlocked 46, day | unlocked by day 7 | retention           | min/day, days 1–14 |
| ------------------------- | -------- | ------------------- | ---------------- | ---------------- | ----------------- | ------------------- | ------------------ |
| current rule              | beginner | 11 (9–12), 100%     | 21 (19–24), 100% | 9 (8–11), 100%   | 38 (33–44)        | 98.4 (97.7–98.7)%   | 9.8 (8.9–10.4)     |
| current rule              | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 8 (7–9), 100%    | 43 (37–48)        | 100.0 (99.9–100.0)% | 9.8 (8.9–10.3)     |
| current rule              | forgot   | 8 (7–9), 100%       | 18 (17–20), 100% | 8 (7–9), 100%    | 43 (37–48)        | 99.9 (99.9–100.0)%  | 9.8 (8.9–10.2)     |
| A: FSRS-6, retention 0.90 | beginner | 8 (7–10), 100%      | 13 (11–15), 100% | 4 (4–5), 100%    | 71 (56–80)        | 79.3 (74.8–83.6)%   | 8.7 (8.2–9.3)      |
| A: FSRS-6, retention 0.90 | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 99.2 (98.7–99.6)%   | 2.9 (2.8–3.2)      |
| A: FSRS-6, retention 0.90 | forgot   | 2 (2–3), 100%       | 4 (4–5), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 98.3 (97.5–98.9)%   | 3.0 (2.9–3.2)      |
| A: FSRS-6, retention 0.95 | beginner | 9 (7–10), 100%      | 13 (12–16), 100% | 5 (3–6), 100%    | 65 (55–77)        | 86.2 (82.7–89.9)%   | 9.3 (8.8–9.7)      |
| A: FSRS-6, retention 0.95 | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 99.7 (99.3–99.9)%   | 3.4 (3.3–3.6)      |
| A: FSRS-6, retention 0.95 | forgot   | 2 (2–3), 100%       | 4 (4–5), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 99.3 (99.0–99.6)%   | 3.5 (3.3–3.7)      |

## What part 1 shows

- **The current rule is slow and over-practises.**
  - A beginner reads the 46 basic hiragana on day 11 against the goal of about 7, and the whole track on day 21.
  - 98% of answers on earlier kana are right, well above the goal of 90%: the time goes into kana that are already held.
  - A learner who knows the kana or forgot them spends 8 days unlocking basic kana one at a time, 10 answers each. This is the rigidity ADR 093 describes.
- **Candidate A is fast but forgets too much.**
  - A beginner reads the basic kana on day 8 and the whole track on day 13.
  - A knower or a learner who forgot has every kana unlocked in 2 days and then needs about 3 minutes a day.
  - Retention is 79% with a requested retention of 0.90 and 86% with 0.95, both below the goal. FSRS-6 with its default parameters, which were fitted on flashcard reviews, expects more memory of a kana learned the same day than this learner has. Reviews come too late.
- **The goals pull against each other.** Pace favours introducing kana early, and retention favours reviewing them early. The parts that follow look for a candidate that reaches about day 7 for the basic kana with at least 90% retention.

## Next parts

1. **Sensitivity:** the reference constants moved by ±50%, one at a time.
2. **Candidate A variants:** FSRS parameters adapted to the learner from the observed answers, a stricter graduation, a lower requested retention for the first reviews only, and a different number of kana learned at once.
3. **Candidate B:** another memory model, for example half-life regression with fixed weights, so the ranking is not about one family.
4. **Unlocking in groups** by the recall probability of the kana being learned.
5. **Forecast of the next unlock** in sessions, and how accurate it is on the simulated learners.
6. **Evidence by task type**, answer time and hints, and the tasks of ADR 099 (contrast, transfer, build, fluency run) as far as they change the memory state.
7. **Katakana**, its transfer from hiragana and the credit from composites to their parts.
8. **Merge across devices:** a replay of the merged answer log against the last state per kana, with property tests that two devices converge, and the size of each against the limits of `/api/sync`.
