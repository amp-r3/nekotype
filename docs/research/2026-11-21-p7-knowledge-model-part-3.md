# P7 knowledge model: simulated learners, part 3

Part 3 of the P7 research note, after [part 1](2026-11-21-p7-knowledge-model.md) and [part 2](2026-11-21-p7-knowledge-model-part-2.md). It covers items 1–3 of part 2's "Next parts":

- a planner that holds retention for learners whose memory grows slowly;
- fitting the memory model to the learner;
- forecasts in sessions for the home of P8.

It decides nothing. The numbers come from `packages/sim` at the commit of this note: `pnpm --filter @nekotype/sim run part3` for the three tables, and `run sim` for the main table.

## The retention goal

The maintainer confirmed how the goal is counted (2026-11-21). "At least 90% of review answers are correct" in [Learning goals](../spec/README.md#learning-goals) means the scheduled reviews of kana the model holds as learned: the review retention of part 2. The first answers on a kana on the days after its introduction are part of learning, not reviews.

## Why A2 misses the goal for slow learners

Part 2 found that a fixed requested retention cannot hold 90% for a learner whose memory grows slowly. A check of A2's reviews by predicted recall shows where the misses come from. The beginner, reference learner, 4 seeds, 30 days:

| Recall FSRS predicted at the review | Reviews | Correct |
| ----------------------------------- | ------- | ------- |
| 0.9–1.0                             | 3787    | 99%     |
| 0.8–0.9                             | 1208    | 65%     |
| 0.7–0.8                             | 150     | 44%     |

A2 reviews a kana when its predicted recall falls below 0.95. Most reviews come on time and almost all of them are correct. The misses are reviews that came late. The learner practises twice a day, so a kana still at 0.96 in the evening session has fallen to 0.85 by the morning. The reference learner forgets exponentially, so it loses more overnight than FSRS's flatter curve predicts. A slower memory makes this gap larger.

## Planners

- **Adaptation** (`adapt`) keeps a moving average of review outcomes. While it is below 90%, a pressure from 0 to 1 does three things: it raises the requested retention towards 0.98, lowers the number of kana learning at once to 1, and adds up to two correct recalls before a kana graduates. Pressure 1 means 10 points below the goal.
- **Look-ahead** (`horizon`) makes a learned kana due when its recall would fall below the requested retention before the next session. The planner expects the next session after the median of the learner's last 10 gaps between sessions that were over an hour (12 hours until it knows them). An app can measure this gap from session start times. It needs no clock beyond the one the model already has.
- **A4** is A2 with look-ahead, requested retention lowered back to 0.90, and adaptation at rate 0.05.

The beginner, 30 seeds, 30 days. The learners are the reference and the rows of part 2's sensitivity table that mattered. A cell is the day the 46 basic kana are read, review retention and minutes a day (medians); ">30" means not within 30 days.

| Reference learner | Current rule      | A2                | A2, adapt 0.05    | A2, look-ahead     | A2, look-ahead, 0.90 | **A4**                | A4 with 0.93       |
| ----------------- | ----------------- | ----------------- | ----------------- | ------------------ | -------------------- | --------------------- | ------------------ |
| reference         | 11 / 85.8% / 9.9  | 7 / 90.6% / 8.5   | 8 / 90.9% / 8.6   | 8 / 99.1% / 10.6   | 7 / 94.2% / 8.4      | **7 / 94.7% / 8.4**   | 7 / 97.7% / 9.3    |
| recallGain ×0.5   | >30 / 37.0% / 9.8 | >30 / 65.6% / 9.5 | 22 / 74.8% / 9.3  | 12 / 97.5% / 10.6  | 15 / 88.0% / 9.7     | **15 / 89.6% / 9.7**  | 12 / 94.9% / 10.6  |
| gainExponent ×1.5 | >30 / 17.7% / 9.7 | >30 / 40.6% / 9.5 | >30 / 58.8% / 9.3 | >30 / 94.5% / 10.5 | >30 / 83.0% / 9.5    | **>30 / 86.7% / 9.8** | >30 / 91.3% / 10.5 |
| lapseKeep ×0.5    | 12 / 78.7% / 9.9  | 10 / 85.6% / 9.3  | 9 / 87.2% / 9.3   | 8 / 99.0% / 10.6   | 8 / 93.3% / 8.8      | **8 / 93.9% / 9.0**   | 7 / 97.6% / 9.7    |
| recallGain ×1.5   | 9 / 94.2% / 9.8   | 6 / 93.9% / 7.0   | 6 / 93.9% / 7.1   | 7 / 99.6% / 10.0   | 6 / 96.2% / 6.8      | **6 / 96.2% / 6.9**   | 6 / 98.7% / 8.1    |

- **Look-ahead is the fix.** On its own, at A2's 0.95, it lifts review retention above 94% for every learner. The learner whose memory grows at half the rate now reads the basic kana on day 12 instead of not at all. Its cost is time: at 0.95 it fills both sittings (10.6 minutes) and slows the reference learner by a day.
- **With look-ahead, requested retention 0.90 is enough.** The reference learner gets day 7, 94% and 8.4 minutes: A2's pace, four points more retention, the same time.
- **Adaptation alone helps little:** 65% → 75% for the slow learner. It raises the threshold, but reviews still come late overnight. On top of look-ahead it adds up to 3.7 points where retention falls short, and nothing where it already holds.
- **The hardest learner stays short.** For the learner whose memory gains least from an easy recall (`gainExponent ×1.5`), no planner reads the basic kana within 30 days. A4 holds 87% for that learner, A4 at 0.93 holds 91%, and the current rule 18%. Holding 90% for every learner would take a requested retention of about 0.93, at about a minute a day more for the others.

## Fitting the memory model

The planner keeps each kana's answers. Once it has enough of them, at the first session of each day, it replays all kana under every model of a grid. It keeps the model under which the logged answers were most likely and takes that model's memory states. The grids:

- **FSRS:** 80 variants of FSRS-6. The first stabilities (w0–w3) are scaled ×0.25 to ×2, the growth after a later-day recall (e^w8) ×0.25 to ×1.5, and the decay (w20) is 0.15 to 1.2. The default weights are in the grid.
- **Half-life:** 60 variants of candidate B: the first half-life, the gain of a later-day and of a same-day recall.
- **Answers counted:** either every recall more than 2 hours after the previous exposure (after 100 of them), or only scheduled reviews (after 50).

| Reference learner | A2                | A2, fit on recalls | A4                | A4, fit on recalls | A4, fit on reviews | B4: half-life, A4 planner | B4, fit on recalls |
| ----------------- | ----------------- | ------------------ | ----------------- | ------------------ | ------------------ | ------------------------- | ------------------ |
| reference         | 7 / 90.6% / 8.5   | 8 / 87.7% / 8.4    | 7 / 94.7% / 8.4   | 7 / 95.6% / 8.6    | 7 / 96.1% / 8.7    | 8 / 98.6% / 10.4          | 8 / 98.3% / 10.1   |
| recallGain ×0.5   | >30 / 65.6% / 9.5 | >30 / 67.0% / 9.4  | 15 / 89.6% / 9.7  | 15 / 91.1% / 10.0  | 15 / 91.0% / 10.1  | >30 / 92.6% / 10.2        | 16 / 97.3% / 10.4  |
| gainExponent ×1.5 | >30 / 40.6% / 9.5 | >30 / 48.5% / 9.5  | >30 / 86.7% / 9.8 | >30 / 87.4% / 9.8  | >30 / 87.3% / 9.8  | >30 / 85.8% / 9.7         | >30 / 95.0% / 10.2 |
| lapseKeep ×0.5    | 10 / 85.6% / 9.3  | 10 / 82.1% / 9.2   | 8 / 93.9% / 9.0   | 8 / 94.6% / 9.2    | 8 / 95.3% / 9.3    | 8 / 97.7% / 10.6          | 8 / 97.4% / 10.3   |
| recallGain ×1.5   | 6 / 93.9% / 7.0   | 6 / 92.0% / 6.5    | 6 / 96.2% / 6.9   | 6 / 97.2% / 7.3    | 6 / 97.8% / 7.4    | 7 / 99.5% / 10.0          | 7 / 99.0% / 9.3    |

The first fit comes on day 4–5. By day 30 the FSRS fit chooses the same corner of the grid for almost every learner:

- first stabilities ×0.25;
- decay 1.2, the steepest curve in the grid and close to exponential;
- growth that follows the learner's memory: ×1.5 for the reference, ×0.25–×0.5 for `gainExponent ×1.5`.

- **Without look-ahead, fitting does not help.** A2 with a fit loses up to 3.5 points for three of the five learners. The fitted model predicts lower recall for late reviews, which is more accurate. But it also gives a kana longer intervals after a success, so the planner still reviews it late.
- **With look-ahead, fitting adds about a point** of retention (0.6–1.6) for 0.2–0.5 minutes a day. That is about what raising the requested retention would give.
- **The fit moves towards the reference learner's own family.** The steepest decay wins, because the reference learner forgets exponentially. This tells us more about the simulation than about real learners, and the simulation cannot say how a fit would behave on real answers.
- **B4 shows that the memory model matters once the planner looks ahead.** The half-life model predicts steeper forgetting overnight than FSRS. With look-ahead it reviews far more: 10.4 minutes a day for the beginner, 8.8 for a learner who already knows the kana (A4: 4.1), and the knower's basic kana unlock on day 5 instead of day 2. Part 2's "the planner decides most of the result" holds only without look-ahead.

## Forecasts in sessions

The home of P8 shows "the next … unlocks in about N sessions". At the start of every session the harness made two forecasts from the number of kana introduced per session so far:

- when the next row will be fully introduced;
- when all 46 basic kana will be introduced.

It later counted how many sessions each took. Three estimates of the rate were tried: the last 6 sessions, the sessions of the last 3 days, and all sessions. The beginner, 30 seeds, 30 days. A cell is the median absolute error in sessions, the share of forecasts within ±1 session, and the share within ±25%. Each cell gives the next row first, then the 46 basic.

| Policy       | Learner         | Tasks a session | Last 6 sessions              | Last 3 days                   | All sessions                  |
| ------------ | --------------- | --------------- | ---------------------------- | ----------------------------- | ----------------------------- |
| current rule | reference       | 24              | 2 / 49% / 41%; 9 / 10% / 52% | 1 / 51% / 45%; 8 / 18% / 49%  | 1 / 58% / 51%; 11 / 13% / 43% |
| current rule | recallGain ×0.5 | 23              | 5 / 20% / 30%; 43 / 3% / 25% | 6 / 16% / 26%; 39 / 3% / 23%  | 5 / 21% / 27%; 57 / 3% / 7%   |
| A2           | reference       | 25              | 2 / 46% / 23%; 7 / 14% / 23% | 1 / 56% / 29%; 8 / 13% / 14%  | 1 / 58% / 30%; 7 / 16% / 20%  |
| A2           | recallGain ×0.5 | 30              | 4 / 22% / 19%; 24 / 4% / 15% | 4 / 24% / 24%; 17 / 7% / 24%  | 3 / 27% / 24%; 24 / 5% / 9%   |
| A4           | reference       | 21              | 1 / 54% / 27%; 6 / 16% / 30% | 1 / 63% / 34%; 6 / 16% / 27%  | 1 / 65% / 36%; 5 / 21% / 37%  |
| A4           | recallGain ×0.5 | 25              | 3 / 30% / 22%; 14 / 7% / 27% | 3 / 32% / 24%; 16 / 10% / 27% | 2 / 35% / 24%; 15 / 9% / 24%  |

- **The rate of introductions is a poor forecaster.**
  - For the next row it is within a session about 60% of the time for the reference learner, and only a third of the time for a slow one.
  - For the 46 basic it is off by 5–8 sessions for the reference learner and by 15–24 for a slow one.
  - The rate falls as reviews pile up, and a learner who forgets slows it further. A rate measured early does not see either.
- **A4 forecasts best** of the three policies: its pace changes least.
- **"Session" is a weak unit.** With nothing due and the learning slots full, A4 ends a session early. Its sessions average 21 tasks against A2's 25, and for some seeds they are shorter still. A forecast in sessions depends on how long a session is. Sittings or days may make a steadier unit for the home; ADR 099 asks for sessions, so this is a question for the model ADR.
- **Better forecasters to try:**
  - The planner plays the learner forward against its own memory model: it expects the answers its model predicts and counts the sessions until the row is introduced.
  - A range ("in 2–4 sessions") instead of a number.

## Main table

The three learners, 50 seeds, 60 days. Rows for the current rule, A2 and the new candidates; the full table, with A and B, is in the output of `run sim`.

| Policy                    | Learner  | Reads 46 basic, day | Reads 104, day   | Unlocked 46, day | Unlocked by day 7 | Review retention   | Next-day recall of a new kana | min/day, days 1–14 |
| ------------------------- | -------- | ------------------- | ---------------- | ---------------- | ----------------- | ------------------ | ----------------------------- | ------------------ |
| current rule              | beginner | 11 (9–12), 100%     | 21 (19–24), 100% | 9 (8–11), 100%   | 38 (33–44)        | 88.9 (85.6–91.1)%  | 60 (54–65)%                   | 9.8 (8.9–10.4)     |
| current rule              | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 8 (7–9), 100%    | 43 (37–48)        | 99.8 (99.6–100.0)% | 99 (98–100)%                  | 9.8 (8.9–10.3)     |
| current rule              | forgot   | 8 (7–9), 100%       | 18 (17–20), 100% | 8 (7–9), 100%    | 43 (37–48)        | 99.8 (99.3–99.8)%  | 99 (97–100)%                  | 9.8 (8.9–10.2)     |
| A2                        | beginner | 7 (6–9), 100%       | 13 (12–15), 100% | 5 (4–6), 100%    | 63 (52–74)        | 92.5 (91.2–93.3)%  | 35 (28–41)%                   | 8.5 (8.0–8.9)      |
| A2                        | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.7 (99.5–99.9)%  | 100 (98–100)%                 | 4.1 (4.0–4.4)      |
| A2                        | forgot   | 3 (3–4), 100%       | 6 (5–7), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.4 (99.1–99.7)%  | 99 (97–100)%                  | 4.2 (4.1–4.5)      |
| **A4**                    | beginner | 7 (6–9), 100%       | 13 (11–15), 100% | 6 (4–7), 100%    | 63 (50–75)        | 95.0 (94.6–95.6)%  | 46 (39–52)%                   | 8.4 (8.0–9.0)      |
| **A4**                    | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.5 (99.2–99.8)%  | 99 (98–100)%                  | 4.1 (4.0–4.6)      |
| **A4**                    | forgot   | 3 (3–4), 100%       | 6 (6–8), 100%    | 2 (2–3), 100%    | 104 (104–104)     | 99.0 (98.7–99.4)%  | 99 (96–100)%                  | 4.3 (4.1–4.7)      |
| B4: half-life, A4 planner | beginner | 8 (7–9), 100%       | 15 (14–18), 100% | 6 (5–8), 100%    | 54 (45–61)        | 98.2 (97.5–98.9)%  | 57 (49–63)%                   | 10.4 (9.5–10.8)    |
| B4: half-life, A4 planner | knower   | 1 (1–1), 100%       | 1 (1–1), 100%    | 5 (5–7), 100%    | 64 (54–74)        | 99.9 (99.8–100.0)% | 100 (98–100)%                 | 8.8 (8.7–9.4)      |
| B4: half-life, A4 planner | forgot   | 6 (5–7), 100%       | 12 (11–14), 100% | 5 (5–7), 100%    | 64 (54–73)        | 99.8 (99.7–99.9)%  | 99 (97–100)%                  | 8.9 (8.8–9.5)      |

Next-day recall of a new kana rises from 35% (A2) to 46% (A4). A kana that graduates during its first day is a learned kana by the evening, and look-ahead reviews it before the night.

## What part 3 shows

1. **A review must cover the gap until the next session, not only the present moment.** With look-ahead, FSRS-6 with default weights and a requested retention of 0.90 keeps review retention above 89% for every learner tried. The one exception is the learner whose memory gains least from easy recalls, held at 87%. A4 reaches the reference learner's goals as fast as A2: day 7, 95%, 8.4 minutes a day.
2. **Adaptation to the observed retention is a small correction.** It is worth keeping because it costs nothing where retention holds.
3. **Fitting the memory model gives about a point of retention.** Within 30 days it adds little and carries a risk the simulation cannot measure. Fitting on real answers is a question for after the release, when there are answers to fit on.
4. **With look-ahead, the memory model's curve matters.** The half-life model doubles the review time of learners who already know the kana. Of the two models tried, FSRS-6 is the better fit.
5. **Forecasts from the rate of introductions are rough.** The next row comes within ±1 session about 60% of the time, and the 46 basic are off by about a quarter. The home should show a range, or a forecast that plays the planner forward, and the unit (sessions, sittings or days) is open.

## Next parts

1. **A forecast that plays the planner forward**, and a range instead of a number. The unit of a forecast is decided with the model ADR.
2. **Evidence by task type, answer time and hints,** and the tasks of ADR 099 as far as they change the memory state.
3. **Katakana**, transfer and the credit from composites to their parts.
4. **Merge across devices:** a replay of the merged answer log against the last state per kana. Look-ahead needs the gaps between sessions, and fitting needs every answer, so this choice is wider than in part 2.
