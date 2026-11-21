# P7 knowledge model: simulated learners, part 5

Part 5 of the P7 research note, after [part 1](2026-11-21-p7-knowledge-model.md), [part 2](2026-11-21-p7-knowledge-model-part-2.md), [part 3](2026-11-21-p7-knowledge-model-part-3.md) and [part 4](2026-11-21-p7-knowledge-model-part-4.md). [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md) chose FSRS-6 with default weights and the planner A4. FSRS-7 was not considered by the research. It is built for intervals shorter than a day, and part 3 found that FSRS-6 misjudges what a learner forgets overnight. This part compares the two models under A4.

It decides nothing. The numbers come from `packages/sim` at the commit of this note (`pnpm --filter @nekotype/sim run part5`; `PART=main|planner|calibration|forecast|rebuild|mastery` for one table).

## What FSRS-7 is

Checked on 2026-11-21 in the sources:

- the published package ts-fsrs 6.0.0: its `CHANGELOG.md` and `dist/models/fsrs-7.mjs`;
- the source of the fsrs crate 7.0.0 from crates.io: `src/model_v7.rs`, `src/inference_v7.rs`, `docs/S90_RETRIEVAL.MD` and `docs/COMPATIBILITY.MD`;
- the README of srs-benchmark at commit `c99f032061` (2026-11-19).

- **Releases.**
  - ts-fsrs 6.0.0 was published on npm on 2026-10-28. Its `DefaultScheduler` uses FSRS-7 by default; `version: 'FSRS-6'` keeps the previous model. The old `fsrs()` and `FSRS` API is deprecated but still uses FSRS-6. Each model is also a separate entry, `ts-fsrs/models/fsrs-6` and `ts-fsrs/models/fsrs-7`.
  - The fsrs crate 7.0.0 was published on 2026-11-10 and contains FSRS-7. Its default constructor `FSRS::default()` still builds FSRS-6 (`docs/COMPATIBILITY.MD`).
  - Both have the same 34 default weights (`FSRS7_DEFAULT_WEIGHTS` in ts-fsrs, `DEFAULT_PARAMETERS` in `inference_v7.rs`).
- **Memory state:** difficulty, a slow stability `stability` and a fast stability `stabilityFast`.
  - The first answer sets `stability` to w0–w3 by grade and `stabilityFast` to 0.8 of it.
  - Every later answer updates both traces with the same formula: FSRS's growth after a success and its post-lapse stability. Each trace has its own 8 weights: w7–w14 for the slow trace, w15–w22 for the fast one. Each uses its own recall: the whole curve for the slow trace, the fast trace's own curve for the fast one.
  - A lapse caps the fast stability at 0.8 of the new slow one.
  - Difficulty reverts to its mean with a fixed 0.01. After "again" its step is scaled by `R + 0.1`.
- **Forgetting curve:** a mixture of two power curves, one per trace, with 11 weights (w23–w33).
  - The fast curve's decay depends on its own stability.
  - The slow curve's time scale depends on difficulty.
  - The weight of each curve depends on its stability, and the slow one's on difficulty as well.
  - So, unlike FSRS-6, recall is not 0.90 at `t = stability`. The time to 90% recall (`S90`) is solved numerically: fsrs-rs exposes `FSRS::s90()`, ts-fsrs `next_interval()`.
- **Sub-day intervals.** Times are fractional days, in the state update and in the intervals. There is no separate same-day formula as in FSRS-6. A review 30 seconds after the previous one goes through the same formula with a small elapsed time. Because the growth after a success is proportional to `e^((1−R)·w) − 1`, a review at a recall near 1 adds almost nothing to the slow trace.
- **srs-benchmark,** about 10,000 Anki collections. Log loss, the mean and its 99% interval:

  | Model                   | Without same-day reviews | With same-day reviews |
  | ----------------------- | ------------------------ | --------------------- |
  | FSRS-7, fitted per user | 0.3401 ± 0.0043          | 0.3206 ± 0.0040       |
  | FSRS-7, default weights | 0.3620 ± 0.0045          | 0.3399 ± 0.0040       |
  | FSRS-6, fitted per user | 0.3460 ± 0.0042          | 0.3842 ± 0.0051       |
  - The README calls FSRS-7 "the only version that can give realistic predictions of probability of recall for same-day reviews."
  - With same-day reviews counted, FSRS-7 with default weights predicts better than FSRS-6 fitted to each user. Without them, it predicts worse.
  - The README has no row for FSRS-6 with default weights, the model of ADR 100.

