# P7 knowledge model: simulated learners, part 4

Part 4 of the P7 research note. Earlier parts: [part 1](2026-11-21-p7-knowledge-model.md), [part 2](2026-11-21-p7-knowledge-model-part-2.md) and [part 3](2026-11-21-p7-knowledge-model-part-3.md). It covers the four "Next parts" that part 3 left open:

- a forecast that plays the planner forward;
- evidence by task type and answer features;
- katakana, transfer and credit to parts;
- the merge across devices.

It decides nothing. The numbers come from `packages/sim` at the commit of this note (`pnpm --filter @nekotype/sim run part4`). The beginner learns with candidate A4 from part 3 unless a table says otherwise. Each table has 20 seeds, and a cell is a median.

## Change to the simulator

The planner's state is now a fold of its answers. The gaps between sessions, which the look-ahead of A4 uses, are now taken from the answers (a pause of over an hour) instead of from session starts. A test checks that applying a run's answers to a fresh planner gives exactly the live planner's state.

The change moves A4's results by at most 0.3 points. The reference learner now gets 94.4% instead of 94.7%. A2 is unchanged.

## Forecasts that play the planner forward

At the first session of each day, the harness copied the planner and played it forward ten times. The play counted the sessions until the target was introduced:

- each future sitting has the learner's usual length;
- sittings follow at the median gap between the learner's past sittings;
- the targets are the next row and all 46 basic kana.

The median of the ten plays is the forecast. The 10th and 90th percentiles are its range. Three ways to answer in the play:

- **Forward:** the learner answers as the planner's memory model predicts.
- **Forward, observed:** the learner answers with its observed share of correct answers, separately on learning tasks and on reviews. The share is taken over its last 200 answers of each kind.
- **Forward, corrected:** the observed forecast, multiplied by the median ratio of actual to forecast sessions of its last 10 settled forecasts for the same target.

"All sessions" is part 3's best estimate from the rate of introductions, made at the same moments.

A cell is the median |error| in sessions / the median signed error (negative = too early) / the share within ±1 session / the share within ±25% / the share whose actual value fell inside the 10–90% range.

| Learner         | Target   | All sessions            | Forward                      | Forward, observed         | Forward, corrected          |
| --------------- | -------- | ----------------------- | ---------------------------- | ------------------------- | --------------------------- |
| reference       | next row | 2 / −2 / 44% / 29% / —  | **1 / −1 / 64% / 52% / 53%** | 1 / −1 / 57% / 39% / 48%  | 1 / 0 / 55% / 42% / 50%     |
| reference       | 46 basic | 5 / −5 / 19% / 34% / —  | 10 / −9 / 8% / 9% / 4%       | 5 / −5 / 16% / 33% / 27%  | 5 / −5 / 16% / 33% / 27%    |
| recallGain ×0.5 | next row | 3 / −2 / 27% / 26% / —  | 5 / −5 / 16% / 11% / 11%     | 4 / −4 / 18% / 14% / 26%  | **3 / 0 / 29% / 33% / 44%** |
| recallGain ×0.5 | 46 basic | 17 / −17 / 9% / 26% / — | 36 / −35 / 1% / 1% / 0%      | 19 / −19 / 3% / 17% / 10% | 19 / −19 / 3% / 17% / 10%   |

- **Every forecast is too early.** The planner's memory model expects fewer errors while a kana is learned than the learner makes. For the reference learner this is a session; for a slow learner the model's own play is 35 sessions early on the 46 basic.
- **For the next row, playing forward is the best estimate.** For the reference learner it is within ±1 session 64% of the time. For a slow learner the correction against past errors removes the bias: the median error is 0 and 44% of actual values fall inside the range.
- **Far targets cannot be forecast.** Every estimate is off by a quarter or more on the 46 basic. The correction does not help there: a far target settles once, so it never has past forecasts of the same target to learn from.
- **The ranges are too narrow.** About half of the actual values fall inside a 10–90% range that should hold 80%. The plays vary only the answers, not the sittings the learner skips or a change of pace.

For the home of P8 this suggests:

- forecast only the next row (or the next group);
- show it as a range;
- correct it against the learner's own past forecasts;
- leave far targets to a plain count ("23 of 46 basic").

