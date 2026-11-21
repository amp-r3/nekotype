# P7 knowledge model: simulated learners, part 2

Part 2 of the P7 research note. [Part 1](2026-11-21-p7-knowledge-model.md) set up the reference learner, the routine and the metrics, and compared the current rule with candidate A (FSRS-6 with default parameters and a planner). This part splits the retention metric, varies candidate A, adds candidate B with another memory model and checks how the results depend on the assumptions of the reference learner. It decides nothing. The numbers come from `packages/sim` at the commit of this note.

## Two retention metrics

Part 1 counted every answer on a kana last seen on an earlier day. That mixes two things:

- **Review retention:** the correct share of scheduled reviews of kana the policy holds as learned. The retention goal of [Learning goals](../spec/README.md#learning-goals) ("at least 90% of review answers are correct") means this one. For the current rule these are the tasks of the review session; for the planners, the due reviews of graduated kana.
- **Next-day recall of a new kana:** the correct share of the first answer on a kana on a day after its introduction.

Under the reference learner the second is low for every policy: a kana met in one sitting is mostly forgotten by the next one. It weighed on candidate A's figure in part 1, because A introduces kana faster, so more of its answers are first answers after a night. With the split, the current rule's review retention is 86% (part 1 reported 98% for all answers), and A's is 74%.

## Variants of candidate A

The beginner, 30 seeds, 30 days, medians. "Steps in time" replaces the gap of 3, 6, 12 tasks with 30 s, 1, 2, 4 and 8 minutes: a learning kana comes back after 30 s, doubled after each correct recall.

| Variant                                              | Reads 46 basic, day | Reads 104, day | Review retention | Next-day recall | min/day |
| ---------------------------------------------------- | ------------------- | -------------- | ---------------- | --------------- | ------- |
| A: retention 0.90, gap in tasks, 3 to graduate       | 9                   | 12             | 73.7%            | 19%             | 8.7     |
| A, 4 to graduate                                     | 8                   | 12             | 80.5%            | 28%             | 8.2     |
| A, steps in time, 4 to graduate                      | 8                   | 12             | 80.3%            | 28%             | 8.1     |
| A, steps in time, 5 to graduate                      | 7                   | 12             | 83.8%            | 35%             | 8.0     |
| **A2:** steps in time, 5 to graduate, retention 0.95 | **7**               | **13**         | **90.6%**        | **37%**         | **8.5** |
| A2 with retention 0.93                               | 7                   | 13             | 87.9%            | 36%             | 8.2     |
| A2 with retention 0.97                               | 7                   | 13             | 93.6%            | 35%             | 9.0     |
| A2 with 6 to graduate                                | 7                   | 13             | 92.1%            | 41%             | 8.6     |
| A2 with 6 kana learning at once                      | 7                   | 12             | 91.8%            | 34%             | 8.4     |
| A2 with calibration 0.05                             | 8                   | 13             | 91.2%            | 35%             | 9.0     |
| A2 with calibration 0.2                              | 8                   | 14             | 88.9%            | 34%             | 8.9     |

- **What helps** is how a new kana is learned in its first sitting, not when it is reviewed. Gaps in time that grow across the sitting, and two more correct recalls before a kana graduates, raise next-day recall from 19% to 37% and review retention from 74% to 84%. The pace does not suffer, because a kana that holds needs fewer relearning tasks later.
- **The requested retention** then trades minutes for retention almost linearly: 0.93 gives 88%, 0.95 gives 91%, 0.97 gives 94%, for 8.2, 8.5 and 9.0 minutes a day.
- **Calibration does not help.** One factor per learner scales elapsed time in the predicted recall and moves after each review by `rate × (predicted − outcome)`. It makes results slightly worse at both rates tried. FSRS's forgetting curve is a flat power curve, and the reference learner forgets exponentially: their difference changes with the elapsed time, so no single factor fits both a 12-hour and a 5-day gap. A fit of the FSRS parameters to the learner's own answers is the next thing to try, but it needs far more answers than the first week gives.
- The number of kana learning at once (4 or 6) barely matters.

## Candidate B: another memory model

Candidate B uses A2's planner with a memory model that knows nothing of FSRS or of the reference learner:

- each kana has a half-life `h` in days, and recall is `2^(−t/h)`;
- `h` starts at 0.02 days;
- a recall on a later day multiplies it by 2.5 (good) or 1.8 (hard), a recall the same day by 1.2;
- an error keeps 30%, at least the starting value. These are fixed multipliers in the manner of SM-2.

B shares the exponential shape with the reference learner, which may favour it; its update rule is different.

| Learner  | Policy | Reads 46 basic, day | Reads 104, day | Review retention | min/day |
| -------- | ------ | ------------------- | -------------- | ---------------- | ------- |
| beginner | A2     | 7                   | 13             | 90.6%            | 8.5     |
| beginner | B      | 7                   | 13             | 90.6%            | 8.9     |
| knower   | A2     | 1                   | 1              | 99.7%            | 4.1     |
| knower   | B      | 1                   | 1              | 99.9%            | 5.4     |
| forgot   | A2     | 3                   | 6              | 99.3%            | 4.2     |
| forgot   | B      | 3                   | 6              | 99.7%            | 5.5     |

The two reach the same pace and retention; B spends about a minute more a day on learners who already know the kana, because its half-lives grow more slowly than FSRS's stabilities. **The planner decides most of the result; the memory model decides the cost of reviews.** This matters for the ADR: the choice of memory model is less critical than the shape of learning in a sitting, and a simple model stays possible if FSRS turns out hard to merge across devices.

## Sensitivity to the reference learner

Each constant of the reference learner moved by −50% and +50%, one at a time; shares are capped at 0.95. The beginner, 30 seeds, 30 days. A cell is the day the 46 basic kana are read, review retention and minutes a day (medians); ">30" means not within 30 days.

| Reference learner     | Current rule      | A2                |
| --------------------- | ----------------- | ----------------- |
| reference             | 11 / 85.8% / 9.9  | 7 / 90.6% / 8.5   |
| firstStability ×0.5   | 11 / 83.7% / 9.9  | 8 / 89.9% / 8.8   |
| firstStability ×1.5   | 10 / 86.7% / 9.9  | 7 / 90.9% / 8.3   |
| recallGain ×0.5       | >30 / 37.0% / 9.8 | >30 / 65.6% / 9.5 |
| recallGain ×1.5       | 9 / 94.2% / 9.8   | 6 / 93.9% / 7.0   |
| gainExponent ×0.5     | 8 / 100.0% / 9.8  | 3 / 98.5% / 4.9   |
| gainExponent ×1.5     | >30 / 17.7% / 9.7 | >30 / 40.6% / 9.5 |
| recognitionShare ×0.5 | 11 / 82.2% / 9.9  | 8 / 89.7% / 8.9   |
| recognitionShare ×1.5 | 10 / 88.5% / 9.9  | 7 / 90.9% / 8.4   |
| lapseKeep ×0.5        | 12 / 78.7% / 9.9  | 10 / 85.6% / 9.3  |
| lapseKeep ×1.5        | 10 / 88.1% / 9.8  | 7 / 91.6% / 8.1   |
| familiarity ×0.5      | 11 / 85.8% / 9.9  | 8 / 90.4% / 8.7   |
| familiarity ×1.5      | 11 / 85.5% / 9.8  | 7 / 90.3% / 8.5   |

- **The ranking holds in every row:** A2 reads the basic kana earlier, in less time, and with higher review retention, except in the two rows where memory is strong (`recallGain ×1.5`, `gainExponent ×0.5`). There A2's retention is 0.3 and 1.5 points lower, still above 93%.
- **Two constants decide whether the goals are reachable at all:** how much a successful recall strengthens memory (`recallGain`, `gainExponent`). A learner whose memory grows half as fast reads the basic kana in neither policy within 30 days, and A2's retention falls to 66% (current rule: 37%). A fixed requested retention cannot hold 90% for such a learner. Only a model fitted to the learner's answers, or a planner that slows down when retention falls, could.
- The other constants move the results by a day or a few points.

## Main table

The three learners, 50 seeds, 60 days; part 1's table with the new metrics and A2 and B added.

| policy                      | learner  | reads 46 basic, day | reads 104, day   | unlocked 46, day | unlocked by day 7 | review retention   | next-day recall of a new kana | min/day, days 1–14 |
| --------------------------- | -------- | ------------------- | ---------------- | ---------------- | ----------------- | ------------------ | ----------------------------- | ------------------ |
| current rule                | beginner | 11 (9–12), 100%     | 21 (19–24), 100% | 9 (8–11), 100%   | 38 (33–44)        | 88.9 (85.6–91.1)%  | 60 (54–65)%                   | 9.8 (8.9–10.4)     |
| current rule                | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 8 (7–9), 100%    | 43 (37–48)        | 99.8 (99.6–100.0)% | 99 (98–100)%                  | 9.8 (8.9–10.3)     |
| current rule                | forgot   | 8 (7–9), 100%       | 18 (17–20), 100% | 8 (7–9), 100%    | 43 (37–48)        | 99.8 (99.3–99.8)%  | 99 (97–100)%                  | 9.8 (8.9–10.2)     |
| A: FSRS-6, retention 0.90   | beginner | 8 (7–10), 100%      | 13 (11–15), 100% | 4 (4–5), 100%    | 71 (56–80)        | 75.0 (69.4–80.8)%  | 18 (13–28)%                   | 8.7 (8.2–9.3)      |
| A: FSRS-6, retention 0.90   | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 99.2 (98.6–99.6)%  | 99 (98–100)%                  | 2.9 (2.8–3.2)      |
| A: FSRS-6, retention 0.90   | forgot   | 2 (2–3), 100%       | 4 (4–5), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 98.2 (97.4–98.9)%  | 98 (96–100)%                  | 3.0 (2.9–3.2)      |
| A: FSRS-6, retention 0.95   | beginner | 9 (7–10), 100%      | 13 (12–16), 100% | 5 (3–6), 100%    | 65 (55–77)        | 83.4 (79.1–87.6)%  | 20 (12–27)%                   | 9.3 (8.8–9.7)      |
| A: FSRS-6, retention 0.95   | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 99.6 (99.3–99.9)%  | 99 (98–100)%                  | 3.4 (3.3–3.6)      |
| A: FSRS-6, retention 0.95   | forgot   | 2 (2–3), 100%       | 4 (4–5), 100%    | 2 (1–2), 100%    | 104 (104–104)     | 99.3 (98.9–99.6)%  | 98 (97–100)%                  | 3.5 (3.3–3.7)      |
| A2: FSRS-6, steps in time   | beginner | 7 (6–9), 100%       | 13 (12–15), 100% | 5 (4–6), 100%    | 63 (52–74)        | 92.5 (91.2–93.3)%  | 35 (28–41)%                   | 8.5 (8.0–8.9)      |
| A2: FSRS-6, steps in time   | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.7 (99.5–99.9)%  | 100 (98–100)%                 | 4.1 (4.0–4.4)      |
| A2: FSRS-6, steps in time   | forgot   | 3 (3–4), 100%       | 6 (5–7), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.4 (99.1–99.7)%  | 99 (97–100)%                  | 4.2 (4.1–4.5)      |
| B: half-life, steps in time | beginner | 7 (7–9), 100%       | 13 (12–16), 100% | 5 (5–6), 100%    | 60 (48–68)        | 91.0 (89.8–92.2)%  | 34 (25–41)%                   | 8.8 (8.4–9.2)      |
| B: half-life, steps in time | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.9 (99.7–100.0)% | 99 (98–100)%                  | 5.4 (5.3–5.8)      |
| B: half-life, steps in time | forgot   | 3 (3–4), 100%       | 6 (5–7), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.7 (99.5–99.8)%  | 98 (97–100)%                  | 5.5 (5.3–5.9)      |

Over 60 days the current rule's review retention is 89% and A2's 92%. The current rule's next-day recall of a new kana is higher (60% against 35%): it drills each kana about ten times before the next one, which is what makes it slow.

## What part 2 shows

1. Under every variant of the reference learner tried, a planner with learning steps in time and five correct recalls before graduation (A2) reaches the basic kana earlier than the current rule, with higher review retention and fewer minutes a day.
2. The planner matters more than the memory model: FSRS-6 with default parameters (A2) and a crude half-life model (B) give the same pace and retention.
3. Fitting one time factor to the learner does not help. Keeping retention at 90% for a learner whose memory grows slowly needs a planner that responds to observed retention.
4. Under the reference learner a new kana is often forgotten by the next sitting: next-day recall is 35% for A2, against 60% for the slower current rule. The home of P8 should not present this as a failure, because relearning on the second day is part of the plan.

## Next parts

1. **A planner that holds retention:** lower the pace (fewer kana learning at once, more steps) when the review retention of the last days falls below the goal, tested on the slow-memory rows above.
2. **Fitting the memory model to the learner:** FSRS parameters (or B's multipliers) fitted on the learner's own answers after enough of them, and how many answers that takes.
3. **Unlocking by rows** and the forecast of the next row in sessions, with its accuracy. A2 introduces a new kana in almost every session, so "the next kana unlocks in N sessions" is nearly always "this session"; a forecast by row, or for the rest of the track, carries more information for the home of P8.
4. **Evidence by task type, answer time and hints,** and the tasks of ADR 099 as far as they change the memory state.
5. **Katakana**, transfer and the credit from composites to their parts.
6. **Merge across devices:** a replay of the merged answer log against the last state per kana.