The maintainer's summary was right on the facts that matter, with these corrections:

- ts-fsrs 6.0.0 made FSRS-7 the default of the new `DefaultScheduler` only. FSRS-6 is still available and still behind the deprecated API.
- In the fsrs crate 7.0.0, the default constructor is still FSRS-6.
- `stabilityFast` is not a short-term stability used only for same-day reviews. It is a second trace that every answer updates, and in our runs it grows to hundreds of days. "Two traces mixed in one curve" describes it better.

What could not be confirmed:

- The default weights listed in the srs-benchmark README differ from those of ts-fsrs and fsrs-rs, and are grouped differently. The sources do not say which revision of the formula they belong to. This note uses the weights of the two libraries.
- `docs/S90_RETRIEVAL.MD` of fsrs-rs speaks of 35 parameters for FSRS-7; the code has 34.
- No source explains the meaning of each FSRS-7 weight beyond the code. The description above is read from the code.

**The test of FSRS-6 against "ts-fsrs 6.0.0".** `fsrs.test.ts` compares with `FSRS6Algorithm` of ts-fsrs 6.0.0: the FSRS-6 model entry with its default weights and the short-term formula on (`enableShortTerm = true`). That entry applies the short-term formula when the elapsed time is 0. The sim applies it to answers on the same calendar day, the integer-day convention of the old scheduler. It is not the `DefaultScheduler`, so FSRS-7 being its default did not affect the test. `fsrs7.test.ts` now checks this against the package itself, with ts-fsrs 6.0.0 as a dev dependency of `packages/sim`.

## Change to the simulator

- `src/fsrs7.ts` is FSRS-7 with the default weights, ported from `FSRS7Algorithm` of ts-fsrs 6.0.0, with no runtime dependency. `fsrs7.test.ts` checks it against ts-fsrs 6.0.0 at every step of two histories of 13 answers, from 30 seconds to 21 days apart. It compares both stabilities, difficulty, recall and the interval at 0.80, 0.90 and 0.95. Unlike ts-fsrs, it does not round to 8 decimals.
- `FSRS7_MODEL` is the planner's memory model. The planner passes fractional days already, and FSRS-7 ignores the same-day flag.
- A4 on FSRS-6 reproduces the earlier parts: 94.4% in the planner table, as in part 4, and 94.9% in the main table against 95.0% in part 3.
- A planner option, `reviewGapMs`, keeps a learned kana from being due again until that long after its last answer. It is off in A4. Part 5 needed it to run A4 on FSRS-7 (next section).

## A4 on FSRS-7 as it is

A4 on FSRS-7 with nothing else changed is the column "A4, FSRS-7" of the tables below. It reviews without end:

- **What happened.** On one seed over 30 days it gave 6,080 reviews against FSRS-6's 1,453, and 5,796 of them came less than 10 minutes after the kana's previous answer. A beginner reads the basic kana on day 14 instead of 7. Review retention is 99.7%, and both sittings are full (10.1 minutes a day).
- **Why.** Look-ahead makes a learned kana due when its recall would fall below 0.90 before the next session, about 12 hours ahead.
  - Under FSRS-7, a review minutes after the last answer happens at a recall near 1, so it barely raises the slow stability. The forecast for the next morning stays below 0.90, and the kana stays due.
  - FSRS-6's same-day formula grows the stability by a fixed factor of about 1.1 per same-day review, whatever the recall. A few reviews push the kana over the line.
- **Which model is right about this is a question about real learners.** FSRS-7 was fitted on real same-day reviews, and they tell it that a review right after study adds little for the next day. The reference learner gains noticeably from such a review: `S × (1 + 8 × (1 − p)^0.4 / d)` at `p = 0.97` more than doubles `S`.

The planner table therefore adds variants with a minimum time between two answers on a learned kana: 1 minute (about a learning step) and 20 minutes (one review per sitting, since a sitting lasts 5 minutes).

## Planners

The beginner, 30 seeds, 30 days; the learners of part 3. A cell is the day the 46 basic kana are read / review retention / minutes a day (medians).