The forecast costs ten copies of the planner played for up to 60 sessions. It is cheap enough to compute before a session, but not on every keystroke.

## Evidence by task type

### Grading

How an answer becomes a grade, on A4, 30 days. A cell is the day the 46 basic kana are read / review retention / minutes a day.

- `time` (A4 so far): a correct recall within 1.5 s is good, a slower one hard, a correct recognition hard.
- `binary`: every correct answer is good.
- `recognition good`: a correct recognition is good, recall as in `time`.
- `recognition none`: a recognition changes the phase only, not the memory.

| Reference learner     | time             | binary           | recognition good | recognition none |
| --------------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| reference             | 7 / 94.4% / 8.3  | 7 / 90.8% / 8.1  | 7 / 91.6% / 8.1  | 7 / 93.6% / 8.2  |
| recallGain ×0.5       | 18 / 89.3% / 9.5 | 19 / 85.0% / 9.3 | 20 / 85.2% / 9.4 | 17 / 89.3% / 9.5 |
| recognitionShare ×0.5 | 7 / 94.2% / 8.5  | 8 / 90.7% / 8.4  | 8 / 91.1% / 8.4  | 7 / 93.5% / 8.6  |
| familiarity ×1.5      | 7 / 94.3% / 8.2  | 7 / 90.6% / 8.2  | 7 / 91.3% / 8.2  | 7 / 93.6% / 8.2  |

- **Answer time and task type carry information.** Grading every correct answer the same costs 3.5–4.3 points of retention. Treating a correct recognition as strong evidence costs about 3.
- **This is partly built into the simulation.** The reference learner answers faster when its recall is higher, and recognition succeeds by familiarity. Real learners are likely to behave the same way, but by how much is not known.
- **Weak evidence is better than none:** `recognition none` is a point below `time`.

### The task types of ADR 099

ADR 099 (point 8) asks the P7 model to accept every task type and a set of answer features. The simulation tested only recall and recognition. For the rest, the research proposes the following mapping, as input to the model ADR:

| Task                                   | Which kana it updates                                               | Grade of a correct answer                                    | Other state                                  |
| -------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| recall (shape → romaji)                | the kana                                                            | good within the target time, hard when slower or with a hint | confusion count on the wrong kana typed      |
| recognition (sound → one of 4 shapes)  | the kana                                                            | hard                                                         | confusion count on the option chosen         |
| contrast (which of a confusable pair)  | the kana asked                                                      | hard                                                         | the pair's confusion count decays on success |
| transfer (か → カ)                     | the katakana; the hiragana only as a hard review when it is learned | hard                                                         | none                                         |
| build (か + ゛ → が)                   | the composite; each learned part as a hard review (see below)       | good / hard by time                                          | none                                         |
| fluency run (about 20 s of known kana) | each kana typed, once per run                                       | good when typed within the target time, otherwise no update  | none; an error counts as a recall error      |
| listening (sound → shape)              | the kana                                                            | hard                                                         | confusion count                              |
| dictation (sound → romaji)             | the kana                                                            | good / hard by time                                          | none                                         |
| minimal pair (か or が)                | the kana asked                                                      | hard                                                         | the pair's confusion count                   |

These rules follow from the grading results. A task that a learner can pass without recalling the kana (one of a few options, or a pair) counts as weaker evidence than a free answer. Answer time separates a fluent recall from a slow one.

