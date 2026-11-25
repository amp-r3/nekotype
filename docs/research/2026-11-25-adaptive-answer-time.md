# Adaptive answer time: where good ends and hard begins

The production model grades a correct recall good (3) when it takes at most `settings.learn.targetMs` (1500 ms by default) and hard (2) when it is slower (A48, [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 4; `eachEffect` in `packages/model/src/grade.ts`). The "strictness" and "target answer time" settings are to leave the UI, so the question is which line between good and hard should follow the learner by itself. Time is to stay in the grade.

This note decides nothing; the maintainer does. It changes neither the model nor the app. The numbers come from `packages/sim` at the commit of this note (`pnpm --filter @nekotype/sim run answer-time`, one table per `PART`). Every run uses the production model through `createProductionPolicy`, with 100 seeds over 60 days, and a cell is a median unless it says otherwise.

## In short

- **The share of hard grades decides the outcome, not which answers are hard.** In the simulator an adaptive line (median of the last 50 correct recalls × 1.2) gives the same retention, pace and knowledge as a placebo that marks 30% of correct recalls hard at random. The gap is at most 0.3 points of retention and one day (table 1). Even an oracle that marks a recall hard exactly when its true recall probability is low gains less than one kana of 104 after a 30-day break. FSRS-6 with its default weights and the A4 planner reads a hard grade as "review this sooner". It has no other use for it.
- **Hard grades buy retention with pace.** Each 10 points of hard share add about 0.6 points of review retention. For a slow typist they cost about 2–3 kana recalled on day 14 and one day per 10 points on both tracks. The planner already holds retention above the 0.90 goal without them (no time: 92.9%).
- **The fixed 1500 ms line ties the share of hard to typing speed, not to memory.** A fast typist gets 4% hard, a slow one 63%, and 96–97% on a phone. The slow typist then reads the 46 basic kana on day 11 instead of 9 and the whole track on day 21 instead of 16, and a knower who types slowly practises 7.5 minutes a day instead of 5.4.
- **The recommendation:** a streaming 90th percentile of the log answer time of correct recalls, one per device, as part of the fold. A correct recall is hard when it is slower than its device's line before it. That holds the share of hard at about 10% for every learner and device, so time stays in the grade at about a third of the cost of today's ×1.2 candidate. Until a device has 20 correct recalls, the line of all devices applies, and before any line exists every correct recall is good. The state per device is two numbers. It is O(1) per answer, about 5% of the fold in Node.
- **Placement does not matter for the line.** The line settles within the first 20 correct recalls with any cold start, and placement answers that are in the log feed it like any other.

## Changes to the simulator

They are opt-in options of `packages/sim`. Without them every earlier table reproduces: `PART=main` of `p7` gives identical output before and after the change, and the sim's tests pass.

- **`src/timing.ts`, an answer-time model** (`SimOptions.timing`). The reference learner of parts 1–5 answers in `(500 + 1800(1 − p) + 120·keys) × logNormal(0.2)`, so the motor part is the same for everyone and the time follows `p` closely. The new model is

  ```text
  motor = motor × device × (floor + (1 − floor)·e^(−answers / practiceAnswers)) × kana
  ms    = (500·motor + 1800·(signal·(1 − p) + (1 − signal)·0.15) + 120·keys·motor) × logNormal(σ)
          + 3–9 s with chance `outliers`
  ```

  The events cap `ms` at 10,000 as `MS_CAP` does.

- **`src/policies/answer-time.ts`, the threshold rules and `withAnswerTime`.** A rule sees only the correct recalls before the answer it judges, as a fold would. The wrapper hands the production fold a time on the right side of its fixed 1500 ms target: a good recall becomes at most 1500 ms, a hard one at least 1501 ms. The fold reads an answer's time only for the grade, so the model's code runs unchanged. A placebo (hard at random with a fixed chance) and an oracle (hard when the true `p` before the answer is below a cut) are rules too. The oracle reads `Answer.p`, the learner's recall probability, which the harness now passes along.
- **The harness.** `SimOptions.placement` runs N timed recalls of the basic kana in track order before day 1 and gives them to the rule only. `RunResult.known` is the expected number of kana recalled each morning. `RunResult.afterBreak` is the same number 7 and 30 days after the last day with no practice: the durability that extra reviews buy. `createProductionPolicy` takes the selected track as a function of the state, so a learner can follow the katakana suggestion.

### Assumptions

| Parameter         | Value                  | Why                                                                                                                                                                |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `motor`           | 0.6, 1, 1.6, 2.5       | 1 is the P7 learner (about 0.75 s of motor time for a 2-key kana). 2.5 is a hunt-and-peck typist on a desktop, 0.6 a fast touch typist                             |
| `mobile`          | ×1.6                   | Romaji on a phone keyboard. A guess; only its direction matters here                                                                                               |
| `floor`, practice | ×0.7 over 2000 answers | Typing speeds up with practice. The table `practice` also tries ×0.5 over 1000                                                                                     |
| `signal`          | 1 (0.5, 0.2, 0)        | 1 is P7's link of thinking time to `1 − p`. 0 means time carries nothing about memory; at 0 the thinking time is that of a typical correct recall (`1 − p` = 0.15) |
| σ                 | 0.25                   | P7 had 0.2. Real latencies vary more                                                                                                                               |
| `outliers`        | 3%, +3–9 s             | A distracted answer. With the cap it reaches at most 10 s                                                                                                          |
| `kanaSpread`      | σ 0.15                 | Some kana are slower to type whatever the memory (`tsu`, `shi`, a far key)                                                                                         |
| Device            | desktop                | Two scenarios: a switch to a phone on day 15, and a phone every morning with a desktop every evening                                                               |

The memory side is the reference learner of parts 1–5, unchanged: exponential forgetting with a difficulty per kana. The P7 caveat still holds: the simulated time follows the simulated `p` by construction. `signal` makes that link adjustable but does not make it real.

## 1. Frontier: what the time is worth

Beginner, honest timing. A placebo marks a correct recall hard at random with a fixed chance. An oracle marks it hard when its true recall probability before the answer is below a cut. Columns: the day the learner reads the 46 basic and the whole track (104), the expected kana recalled on day 14, the expected kana recalled 30 days after day 60 with no practice, review retention, retention of every answer on a kana last seen on an earlier day, minutes a day over days 1–14, and the share of good among correct recalls.

| Learner         | Rule                    | Reads 46 | Reads 104 | Kana, day 14 | After a 30-day break | Review retention | Retention | min/day | Good |
| --------------- | ----------------------- | -------- | --------- | ------------ | -------------------- | ---------------- | --------- | ------- | ---- |
| motor 1         | no time                 | 7        | 12        | 101.7        | 99.0                 | 92.9%            | 88.9%     | 8.0     | 100% |
| motor 1         | placebo 10% hard        | 7        | 12        | 102.0        | 99.2                 | 93.5%            | 89.4%     | 8.1     | 91%  |
| motor 1         | placebo 30% hard        | 7        | 13        | 102.3        | 99.6                 | 94.9%            | 90.8%     | 8.4     | 70%  |
| motor 1         | placebo 50% hard        | 7        | 14        | 99.7         | 100.5                | 95.9%            | 91.6%     | 9.0     | 50%  |
| motor 1         | oracle, hard below 0.95 | 7        | 12        | 102.4        | 100.1                | 93.9%            | 90.0%     | 8.2     | 93%  |
| motor 1         | fixed 1500              | 7        | 12        | 102.0        | 99.5                 | 93.3%            | 89.2%     | 8.1     | 95%  |
| motor 1         | median 50 × 1.2         | 7        | 13        | 102.2        | 99.9                 | 95.0%            | 90.7%     | 8.6     | 71%  |
| motor 1         | median 50 × 1.5         | 7        | 13        | 102.2        | 99.7                 | 94.1%            | 89.9%     | 8.2     | 87%  |
| motor 2.5       | no time                 | 9        | 16        | 83.2         | 99.6                 | 93.5%            | 87.9%     | 9.8     | 100% |
| motor 2.5       | placebo 10% hard        | 9        | 16        | 82.1         | 100.2                | 94.1%            | 88.8%     | 9.8     | 91%  |
| motor 2.5       | placebo 30% hard        | 9        | 17        | 76.6         | 100.7                | 95.3%            | 90.0%     | 9.7     | 70%  |
| motor 2.5       | placebo 50% hard        | 10       | 19        | 68.1         | 101.5                | 96.4%            | 90.8%     | 9.6     | 50%  |
| motor 2.5       | oracle, hard below 0.9  | 9        | 16        | 81.9         | 100.7                | 94.3%            | 88.8%     | 9.8     | 95%  |
| motor 2.5       | fixed 1500              | 11       | 21        | 61.1         | 102.4                | 97.2%            | 91.2%     | 9.6     | 37%  |
| motor 2.5       | median 50 × 1.2         | 9        | 18        | 75.5         | 101.0                | 95.5%            | 89.9%     | 9.7     | 71%  |
| motor 2.5       | median 50 × 1.5         | 9        | 16        | 81.0         | 100.3                | 94.5%            | 89.1%     | 9.8     | 88%  |
| recallGain ×0.5 | no time                 | 19       | 26        | 41.3         | 97.0                 | 81.0%            | 75.2%     | 9.5     | 100% |
| recallGain ×0.5 | placebo 30% hard        | 18       | 26        | 41.3         | 96.5                 | 83.9%            | 76.7%     | 9.5     | 70%  |
| recallGain ×0.5 | oracle, hard below 0.9  | 19       | 27        | 39.1         | 97.3                 | 81.8%            | 75.5%     | 9.5     | 96%  |
| recallGain ×0.5 | median 50 × 1.2         | 19       | 27        | 38.6         | 96.7                 | 84.0%            | 76.3%     | 9.5     | 71%  |

- **An adaptive line is a placebo with the same share.** At 70–71% good, the median × 1.2 and the 30% placebo differ by at most 0.2 points of review retention and one day. On day 14 they differ by 1.1 kana, or 2.7 for the slow memory, whose count varies most. This holds for the fast learner, the slow typist and the slow memory alike.
- **Perfect information is worth little.** The oracle, which knows the true `p`, ends 0.5–1 kana of 104 above the placebo of the same share after a 30-day break. It is no better on pace. The grade has two values, and a hard grade only shortens the next interval. FSRS already lengthens an interval more after a review at low retrievability. What a slow answer would add, the model mostly knows from the elapsed time.
- **The share moves everything along one curve.** Going from 0% to 50% hard raises review retention from 92.9% to 95.9% and the kana kept after a break by 1.5. For the slow typist it costs 15 kana on day 14 and three days on the track. The planner already holds retention above the 0.90 goal with no time at all.
- **The fixed 1500 ms line is a placebo whose share is set by the keyboard.** The fast learner gets 5% hard and the slow typist 63%. The latter sits at the far end of the curve: day 11 and day 21 instead of 9 and 16, and 61 kana on day 14 instead of 83.

## 2. Motor speed and signal

Beginner, honest timing.

| Learner   | fixed 1500                      | no time                         | median 50 × 1.2                | median 50 × 1.5                |
| --------- | ------------------------------- | ------------------------------- | ------------------------------ | ------------------------------ |
| motor 0.6 | 6 / 11 / 93.2% / 7.2 min / 96%  | 6 / 10 / 92.7% / 7.2 min / 100% | 6 / 11 / 95.1% / 7.8 min / 71% | 6 / 11 / 94.1% / 7.5 min / 86% |
| motor 1   | 7 / 12 / 93.3% / 8.1 min / 95%  | 7 / 12 / 92.9% / 8.0 min / 100% | 7 / 13 / 95.0% / 8.6 min / 71% | 7 / 13 / 94.1% / 8.2 min / 87% |
| motor 1.6 | 7 / 13 / 95.0% / 9.4 min / 83%  | 7 / 12 / 93.5% / 8.9 min / 100% | 7 / 13 / 95.5% / 9.7 min / 71% | 7 / 12 / 94.6% / 9.2 min / 88% |
| motor 2.5 | 11 / 21 / 97.2% / 9.6 min / 37% | 9 / 16 / 93.5% / 9.8 min / 100% | 9 / 18 / 95.5% / 9.7 min / 71% | 9 / 16 / 94.5% / 9.8 min / 88% |

Cells: reads 46, day / reads 104, day / review retention / minutes a day / good.

An adaptive line keeps its share whatever the motor speed: 71% at × 1.2 and 86–88% at × 1.5. So the slow typist is treated like the fast one. The signal table (`PART=signal`) weakens the link of time to `p` from 1 to 0. At signal 0 the time says nothing about memory, and the adaptive line still lands where it does at signal 1, within one day and 2 kana on day 14. Motor 2.5 at × 1.2 gives day 9 / 17, 77.6 kana and 95.5% at signal 0, against 9 / 18, 75.5 and 95.5% at signal 1. A line that reads noise is harmless as long as its share is small; it is the share that costs. The fixed line gets worse as the signal weakens: for the slow typist, good falls from 37% to 21% and day 14 from 61 to 54 kana.

## 3. Level estimators

Beginner, honest timing. Good: the share of good among correct recalls as a median (p10–p90 over seeds), then in weeks 1, 4 and 8.

| Rule                        | motor 1: reads 46 / 104, review ret. | motor 1: good, weeks 1 / 4 / 8 | motor 2.5: reads 46 / 104, review ret. | motor 2.5: good, weeks 1 / 4 / 8 |
| --------------------------- | ------------------------------------ | ------------------------------ | -------------------------------------- | -------------------------------- |
| median 50 × 1.2             | 7 / 13, 95.0%                        | 71 (70–72)%: 71 / 71 / 71      | 9 / 18, 95.5%                          | 71 (70–72)%: 70 / 73 / 70        |
| median 20 × 1.2             | 7 / 13, 95.0%                        | 71 (70–72)%: 71 / 71 / 71      | 9 / 17, 95.4%                          | 71 (70–72)%: 70 / 70 / 71        |
| median 200 × 1.2            | 7 / 13, 94.9%                        | 72 (71–73)%: 71 / 74 / 72      | 9 / 18, 95.5%                          | 72 (71–73)%: 71 / 74 / 72        |
| median 50 × 1.1             | 7 / 14, 95.5%                        | 62 (61–63)%                    | 10 / 18, 95.8%                         | 62 (61–62)%                      |
| median 50 × 1.3             | 7 / 13, 94.6%                        | 78 (77–79)%                    | 9 / 17, 95.1%                          | 79 (77–80)%                      |
| p75 of 50                   | 7 / 13, 94.8%                        | 74 (74–75)%                    | 9 / 17, 95.4%                          | 74 (73–74)%                      |
| p80 of 50                   | 7 / 13, 94.6%                        | 79 (79–79)%                    | 9 / 17, 95.0%                          | 79 (78–79)%                      |
| EWMA 0.05 × 1.2             | 7 / 13, 94.7%                        | 77 (76–77)%                    | 9 / 17, 95.3%                          | 74 (73–75)%                      |
| EWMA 0.05, step ±0.5, × 1.2 | 7 / 13, 94.9%                        | 72 (71–73)%                    | 9 / 17, 95.4%                          | 72 (71–73)%                      |
| tracker p75, step 0.05      | 7 / 13, 94.8%                        | 75 (75–75)%: 75 / 75 / 75      | 9 / 17, 95.2%                          | 75 (75–75)%: 74 / 76 / 75        |

- **Every estimator works; they differ in how exactly they hold the share.** A median or EWMA × k gives a share that depends on the spread of the learner's times. × 1.2 means 71% good at σ 0.25 but more at a smaller spread. Without the clamp, the EWMA is pulled up by distractions (77% instead of 72% at motor 1). A quantile sets the share directly: the streaming quantile holds it to ±1 point across seeds, weeks, speeds and signal strengths.
- **The window hardly matters.** Windows from 20 to 200 answers give the same results, and a longer window lags a learner who gets faster (weeks 4–8 at 200: 74% instead of 71%).
- The `practice` table: a learner whose motor time halves over 1,000 answers moves the fixed line from 50% to 86% good between weeks 1 and 8. Every adaptive line stays within 3 points.

## 4. What feeds the line

Beginner, honest timing. The variants of the median 50 × 1.2:

- **Reviews only.** Only recalls of learned kana feed the line, as a motor reference that measures the keyboard rather than the memory.
- **A kana offset.** Each kana's own offset from the line, learned on its reviews and shrunk by n / (n + 5), normalises for difficulty and key count.
- **A soft line.** The chance of good is a logistic of the log-time distance, drawn from a hash of the event's identity.

| Rule                      | motor 1                              | motor 2.5                            | motor 1, signal 0.5                  |
| ------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| median 50 × 1.2           | 7 / 13 / 102.2 / 99.9 / 95.0% / 71%  | 9 / 18 / 75.5 / 101.0 / 95.5% / 71%  | 7 / 13 / 102.0 / 99.8 / 95.1% / 73%  |
| reviews only              | 7 / 13 / 102.4 / 99.7 / 94.8% / 74%  | 9 / 17 / 75.4 / 100.9 / 95.4% / 71%  | 7 / 13 / 102.1 / 99.5 / 94.9% / 74%  |
| kana offset               | 7 / 13 / 102.1 / 100.1 / 94.9% / 75% | 9 / 17 / 76.1 / 101.0 / 95.3% / 74%  | 7 / 13 / 102.2 / 99.7 / 95.0% / 75%  |
| reviews only, kana offset | 7 / 13 / 102.1 / 99.8 / 94.7% / 77%  | 9 / 17 / 76.1 / 100.9 / 95.4% / 74%  | 7 / 13 / 102.3 / 99.8 / 94.7% / 77%  |
| soft, scale 0.2           | 7 / 13 / 102.0 / 100.2 / 95.3% / 64% | 10 / 18 / 73.1 / 101.2 / 95.8% / 65% | 7 / 13 / 101.9 / 100.0 / 95.3% / 65% |

Cells: reads 46 / reads 104 / kana on day 14 / after a 30-day break / review retention / good.

None of them leaves the curve of table 1. The kana offset and "reviews only" change the share by a few points and nothing else, so the extra state (an offset per kana, a phase read before the answer) buys nothing. A continuous grade would need FSRS-6 to take a grade between 2 and 3, which the model's `fsrs.ts`, checked against ts-fsrs, does not do. Its tested stand-in, the soft line, is again the curve.

## 5. Profiles

Honest timing. Cells: reads 46 / reads 104 / review retention / minutes a day / good.

| Learner                          | no time                      | fixed 1500                  | median 50 × 1.2             |
| -------------------------------- | ---------------------------- | --------------------------- | --------------------------- |
| beginner, motor 1                | 7 / 12 / 92.9% / 8.0 / 100%  | 7 / 12 / 93.3% / 8.1 / 95%  | 7 / 13 / 95.0% / 8.6 / 71%  |
| beginner, motor 2.5              | 9 / 16 / 93.5% / 9.8 / 100%  | 11 / 21 / 97.2% / 9.6 / 37% | 9 / 18 / 95.5% / 9.7 / 71%  |
| beginner, recallGain ×0.5, m 1   | 19 / 26 / 81.0% / 9.5 / 100% | 18 / 26 / 81.6% / 9.5 / 96% | 19 / 27 / 84.0% / 9.5 / 71% |
| beginner, recallGain ×0.5, m 2.5 | 24 / 37 / 82.7% / 9.7 / 100% | 26 / 41 / 88.8% / 9.6 / 48% | 24 / 39 / 85.9% / 9.7 / 71% |
| knower, motor 1                  | 1 / 1 / 99.4% / 4.0 / 100%   | 1 / 1 / 99.4% / 4.0 / 96%   | 1 / 1 / 99.7% / 4.5 / 72%   |
| knower, motor 2.5                | 1 / 1 / 99.4% / 5.4 / 100%   | 1 / 1 / 99.9% / 7.5 / 30%   | 1 / 1 / 99.7% / 6.1 / 71%   |
| forgot, motor 1                  | 3 / 6 / 98.9% / 4.1 / 100%   | 3 / 6 / 98.9% / 4.1 / 96%   | 3 / 7 / 99.4% / 4.6 / 72%   |
| forgot, motor 2.5                | 4 / 8 / 98.8% / 5.5 / 100%   | 5 / 10 / 99.8% / 7.7 / 30%  | 4 / 9 / 99.5% / 6.2 / 71%   |

For the learner who already knows the kana, every hard grade is pure cost: no new kana wait behind the reviews, so the share turns straight into minutes. The fixed line costs the slow-typing knower 2.1 minutes a day (+39%) at 99.9% retention. × 1.2 still costs 0.5–0.7 minutes.

## 6. Change of device

Desktop until day 14, then a phone (motor ×1.6) from day 15. Good: the share in the week before, on the first day of the phone, days 2–3 and days 4–10. Recovery: correct recalls on the phone until 20 in a row hold the share of the week before less 10 points.

| Learner   | Rule                            | Reads 46 / 104 | Good, week before | First day | Days 2–3 | Days 4–10 | Recovery |
| --------- | ------------------------------- | -------------- | ----------------- | --------- | -------- | --------- | -------- |
| motor 1   | fixed 1500                      | 7 / 12         | 95%               | 85%       | 87%      | 88%       | 21       |
| motor 1   | median 50 × 1.2                 | 7 / 13         | 71%               | 45%       | 70%      | 72%       | 44       |
| motor 1   | median 50 × 1.2, by device      | 7 / 13         | 71%               | 54%       | 72%      | 72%       | 33       |
| motor 1   | EWMA 0.05 ±0.5 × 1.2, by device | 7 / 13         | 72%               | 58%       | 73%      | 72%       | 31       |
| motor 1   | tracker p90, by device          | 7 / 12         | 90%               | 73%       | 89%      | 90%       | 28       |
| motor 2.5 | fixed 1500                      | 11 / 23        | 40%               | 4%        | 4%       | 3%        | never    |
| motor 2.5 | median 50 × 1.2                 | 9 / 18         | 71%               | 58%       | 71%      | 72%       | 50       |
| motor 2.5 | median 50 × 1.2, by device      | 9 / 18         | 71%               | 62%       | 72%      | 72%       | 33       |
| motor 2.5 | EWMA 0.05 ±0.5 × 1.2, by device | 9 / 17         | 72%               | 65%       | 73%      | 72%       | 29       |
| motor 2.5 | tracker p90, by device          | 9 / 16         | 90%               | 83%       | 90%      | 91%       | 28       |

With a phone every morning and a desktop every evening, one line for both devices splits the grades. With the median × 1.2, 81% of desktop recalls are good and 57% of phone recalls (motor 1; 83% and 52% at motor 2.5). One line per device gives 71–73% on both. A line per device changes no outcome of the simulation, because the share is what matters. It keeps the share the same on every device, which is the point of the rule.

- **The adaptive line recovers within one sitting.** A new device takes the line of all devices until it has 20 correct recalls of its own. After that its own line catches up within about 30 recalls, on the first or second day.
- **The fixed line never recovers** for a slow typist on a phone: 3–4% good, so almost every correct recall is graded as weak.

## 7. Cold start and placement

**Cold start.** The base rule (median 50 × 1.2) with N correct recalls before it decides. Before that, one of three things decides: the 1500 ms line, no time (good) or hard. Columns: reads 46 / reads 104 / kana recalled on day 7 / review retention / minutes a day / good among the first 100 correct recalls.

| Learner           | 20, 1500 before                   | 20, good before                   | 20, hard before                   | 50, good before                   |
| ----------------- | --------------------------------- | --------------------------------- | --------------------------------- | --------------------------------- |
| motor 1           | 7 / 13 / 45.8 / 95.0% / 8.6 / 72% | 7 / 13 / 45.5 / 95.0% / 8.6 / 72% | 7 / 13 / 45.5 / 95.1% / 8.6 / 52% | 7 / 13 / 45.4 / 95.0% / 8.6 / 83% |
| motor 2.5         | 9 / 18 / 33.3 / 95.5% / 9.7 / 63% | 9 / 18 / 33.5 / 95.4% / 9.7 / 74% | 9 / 18 / 33.2 / 95.5% / 9.8 / 54% | 9 / 18 / 33.4 / 95.3% / 9.7 / 85% |
| knower, motor 2.5 | 1 / 1 / 96.3 / 99.7% / 6.1 / 63%  | 1 / 1 / 96.7 / 99.7% / 6.1 / 73%  | 1 / 1 / 95.9 / 99.8% / 6.2 / 54%  | 1 / 1 / 96.9 / 99.7% / 6.0 / 84%  |

The first 20–50 recalls are a small part of 60 days, so no choice moves an outcome by more than one kana or one day. "Good before" is the only choice that does not depend on the keyboard. 1500 ms before is today's bias for a few sessions, and "hard before" is the bias against everyone. N = 20 is enough: every estimator above is within its final share after that many answers.

**Placement (P11).** N timed recalls of the basic kana before day 1, given to the line only:

| Learner           | No placement, 1500 before / good before | Placement 20, 1500 before / good before |
| ----------------- | --------------------------------------- | --------------------------------------- |
| knower, motor 1   | 73% / 74% good, 4.5 / 4.6 min           | 72% / 72%, 4.5 / 4.5 min                |
| knower, motor 2.5 | 63% / 73% good, 6.1 / 6.1 min           | 71% / 71%, 6.1 / 6.1 min                |
| forgot, motor 2.5 | 63% / 73% good, 6.2 / 6.2 min           | 63% / 74%, 6.3 / 6.3 min                |

Placement helps only the "1500 before" rule, and only for a learner who knows the kana and types slowly. Learners who have forgotten the kana fail most placement recalls, so few correct ones reach the line. With "good before", placement changes nothing. P11's test writes answer events to the log anyway, so those of its recalls that are correct feed the line like any others. Nothing needs designing for it. A motor calibration (typing shown romaji before any kana) would be a separate question. It is not needed for the share.

## 8. Both tracks

The learner selects katakana once the model suggests it, when the 46 basic hiragana are learned. Columns: reads 46 hiragana / 46 katakana / all 229, day / kana recalled on day 30 / review retention / good.

| Learner   | no time                            | fixed 1500                         | median 50 × 1.2                   | median 50 × 1.2, by track         |
| --------- | ---------------------------------- | ---------------------------------- | --------------------------------- | --------------------------------- |
| motor 1   | 7 / 14 / 26 / 224.9 / 92.7% / 100% | 7 / 14 / 26 / 225.6 / 93.1% / 96%  | 7 / 15 / 28 / 222.4 / 94.9% / 71% | 7 / 15 / 29 / 223.5 / 95.0% / 71% |
| motor 2.5 | 9 / 19 / 35 / 175.8 / 93.3% / 100% | 11 / 23 / 43 / 137.5 / 96.8% / 46% | 9 / 20 / 39 / 156.8 / 95.4% / 71% | 9 / 20 / 38 / 157.2 / 95.3% / 71% |

Over 229 kana the cost of the share shows. At 30% hard the fast learner reads both tracks 2–3 days later, and the slow typist 4 days later with 19 fewer kana on day 30. A line per track changes nothing: the motor part does not depend on the script. Answer times per track still belong on the progress screen's chart; the rule does not need them.

## 9. Final candidates

Every learner of the earlier tables against the rule of today, no time, the base candidate and two streaming quantiles per device (`PART=final`). Cells: reads the track (104, or 229 for both tracks), day / kana recalled on day 14 (day 30 for both tracks) / review retention / minutes a day / good. The full table, with the 10% placebo and the median × 1.5, is the script's output.

| Learner                   | no time                         | fixed 1500                     | median 50 × 1.2                | tracker p80, by device         | tracker p90, by device         |
| ------------------------- | ------------------------------- | ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------ |
| motor 0.6                 | 10 / 101.6 / 92.7% / 7.2 / 100% | 11 / 101.8 / 93.2% / 7.2 / 96% | 11 / 102.8 / 95.1% / 7.8 / 71% | 11 / 102.5 / 94.5% / 7.6 / 80% | 11 / 102.2 / 93.7% / 7.4 / 90% |
| motor 1                   | 12 / 101.7 / 92.9% / 8.0 / 100% | 12 / 102.0 / 93.3% / 8.1 / 95% | 13 / 102.2 / 95.0% / 8.6 / 71% | 13 / 102.3 / 94.4% / 8.4 / 80% | 12 / 102.2 / 93.8% / 8.2 / 90% |
| motor 2.5                 | 16 / 83.2 / 93.5% / 9.8 / 100%  | 21 / 61.1 / 97.2% / 9.6 / 37%  | 18 / 75.5 / 95.5% / 9.7 / 71%  | 17 / 77.2 / 95.0% / 9.8 / 80%  | 16 / 81.1 / 94.3% / 9.8 / 90%  |
| motor 1, recallGain ×0.5  | 26 / 41.3 / 81.0% / 9.5 / 100%  | 26 / 42.0 / 81.6% / 9.5 / 96%  | 27 / 38.6 / 84.0% / 9.5 / 71%  | 27 / 39.5 / 83.3% / 9.5 / 80%  | 26 / 40.3 / 82.0% / 9.5 / 90%  |
| motor 2.5, signal 0       | 16 / 86.1 / 93.7% / 10.0 / 100% | 23 / 54.0 / 98.0% / 9.8 / 21%  | 17 / 77.6 / 95.5% / 10.0 / 72% | 17 / 79.0 / 95.1% / 10.0 / 80% | 16 / 82.4 / 94.5% / 10.0 / 90% |
| knower, motor 2.5         | 1 / 103.3 / 99.4% / 5.4 / 100%  | 1 / 103.8 / 99.9% / 7.5 / 30%  | 1 / 103.5 / 99.7% / 6.1 / 71%  | 1 / 103.5 / 99.6% / 5.9 / 80%  | 1 / 103.4 / 99.6% / 5.6 / 90%  |
| forgot, motor 1           | 6 / 102.4 / 98.9% / 4.1 / 100%  | 6 / 102.5 / 98.9% / 4.1 / 96%  | 7 / 103.0 / 99.4% / 4.6 / 72%  | 6 / 102.8 / 99.2% / 4.5 / 80%  | 6 / 102.7 / 99.1% / 4.3 / 90%  |
| motor 2.5, phone mornings | 16 / 84.1 / 94.2% / 10.8 / 100% | 24 / 51.0 / 98.1% / 10.6 / 22% | 18 / 70.3 / 96.2% / 10.6 / 67% | 17 / 77.4 / 95.4% / 10.7 / 80% | 16 / 79.4 / 94.9% / 10.6 / 90% |
| both tracks, motor 1      | 26 / 224.9 / 92.7% / 9.5 / 100% | 26 / 225.6 / 93.1% / 9.5 / 96% | 28 / 222.4 / 94.9% / 9.6 / 71% | 27 / 226.0 / 94.3% / 9.6 / 80% | 26 / 226.0 / 93.7% / 9.6 / 90% |
| both tracks, motor 2.5    | 35 / 175.8 / 93.3% / 9.7 / 100% | 43 / 137.5 / 96.8% / 9.7 / 46% | 39 / 156.8 / 95.4% / 9.7 / 71% | 37 / 161.6 / 94.8% / 9.7 / 80% | 36 / 168.6 / 94.1% / 9.7 / 90% |

- **The p90 tracker is within one day of no time for every learner.** It costs 2 kana on day 14 for the slow typist and 7 of 229 on day 30 on both tracks, about what the 10% placebo costs. It adds 0.2–1.0 points of review retention.
- **It holds 90% good for every learner and on both devices.** The fixed line ranges from 22% to 96% good, and the median × 1.2 from 67% to 72%.
- **The slow typist is no longer held back by the keyboard.** On a phone every morning they read the track on day 16 (no time: 16, fixed line: 24, median × 1.2: 18).
- **The p80 tracker doubles the share and the cost** (one more day on both tracks, −7 kana on day 30 for the slow typist) for 0.5 points more retention.
- **The median × 1.5 lands near the p90 tracker on average.** Its share follows the spread of the learner's times (83–89% here), and one line for both devices leaves the phone with more hard grades.

## 10. Cost and the fold's constraints

Node, the seeded log of 40,000 answers (54,384 events, 28,361 correct recalls), `PART=cost`. A rule's `judge` and `observe` run over every correct recall in a plain loop, which also builds an object per answer. The "fixed 1500" row is that loop's own cost.

| Rule                            | ms   | Of the fold |
| ------------------------------- | ---- | ----------- |
| fixed 1500 (the loop itself)    | 5.9  | 8.1%        |
| median 50 × 1.2                 | 20.2 | 27.9%       |
| median 50 × 1.2, by device      | 25.5 | 35.3%       |
| EWMA 0.05 ±0.5 × 1.2            | 8.2  | 11.3%       |
| EWMA 0.05 ±0.5 × 1.2, by device | 9.8  | 13.6%       |
| tracker p90, by device          | 9.7  | 13.4%       |

`foldLog` with statistics took 72.3 ms in Node on this machine (median of five; a run on an idle machine earlier gave 31 ms, so only the ratios count). Over the loop's own cost, the p90 tracker per device adds about 4 ms, some 5% of the fold. That is an upper bound for the fold, which already holds the answer and its `dev` and allocates nothing for the rule. The window median adds 14–20 ms even with a sorted window.

- **Purity and determinism.** The streaming quantile is a function of the correct recalls in log order. The log order `(at, dev, n)` is the same on every device after a sync, so every device folds the same lines and the same grades. It needs no clock, timer, random draw or storage; a soft line would need a hash of `(dev, n)` and is not recommended.
- **State.** Two numbers per `dev` (the level in log ms and the count), plus the same for all devices, in `LearnerState`. `snapshot` and `clone` copy them like `tz`. A device id costs about 30 bytes of key; a learner has a handful.
- **Cost.** One comparison and one addition per correct recall, next to the comparison with `targetMs` it replaces: about 5% of the fold in Node, against a model-cost line of 100 ms at 4× that has 35 ms of headroom (64.9 ms at the end of P7). The window median would take a quarter of the fold.
- **Order dependence.** A grade depends on the line before it, which depends on the answers before it. An answer synced later from another device moves into the log order, the fold applies from the first event out of order (the tabs already fold again in that case), and the grades after it follow. That is already true of every memory in the fold.
- **The raw keystroke log stays unstored.** The rule reads only the event's `ms`.

## 11. Prior work

- Latency relative to a learner's own expected latency is how the adaptive fact-learning model of van Rijn, van Maanen and van Woudenberg (2009) and its later use in SlimStampen estimate a per-fact rate of forgetting. Their model separates a fixed time per learner, the motor and reading part, from the retrieval time, and caps long responses as `MS_CAP` does ([summary](https://publish.obsidian.md/subhaditya/KB/User+Models/SlimStampen); Sense et al. 2016, ["An individual's rate of forgetting is stable over time but differs across materials"](https://pubmed.ncbi.nlm.nih.gov/26748838/)). Nekotype's model is FSRS with a two-value grade, which reads latency far more coarsely than that model's continuous parameter. Table 1 shows how little of a perfect signal that channel passes.
- The srs-benchmark of FSRS has review duration only as an option of its LSTM model, off by default; FSRS itself does not take it ([srs-benchmark](https://github.forks.workers.dev/open-spaced-repetition/srs-benchmark)). This search found no published gain from duration for FSRS.

## Conclusion and recommendation

1. **Keep time in the grade only as a small, fixed share of hard, the same for everyone.** In the simulator the time of an answer is worth no more than its share of hard grades, and hard grades trade pace for retention the planner does not need. A line that follows the learner is the cheapest way to keep time in the grade without making the keyboard a learning handicap. If the maintainer is willing to drop time, "every correct recall good" is equal or better on every outcome measured here and is simpler. The decision to keep time rests on the real learner, about whom the simulator cannot say anything (see 4 below).
2. **The rule: a streaming 90th percentile per device.**
   - For each `dev`, a level `m` in log ms over the correct recalls without a hint.
   - The first recall sets `m = ln ms`. Each next one moves it: `m += 0.05 × 0.9` when `ln ms > m`, else `m −= 0.05 × 0.1`.
   - A correct recall without a hint is good when `ln ms ≤ m` (the device's level before the answer), hard otherwise. The answer then updates the level.
   - **Cold start:** until the device has 20 correct recalls, the level of all devices applies (one more such tracker over every device). Until that one has 20, every correct recall is good.
   - **Placement:** nothing special. P11's recalls are log events and feed the line.
   - About 10% of correct recalls come out hard on every device and at every speed. The cost of that share in the simulation is at most one day against no time, on one track or both (table 9).
3. **Other time-graded tasks.** Build, dictation and fluency (P9–P10) get their own level per device and task type, since their times are not comparable with recall's (A38's reason for recognition). Fluency's "good within the target time, otherwise no update" becomes "within its level".
4. **Measure the real signal before tuning the share.** The log keeps every `ms`, and grades are derived at the fold (A48). So once there are real logs, a one-off analysis can ask the one question the simulator cannot answer: does a slower correct recall, measured against the device's line, predict a lower next-review outcome at the same predicted retrievability? If it does strongly, a larger share (p80) or a per-kana term may pay off. If it does not, the share can go to zero. Either change is a constant and reinterprets the whole history without a migration.

### What changes in the spec, if accepted

- **[learning.md](../spec/learning.md), "Constants":** the target answer time is no longer a setting. The grade's line is the device's level (the new constants `PACE_QUANTILE` = 0.9, `PACE_STEP` = 0.05 and `PACE_MIN` = 20 in `packages/model/src/constants.ts`). If the strictness setting goes too, "Recall" says the learning strictness is relaxed (D1), a separate decision this note does not cover.
- **[metrics.md](../spec/metrics.md):**
  - "Grade" row: "a correct recall no slower than the device's 90th percentile of recent correct recall times is good, a slower one hard; until a device has 20, the level of all devices; before any, good".
  - "Answer time" chart: the target line goes, or becomes the current device's level labelled as the learner's usual pace. The maintainer's choice; this note suggests dropping it.
- **[decisions.md](../spec/decisions.md), A48:** amended by the new ADR ("a recall within the target time" → "a recall within the device's level"). The 3.5–4.3 points of A48's reason were a share effect (table 1), which the amendment should say.
- **[frontend.md](../spec/frontend.md), `/settings`:** "Learning: sound (P10)", without the learning strictness and the target answer time.
- **[storage-sync.md](../spec/storage-sync.md):**
  - `learn.targetMs` (and `strictness`, if it goes) leave the settings document and its defaults. Before P14 a settings shape change needs no migration (ADR 061). The server's settings schema accepts the old field until the clients that send it are gone, or the schema bump drops it.
  - "The local view is the fold of the log, with the current target answer time" becomes "the fold of the log".
- **The model** (in the implementation PR, not here):
  - `FoldOptions.targetMs` and `ModelState.targetMs` go. `LearnerState` gains `pace` (per `dev`, plus the global one).
  - `eachEffect` takes the line for the answer instead of `targetMs`.
  - `grade.test.ts` gets the rule's rows, and `fold.properties.test.ts` the convergence of `pace` across devices.
  - `model-cost.spec.ts` stays the gate.
  - `PART=main` of `p7` runs again with the rule in the fold, per rule 3b of the P7 plan.

### Draft ADR 115: answer time graded against the learner's own pace per device

- **Status:** proposed.
- **Context:** A48 grades a correct recall good within a fixed `targetMs`. In the simulation the fixed line grades 4% of a fast typist's recalls hard and 63% of a slow typist's (97% on a phone). Hard grades buy retention the planner does not need with pace: a slow typist reads the hiragana track on day 21 instead of 16. The settings that let a learner move the line are to leave the UI. The [adaptive answer-time note](../research/2026-11-25-adaptive-answer-time.md) found that the outcome depends on the share of hard grades, not on which answers get them.
- **Decision:**
  1. A correct recall without a hint is good when its time is at most the level of its device and hard otherwise. The level is a streaming 90th percentile of the log time of the device's correct recalls (step 0.05), read before the answer.
  2. Until a device has 20 correct recalls, the level of all devices applies. Before that one has 20, a correct recall is good.
  3. The levels are part of the fold's state and are rebuilt from the log; no setting moves them.
  4. Time-graded tasks of later phases keep a level per device and task type.
  5. `settings.learn.targetMs` and its row on `/settings` go. Amends A48 and ADR 100, point 4.
- **Consequences:**
  - About one correct recall in ten is hard for every learner on every device.
  - A slow typist or a phone no longer slows the path; a fast typist gets slightly more hard grades than today (10% instead of 4–5%).
  - The answer-time chart loses its target line.
  - The fold gains two numbers per device and O(1) work per recall.
  - The share is a constant: after release, an analysis of real logs can raise it or set it to zero, and the change reinterprets the history.
- **Alternatives:**
  - _Every correct recall good:_ equal or better on every outcome in the simulation and simpler. It is not taken because time is to stay in the grade until real logs show whether it carries information.
  - _Median of 50 × 1.2:_ 30% hard, 2–4 days slower on both tracks, and a share that depends on the spread of the learner's times.
  - _One level for all devices:_ a phone's recalls graded hard twice as often as a desktop's.
  - _A per-kana offset, a soft line, a level from reviews only:_ more state for no change in the simulation.
  - _A continuous grade:_ it needs a change to FSRS-6's formulas, away from the reference implementation.