| Reference learner | A4, FSRS-6            | A4, FSRS-7         | A4 + 1 min gap, FSRS-6 | A4 + 1 min gap, FSRS-7 | A4 + 20 min gap, FSRS-6 | A4 + 20 min gap, FSRS-7 | A4 without look-ahead, FSRS-6 | A4 without look-ahead, FSRS-7 |
| ----------------- | --------------------- | ------------------ | ---------------------- | ---------------------- | ----------------------- | ----------------------- | ----------------------------- | ----------------------------- |
| reference         | **7 / 94.4% / 8.3**   | 13 / 99.8% / 10.1  | 7 / 92.3% / 8.0        | **7 / 94.6% / 8.4**    | 8 / 87.9% / 8.4         | 8 / 87.4% / 8.3         | 8 / 85.7% / 8.3               | 8 / 87.0% / 8.2               |
| recallGain ×0.5   | **15 / 89.4% / 9.8**  | 19 / 99.2% / 10.2  | 17 / 81.9% / 9.4       | 17 / 84.8% / 9.3       | 19 / 72.6% / 9.3        | 20 / 72.1% / 9.2        | 18 / 71.7% / 9.3              | 18 / 72.8% / 9.4              |
| gainExponent ×1.5 | **>30 / 86.6% / 9.7** | >30 / 98.4% / 10.1 | >30 / 75.7% / 9.3      | >30 / 76.4% / 9.4      | >30 / 63.0% / 9.3       | >30 / 59.1% / 9.3       | >30 / 59.3% / 9.3             | >30 / 64.1% / 9.4             |
| lapseKeep ×0.5    | **8 / 93.6% / 8.9**   | 14 / 99.8% / 10.1  | 8 / 90.8% / 8.6        | 8 / 93.3% / 9.0        | 10 / 83.4% / 9.1        | 9 / 82.8% / 9.0         | 9 / 81.8% / 9.0               | 9 / 83.1% / 9.0               |
| recallGain ×1.5   | **6 / 96.2% / 6.9**   | 13 / 99.9% / 10.1  | 5 / 95.0% / 6.5        | 6 / 96.8% / 7.1        | 6 / 91.3% / 6.7         | 6 / 91.6% / 6.7         | 6 / 89.6% / 6.5               | 6 / 91.3% / 6.5               |

- **FSRS-7 does not replace look-ahead.** Without it, FSRS-7 holds 87.0% for the reference learner and 72.8% for a slow one, about a point above FSRS-6 without look-ahead. Its better overnight forecast (next section) changes which kana are reviewed first, not when reviews happen.
- **With a 1-minute gap, FSRS-7 matches A4 on FSRS-6 for the reference learner** (day 7, 94.6% against 94.4%, 8.4 minutes against 8.3) and for `lapseKeep ×0.5` (93.3% against 93.6%). For the two learners whose memory grows more slowly, it holds less than A4 on FSRS-6: 84.8% against 89.4% (`recallGain ×0.5`), and 76.4% against 86.6% (`gainExponent ×1.5`).
- **With the same gap, FSRS-7 beats FSRS-6** by 0.7–2.9 points. Of two planners that review a kana at most once a minute, FSRS-7 chooses better.
- **A4's retention leans on reviews within a sitting, on either model.**
  - On FSRS-6, a 1-minute gap costs 2.1 points for the reference learner, and 7.5 and 10.9 for the two whose memory grows slowly. A 20-minute gap brings A4 down to the level of no look-ahead: 87.9% against 85.7%.
  - Part 3 described look-ahead as reviewing a kana before the night. In the simulation, it does so by reviewing the kana several times within a sitting. The reference learner rewards that, as its formula above shows; FSRS-7, fitted on real reviews, expects such reviews to add little.
  - This finding is about ADR 100 itself, independent of FSRS-7 (see the last section).

## Main table

The three learners, 50 seeds, 60 days.