A **hint** turns a correct answer into hard. A **re-check after an error** in the same session is a learning step, not a review: it moves the kana within the session (A2's steps) and does not raise its stability as a later-day recall would. None of these rows except recall and recognition was simulated. The grades above are the starting point for the ADR, not results.

## Katakana and transfer

Both tracks (104 hiragana, 125 katakana, 229 kana in all), A4, 60 days. When katakana are introduced:

- `after hiragana`: every hiragana is introduced first, as in the table order today;
- `after basic`: once the 46 basic hiragana are learned (graduated); then the tracks alternate;
- `paired`: each katakana as soon as its hiragana is learned; the tracks alternate.

`link` gives a katakana whose hiragana is learned the first memory of a recalled kana, and two of its five correct recalls before graduation. The reference learner's transfer is an assumption, tried at two values. At 0, a katakana is learned as if its hiragana were unknown. At 1, it starts with twice the first stability when its hiragana is recalled.

| Transfer | Katakana          | Reads 46 hiragana, day | Reads 46 katakana, day | Unlocked 46 katakana, day | Reads all 229, day | Review retention | min/day, days 1–14 |
| -------- | ----------------- | ---------------------- | ---------------------- | ------------------------- | ------------------ | ---------------- | ------------------ |
| 0        | after hiragana    | 7                      | 20                     | 18                        | 27                 | 95.0%            | 9.4                |
| 0        | **after basic**   | **7**                  | **15**                 | **13**                    | **27**             | **94.9%**        | **9.7**            |
| 0        | after basic, link | 7                      | 17                     | 14                        | 30                 | 92.8%            | 9.6                |
| 0        | paired            | 12                     | 14                     | 13                        | 27                 | 95.0%            | 9.6                |
| 0        | paired, link      | 12                     | 16                     | 13                        | 28                 | 92.5%            | 9.4                |
| 1        | after hiragana    | 7                      | 20                     | 18                        | 27                 | 95.0%            | 9.4                |
| 1        | after basic       | 7                      | 15                     | 13                        | 26                 | 95.1%            | 9.7                |
| 1        | after basic, link | 7                      | 17                     | 13                        | 29                 | 92.6%            | 9.6                |
| 1        | paired            | 11                     | 14                     | 13                        | 27                 | 95.1%            | 9.7                |
| 1        | paired, link      | 11                     | 16                     | 13                        | 28                 | 92.7%            | 9.4                |

- **Starting katakana once the basic hiragana are learned** brings the 46 basic katakana five days earlier than finishing the hiragana first: day 15 instead of 20. It costs nothing on hiragana and 0.3 minutes a day. This answers the question of ADR 099 ("the model decides when to offer katakana") with a rule the simulation supports: offer katakana when the 46 basic hiragana are learned.
- **Pairing each katakana with its hiragana from the start delays the hiragana goal** from day 7 to day 12. It reaches katakana only a day sooner.
- **A strong link is harmful, even when transfer is real.** Starting a katakana as if it were recalled costs 2–2.5 points of retention and two days. The planner trusts the prior more than the learner earns it. With transfer at 1, the learner's head start is a doubled first stability: small next to what one recall adds. A link should be weak: at most a hard review of the hiragana after a transfer task (as in the table above). The katakana's own memory should start as any new kana does.
- **The simulation cannot say whether transfer exists.** Its result is about the risk of assuming it. Whether knowing か helps with カ is a question for real answers after the release.

## Credit to parts

A4, 30 days, hiragana. `partsShare` is how much a correct recall of a composite (が, きゃ) strengthens its parts in the reference learner: an assumption, tried at 0 and 0.3. With credit, the planner counts a correct recall of a composite as a hard review of each learned part.

| Parts share | Credit | Reads 46 basic, day | Reads 104, day | Review retention | min/day | Reviews |
| ----------- | ------ | ------------------- | -------------- | ---------------- | ------- | ------- |
| 0           | no     | 7                   | 13             | 94.4%            | 8.3     | 1421    |
| 0           | yes    | 7                   | 13             | 94.2%            | 8.2     | 1344    |
| 0.3         | no     | 7                   | 13             | 94.4%            | 8.2     | 1415    |
| 0.3         | yes    | 7                   | 13             | 94.3%            | 8.2     | 1341    |

Credit saves about 5% of reviews, and retention falls by 0.1–0.2 points. That holds even when the learner gains nothing from it (share 0): a hard review of a part that was recalled in a composite is a small, safe update. The effect is small because composites make up only part of the reviews. It will matter more when words (P12) give credit to every kana they contain.

## Merge across devices

One learner on two devices: the morning sitting on one, the evening sitting on the other. A device syncs at the start and the end of a sitting, unless it is offline at that moment. Three ways to merge:

- `one device`: the baseline, one planner that sees every answer;
- `answer log`: the server keeps every answer; a device sends its new answers and rebuilds its state by applying the whole log in time order to a fresh planner;
- `last state`: the server keeps one state per kana; a merge keeps, for each kana, the state with the later last answer, and the learner-wide values of the side answered last.

A4, 30 days. Stability error: |ln(S / S of the full log)| after a final sync of both devices, median over kana / 90th percentile.

| Offline | Merge      | Reads 46 basic, day | Review retention | min/day | Stability error | Phase errors |
| ------- | ---------- | ------------------- | ---------------- | ------- | --------------- | ------------ |
| 0%      | one device | 7                   | 94.4%            | 8.3     | 0.0% / 0.0%     | 0            |
| 0%      | answer log | 7                   | 94.5%            | 8.3     | 0.0% / 0.0%     | 0            |
| 0%      | last state | 7                   | 94.5%            | 8.3     | 0.0% / 0.0%     | 0            |
| 30%     | answer log | 8                   | 95.9%            | 9.0     | 0.0% / 0.0%     | 0            |
| 30%     | last state | 8                   | 97.9%            | 9.8     | 5.1% / 51.5%    | 0            |
| 60%     | answer log | 8                   | 97.7%            | 9.4     | 0.0% / 0.0%     | 0            |
| 60%     | last state | 8                   | 98.8%            | 10.2    | 11.9% / 60.8%   | 0            |

- **When every sync succeeds, the two merges are the same.** Each device starts from the full state.
- **When syncs fail, the last state per kana loses answers.** If both devices answered a kana between two syncs, only the later side's answers survive. The stability of one kana in ten is off by half or more. The planner then reviews more than it needs to: 9.8 and 10.2 minutes a day against 9.0 and 9.4. Retention is higher only because the extra reviews come early.
- **A rebuild from the answer log gives exactly the single-device state** however often a sync fails. A device works on a stale state while offline, which costs time (9.0–9.4 minutes against 8.3), but every answer counts once the devices meet.
- **The rebuild is cheap.** A fresh planner applied 3,248 answers (a beginner's 60 days) in 2 ms, 32,480 in 10 ms and 97,440 in 19 ms. These are timings in Node on the development machine; the browser is likely slower by a small factor.
  - The client can rebuild on every sync. The server only stores and returns answers and never computes a state.
  - That avoids the 10 ms CPU limit of a Pages Function ([backend.md](../spec/backend.md), [P5 CPU note](2026-11-16-p5-sync-cpu.md)).
  - A year of daily practice is on the order of 40,000 answers. Kept as small records, that is about 1–2 MB per learner in D1.
- **A rebuild needs the answers, not the state.** The look-ahead's session gaps and the adaptation's moving average are derived from answers, so they rebuild as well. Two further conditions apply:
  - the answers need a total order: time, then a device id;
  - each answer needs a unique id, so the same answer sent twice counts once.

  A device's clock can be wrong. An answer then lands at the wrong place in the order, which moves its kana's state but loses nothing.

- **What the log costs:** storage grows with practice, and a change to the model's rules reinterprets the whole history. A state merge would keep the old interpretation. The second point is an advantage: an improved model applies to every past answer with no migration.

## What part 4 shows

1. **Forecasts:** forecast only the next row, as a range, from the planner played forward. Correct it against the learner's own past forecasts. Far targets cannot be forecast from the first weeks; show them as a count.
2. **Grades:** answer time and task type are real evidence. A correct answer that can be passed without recall (options, pairs) is a hard grade; a fluent recall is good. The table above maps each task type of ADR 099 to a starting grade.
3. **Katakana:** offer katakana when the 46 basic hiragana are learned. Do not give a katakana a head start from its hiragana; a transfer task can at most review the hiragana.
4. **Credit to parts** as a hard review saves about 5% of reviews at no cost. It is worth keeping for words.
5. **Merge:** an answer log rebuilt on the client merges without loss and keeps the server simple. A last state per kana loses answers whenever a sync fails.

## What is left for the model ADR

The research has covered the questions part 1 listed. The ADR has to decide:

- the memory model and planner: A4, with its parameters;
- the retention goal as the maintainer confirmed it: scheduled reviews of learned kana;
- the forecast and its unit: sessions, sittings or days;
- the grade of each task type;
- when katakana is offered;
- credit to parts;
- the sync format: an answer log, with its ids, order and storage.

The phase plan, `p7-plan.md`, comes after the ADR.