| Policy                        | Learner  | Reads 46 basic, day | Reads 104, day   | Unlocked 46, day | Unlocked by day 7 | Review retention   | Next-day recall of a new kana | min/day, days 1–14 | Reviews |
| ----------------------------- | -------- | ------------------- | ---------------- | ---------------- | ----------------- | ------------------ | ----------------------------- | ------------------ | ------- |
| **A4, FSRS-6**                | beginner | 7 (6–8), 100%       | 13 (12–15), 100% | 6 (4–7), 100%    | 63 (51–72)        | 94.9 (94.5–95.5)%  | 47 (39–55)%                   | 8.3 (8.0–8.9)      | 1619    |
| **A4, FSRS-6**                | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.5 (99.2–99.8)%  | 99 (98–100)%                  | 4.1 (4.0–4.6)      | 785     |
| **A4, FSRS-6**                | forgot   | 3 (3–4), 100%       | 6 (6–8), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.0 (98.7–99.4)%  | 99 (96–100)%                  | 4.3 (4.1–4.7)      | 807     |
| A4, FSRS-7                    | beginner | 14 (12–15), 100%    | 27 (25–30), 100% | 13 (11–15), 100% | 28 (23–31)        | 99.7 (99.6–99.8)%  | 50 (44–57)%                   | 10.1 (9.1–10.5)    | 6224    |
| A4, FSRS-7                    | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 7 (6–8), 100%    | 51 (41–58)        | 99.9 (99.9–100.0)% | 100 (98–100)%                 | 10.2 (9.2–10.6)    | 3428    |
| A4, FSRS-7                    | forgot   | 7 (7–9), 100%       | 15 (14–17), 100% | 7 (6–8), 100%    | 50 (40–57)        | 99.9 (99.8–99.9)%  | 99 (98–100)%                  | 10.1 (9.2–10.6)    | 3469    |
| A4 + 1 min gap, FSRS-6        | beginner | 7 (6–8), 100%       | 12 (11–14), 100% | 5 (4–6), 100%    | 64 (53–74)        | 93.2 (92.6–93.9)%  | 45 (35–52)%                   | 8.0 (7.7–8.4)      | 1364    |
| A4 + 1 min gap, FSRS-6        | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.5 (99.1–99.9)%  | 99 (98–100)%                  | 3.9 (3.9–4.3)      | 715     |
| A4 + 1 min gap, FSRS-6        | forgot   | 3 (3–4), 100%       | 6 (5–7), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.0 (98.6–99.4)%  | 99 (97–100)%                  | 4.1 (3.9–4.4)      | 738     |
| A4 + 1 min gap, FSRS-7        | beginner | 7 (6–9), 100%       | 13 (12–15), 100% | 6 (5–7), 100%    | 63 (51–73)        | 94.9 (94.2–95.5)%  | 45 (36–50)%                   | 8.4 (8.0–9.0)      | 1557    |
| A4 + 1 min gap, FSRS-7        | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.7 (99.4–99.9)%  | 100 (98–100)%                 | 4.8 (4.6–5.2)      | 1014    |
| A4 + 1 min gap, FSRS-7        | forgot   | 3 (3–4), 100%       | 7 (6–8), 100%    | 2 (2–3), 100%    | 104 (102–104)     | 99.5 (99.2–99.7)%  | 99 (98–100)%                  | 4.8 (4.6–5.2)      | 1027    |
| A4 without look-ahead, FSRS-7 | beginner | 7 (6–9), 100%       | 13 (11–15), 100% | 6 (4–7), 100%    | 63 (50–73)        | 88.9 (87.7–90.2)%  | 38 (30–47)%                   | 8.1 (7.7–8.7)      | 1039    |
| A4 without look-ahead, FSRS-7 | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.5 (99.1–99.8)%  | 100 (98–100)%                 | 3.8 (3.7–4.1)      | 666     |
| A4 without look-ahead, FSRS-7 | forgot   | 3 (3–4), 100%       | 6 (5–7), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.0 (98.4–99.3)%  | 99 (96–100)%                  | 3.9 (3.8–4.1)      | 684     |

- A4 on FSRS-6 gives the numbers ADR 100 used: day 7, 94.9%, 8.3 minutes. Part 3 had 95.0% and 8.4.
- A4 on FSRS-7 as it is meets none of the goals for a beginner, and doubles the time of a knower.
- With a 1-minute gap, FSRS-7 gives a beginner the same results as A4 on FSRS-6. A knower or a learner who forgot spends 4.8 minutes a day against 4.1–4.3, with about 30% more reviews of kana they already hold.

## How well each model predicts recall

Do FSRS-7's predictions of what is forgotten overnight match the learner better? The answers of two planners were replayed under each model: A4 on FSRS-6, and A4 with a 1-minute gap on FSRS-7. A point is a recall of a kana seen before, with the model's prediction just before it. The beginner, 10 seeds, 30 days.

| Learner         | Answers of             | Model  | Group             | Answers | Mean predicted | Correct | Log loss |
| --------------- | ---------------------- | ------ | ----------------- | ------- | -------------- | ------- | -------- |
| reference       | A4, FSRS-6             | FSRS-6 | overnight         | 7021    | 89.9%          | 88.6%   | 0.323    |
| reference       | A4, FSRS-6             | FSRS-7 | overnight         | 7021    | 86.3%          | 88.6%   | 0.279    |
| reference       | A4, FSRS-6             | FSRS-6 | later same day    | 1510    | 90.3%          | 65.5%   | 0.801    |
| reference       | A4, FSRS-6             | FSRS-7 | later same day    | 1510    | 78.4%          | 65.5%   | 0.612    |
| reference       | A4, FSRS-6             | FSRS-6 | scheduled reviews | 14228   | 94.7%          | 94.4%   | 0.176    |
| reference       | A4, FSRS-6             | FSRS-7 | scheduled reviews | 14228   | 92.1%          | 94.4%   | 0.158    |
| reference       | A4 + 1 min gap, FSRS-7 | FSRS-6 | overnight         | 6081    | 88.7%          | 87.2%   | 0.345    |
| reference       | A4 + 1 min gap, FSRS-7 | FSRS-7 | overnight         | 6081    | 86.3%          | 87.2%   | 0.294    |
| recallGain ×0.5 | A4, FSRS-6             | FSRS-6 | overnight         | 8514    | 90.0%          | 71.5%   | 0.656    |
| recallGain ×0.5 | A4, FSRS-6             | FSRS-7 | overnight         | 8514    | 85.3%          | 71.5%   | 0.496    |
| recallGain ×0.5 | A4, FSRS-6             | FSRS-6 | later same day    | 3327    | 90.1%          | 49.7%   | 1.135    |
| recallGain ×0.5 | A4, FSRS-6             | FSRS-7 | later same day    | 3327    | 79.7%          | 49.7%   | 0.813    |
| recallGain ×0.5 | A4, FSRS-6             | FSRS-6 | scheduled reviews | 24406   | 96.3%          | 89.3%   | 0.271    |
| recallGain ×0.5 | A4, FSRS-6             | FSRS-7 | scheduled reviews | 24406   | 93.9%          | 89.3%   | 0.206    |
| recallGain ×0.5 | A4 + 1 min gap, FSRS-7 | FSRS-6 | overnight         | 8026    | 88.2%          | 65.1%   | 0.686    |
| recallGain ×0.5 | A4 + 1 min gap, FSRS-7 | FSRS-7 | overnight         | 8026    | 84.6%          | 65.1%   | 0.556    |

"Overnight" is a recall whose previous answer on the kana was on an earlier day. "Later same day" is at least an hour after it, on the same day. "Scheduled reviews" are the tasks the planner scheduled as reviews; most of them come minutes after the previous answer.

Overnight answers on the log of A4 on FSRS-6, by predicted recall. This is the table that opens part 3, now with both models:

| Learner         | Model  | Predicted | Answers | Mean predicted | Correct |
| --------------- | ------ | --------- | ------- | -------------- | ------- |
| reference       | FSRS-6 | 0.9–1.0   | 5394    | 90.9%          | 94.1%   |
| reference       | FSRS-6 | 0.8–0.9   | 1550    | 87.4%          | 74.0%   |
| reference       | FSRS-6 | 0.7–0.8   | 75      | 77.3%          | 1.3%    |
| reference       | FSRS-7 | 0.9–1.0   | 2834    | 91.4%          | 99.0%   |
| reference       | FSRS-7 | 0.8–0.9   | 2934    | 87.0%          | 95.1%   |
| reference       | FSRS-7 | 0.7–0.8   | 1060    | 74.8%          | 54.6%   |
| reference       | FSRS-7 | 0.5–0.7   | 190     | 63.7%          | 24.2%   |
| recallGain ×0.5 | FSRS-6 | 0.9–1.0   | 6231    | 91.7%          | 84.2%   |
| recallGain ×0.5 | FSRS-6 | 0.8–0.9   | 2081    | 86.2%          | 40.4%   |
| recallGain ×0.5 | FSRS-6 | 0.7–0.8   | 198     | 76.9%          | 2.0%    |
| recallGain ×0.5 | FSRS-7 | 0.9–1.0   | 3823    | 92.5%          | 97.9%   |
| recallGain ×0.5 | FSRS-7 | 0.8–0.9   | 2054    | 86.4%          | 85.2%   |
| recallGain ×0.5 | FSRS-7 | 0.7–0.8   | 2337    | 75.5%          | 25.0%   |
| recallGain ×0.5 | FSRS-7 | 0.5–0.7   | 297     | 63.0%          | 3.4%    |

The full table, with both logs and all buckets, is in the output of `PART=calibration`.

- **FSRS-7 predicts better in every group and for both learners.** Overnight log loss is 14% lower for the reference learner (0.279 against 0.323) and 24% lower for a slow one (0.496 against 0.656). Later the same day, the gap is wider: 0.612 against 0.801, and 0.813 against 1.135. This agrees with srs-benchmark.
- **The gain is in ranking more than in level.**
  - FSRS-6 sorts the kana poorly. Its predictions crowd into 0.8–1.0, and those of 0.7–0.8 are almost all wrong (1–2% correct).
  - FSRS-7 spreads them out and orders them better. Above 0.8 it is too cautious (95–99% correct), and at 0.7–0.8 still too confident (25–55%).
- **For a slow learner, both models are too confident on average:** 85–90% predicted overnight against 65–72% correct. FSRS-7 is less wrong, but its default weights do not fit a learner who forgets faster than Anki users. Only fitting would fix the level.
- **These numbers measure agreement with the reference learner,** an assumption of the simulation. They say FSRS-7 fits this simulated learner better. That FSRS-7 fits real learners better is srs-benchmark's evidence, on Anki flashcards, not on kana.

## Forecasts

Part 4's method on three planners. The beginner, 20 seeds, 30 days. A cell is the median |error| in sessions / the median signed error / the share within ±1 session / the share within ±25% / the share whose actual value fell inside the 10–90% range. "Forward, corrected" is the forecast of ADR 100.

| Learner         | Planner                | Target   | All sessions             | Forward                   | Forward, observed         | Forward, corrected          |
| --------------- | ---------------------- | -------- | ------------------------ | ------------------------- | ------------------------- | --------------------------- |
| reference       | A4, FSRS-6             | next row | 2 / −2 / 44% / 29% / —   | 1 / −1 / 64% / 52% / 53%  | 1 / −1 / 57% / 39% / 48%  | **1 / 0 / 55% / 42% / 50%** |
| reference       | A4, FSRS-7             | next row | 2 / 2 / 34% / 34% / —    | 1 / 0 / 64% / 63% / 74%   | 1 / −1 / 58% / 53% / 49%  | 1 / 0 / 62% / 51% / 54%     |
| reference       | A4 + 1 min gap, FSRS-7 | next row | 2 / −2 / 47% / 32% / —   | 1 / 0 / 79% / 65% / 89%   | 1 / 0 / 69% / 54% / 80%   | **1 / 0 / 65% / 53% / 78%** |
| reference       | A4, FSRS-6             | 46 basic | 5 / −5 / 19% / 34% / —   | 10 / −9 / 8% / 9% / 4%    | 5 / −5 / 16% / 33% / 27%  | 5 / −5 / 16% / 33% / 27%    |
| reference       | A4, FSRS-7             | 46 basic | 5 / −3 / 21% / 75% / —   | 13 / −13 / 8% / 49% / 18% | 20 / −20 / 5% / 13% / 6%  | 20 / −20 / 5% / 13% / 6%    |
| reference       | A4 + 1 min gap, FSRS-7 | 46 basic | 6 / −6 / 7% / 14% / —    | 3 / −3 / 33% / 82% / 48%  | 6 / 0 / 17% / 46% / 47%   | 6 / 0 / 17% / 46% / 47%     |
| recallGain ×0.5 | A4, FSRS-6             | next row | 3 / −2 / 27% / 26% / —   | 5 / −5 / 16% / 11% / 11%  | 4 / −4 / 18% / 14% / 26%  | **3 / 0 / 29% / 33% / 44%** |
| recallGain ×0.5 | A4, FSRS-7             | next row | 2 / 1 / 28% / 34% / —    | 2 / −1 / 45% / 41% / 53%  | 2 / −2 / 40% / 34% / 32%  | 2 / 0 / 39% / 32% / 37%     |
| recallGain ×0.5 | A4 + 1 min gap, FSRS-7 | next row | 3 / −2 / 26% / 27% / —   | 2 / −2 / 43% / 45% / 42%  | 8 / 8 / 18% / 21% / 62%   | **3 / 0 / 26% / 30% / 65%** |
| recallGain ×0.5 | A4, FSRS-6             | 46 basic | 17 / −17 / 9% / 26% / —  | 36 / −35 / 1% / 1% / 0%   | 19 / −19 / 3% / 17% / 10% | 19 / −19 / 3% / 17% / 10%   |
| recallGain ×0.5 | A4, FSRS-7             | 46 basic | 10 / −10 / 11% / 55% / — | 27 / −27 / 4% / 8% / 5%   | 33 / −33 / 3% / 4% / 4%   | 33 / −33 / 3% / 4% / 4%     |
| recallGain ×0.5 | A4 + 1 min gap, FSRS-7 | 46 basic | 20 / −20 / 5% / 13% / —  | 28 / −28 / 4% / 5% / 3%   | 14 / 5 / 6% / 38% / 23%   | 14 / 5 / 6% / 38% / 23%     |

- **The next row is forecast a little better on FSRS-7 with a 1-minute gap.**
  - Reference learner, ADR 100's forecast: within ±1 session 65% of the time against 55%. The 10–90% range holds 78% of actual values against 50%; it should hold 80%.
  - Slow learner: the median error is 3 sessions on both. The range holds 65% against 44%; within ±1 session it is 26% against 29%.
  - Both meet ADR 100's criterion of a median absolute error of at most 1 session for the reference learner.
- **The model's own play (`forward`) is far less biased on FSRS-7:** 0 to −2 sessions against −1 to −5 on FSRS-6. FSRS-7 expects more of the errors the learner makes while learning.
- **Far targets stay out of reach** on every planner. Part 4's conclusion (forecast only the next row, show far targets as counts) holds.
- On A4 on FSRS-7 as it is, every forecast describes a planner that reviews without end; the row is for completeness.

## Fold time

A fresh A4 planner applies the same log under each model: the 60 days of one beginner under A4 on FSRS-6, repeated with shifted times. The median of 5 timings in Node on the development machine:

| Answers | FSRS-6 | FSRS-7  |
| ------- | ------ | ------- |
| 3,248   | 0.5 ms | 1.4 ms  |
| 32,480  | 3.4 ms | 12.1 ms |
| 97,440  | 9.7 ms | 35.2 ms |

- **The FSRS-7 fold is about 3.5 times slower.** Each answer computes the mixture of two curves and updates two stabilities, where FSRS-6 computes one curve and one stability.
- Part 4 had 2, 10 and 19 ms for FSRS-6 with a single timing. The median of 5 timings after a first run, as here, is lower.
- **ADR 100's limit is a fold of 40,000 answers in 100 ms in Chromium with a 4× CPU slowdown.** At 12 ms in Node for 32,480 answers, FSRS-7 leaves less margin than FSRS-6. Whether it fits can only be measured in the browser.
- **The state grows by one number per kana,** and the screens' "next review" date needs a numeric solve for S90 (Newton steps or bisection over the curve) instead of a closed formula.
- **The log and the grades do not change.** The log stores answers, not memory states, and a fold under FSRS-7 reads the same events (`apply` is the same for both models). The grade table of ADR 100, point 4, maps to the same four grades, which FSRS-7 takes as they are. A change of model is a new fold of the same log, with no migration and no change of sync format 3.

## The mastery line

ADR 100 (point 9, A52) makes a learned kana mastered when its stability is at least 21 days. Under FSRS-6, stability is by definition the time until recall falls to 0.90. Under FSRS-7 it is not:

- the slow `stability` is only one trace of the mixture;
- the time to 0.90 (S90) depends on both traces and on difficulty.

Learned kana of the beginner at the end of a day, and those of them over the line by either measure, 20 seeds, medians:

| Planner                | Day | Learned | Stability ≥ 21 d | S90 ≥ 21 d |
| ---------------------- | --- | ------- | ---------------- | ---------- |
| A4, FSRS-6             | 14  | 104     | 0                | 0          |
| A4, FSRS-6             | 30  | 104     | 6                | 6          |
| A4, FSRS-6             | 60  | 104     | 82               | 82         |
| A4, FSRS-7             | 14  | 51      | 0                | 3          |
| A4, FSRS-7             | 30  | 104     | 4                | 48         |
| A4, FSRS-7             | 60  | 104     | 68               | 100        |
| A4 + 1 min gap, FSRS-7 | 14  | 104     | 0                | 0          |
| A4 + 1 min gap, FSRS-7 | 30  | 104     | 57               | 25         |
| A4 + 1 min gap, FSRS-7 | 60  | 104     | 103              | 102        |

- **On FSRS-7, the two measures disagree in both directions.** With the 1-minute gap, the slow stability passes 21 days for 57 kana on day 30, while S90 does for 25. On A4 as it is, the opposite: 4 against 48.
- **The line keeps its meaning only as S90 ≥ 21 days.** That is "recall stays above 0.90 for three weeks", the reading of Anki's "mature" line. It is what fsrs-rs offers as `s90()` for "integrations that still want a time to 90% recall value."
- **Even as S90, a kana masters sooner on FSRS-7.** On day 30 it is 25 kana against FSRS-6's 6, on a planner with the same pace and retention. The models disagree on how fast a reviewed kana's memory grows. The line would keep its definition but move in time, which a chart and its "mastered X of N" would show.

## What this means for ADR 100

**Recommendation: keep FSRS-6 in ADR 100 and write no ADR 101 now.** Reconsider FSRS-7 after the release, together with fitting the model to real answers.

The arguments:

1. **FSRS-7 does not fit A4 as decided.** With look-ahead, A4 on FSRS-7 reviews the same kana again and again. A beginner reaches the basic kana on day 14 instead of 7, and a knower spends 10 minutes a day instead of 4. Using FSRS-7 would mean changing the planner, at least with a minimum gap between reviews of a learned kana. The research has found such a rule only by trying it here, not by reasoning from FSRS-7.
2. **With that change, FSRS-7 matches A4 on FSRS-6 but does not beat it.**
   - The reference learner gets the same: day 7, 94.9%, 8.4 minutes.
   - The two learners whose memory grows slowly lose 4.6 and 10.2 points of review retention.
   - A knower spends 0.7 minutes a day more.
   - No learner gets better retention or a better pace.
3. **FSRS-7 predicts recall better.** Log loss is 14–24% lower overnight, the simulation agrees with srs-benchmark, and the forecast of the next row is a little more accurate. In the simulation, though, the better prediction does not turn into a better schedule. A4's results depend on the planner more than on the accuracy of the model.
4. **It costs more:**
   - the fold is about 3.5 times slower;
   - the state has a third number per kana;
   - the next review date and the mastery line need a numeric solve for S90;
   - the acceptance criteria of point 10 would change: a new reference (`FSRS7Algorithm` of ts-fsrs 6.0.0), a new planner rule simulated on the production model, and the mastery line as S90.
5. **Nothing is lost by waiting.** The log keeps every answer, and grades are derived at the fold (ADR 100, points 4 and 7). A later switch to FSRS-7 is a new fold of the same history, with no migration and no change to the log, the grades or sync format 3. FSRS-7's advantage in srs-benchmark is largest with fitted weights, which is already the question left for after the release.

If the maintainer still prefers FSRS-7, an ADR 101 would have to amend:

- point 1: FSRS-7 memory with three numbers;
- point 2: a minimum gap of 1 minute before a learned kana is due again;
- point 9 and A52: mastered when S90 ≥ 21 days;
- point 10:
  - the model matches `FSRS7Algorithm` of ts-fsrs 6.0.0 on reference cases, rather than ts-fsrs 6.0.0 in general;
  - the rows of part 3 for slow learners move to this note's values, up to 10 points below the current ones;
  - the fold limit is measured with FSRS-7.

The log format, the grades and sync format 3 would stay as they are.

**A finding about ADR 100 itself, independent of the model.**

- A4's review retention in the simulation depends on reviewing a learned kana again within the same sitting, minutes after its last answer. With a 1-minute gap, A4 on FSRS-6 loses 2.1 points for the reference learner, and 7.5 and 10.9 for the two whose memory grows slowly. With one review per sitting, look-ahead adds only 2 points over no look-ahead.
- The reference learner gains much from such reviews. FSRS-7, fitted on real same-day reviews, says they add little.
- If real learners are closer to FSRS-7 here, real review retention under A4 will fall short of the simulated 95%. The part 3 learner `gainExponent ×1.5`, who gains least from easy recalls, is closest to that case, and A4 held 87% for that learner.
- This adds to ADR 100's list of questions open after the release. Its first lever, a requested retention of 0.93, is the one to try. Measuring review retention on real answers will show whether it is needed.
