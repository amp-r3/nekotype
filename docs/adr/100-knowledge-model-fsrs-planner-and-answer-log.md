# ADR 100: The Knowledge Model: FSRS-6 With a Look-Ahead Planner, Grades by Task Type, and an Answer Log Synced as Sync Format 3

- **Context:** P7 replaces confidence and the Leitner boxes of [Learning](../spec/learning.md) with a knowledge model ([Phases](../spec/phases.md), P7). [ADR 099](099-learning-home-methods-and-phases-after-p6.md), point 8, lists what the model must accept from the start. The P7 research compared candidates on simulated learners in four parts ([part 1](../research/2026-11-21-p7-knowledge-model.md), [part 2](../research/2026-11-21-p7-knowledge-model-part-2.md), [part 3](../research/2026-11-21-p7-knowledge-model-part-3.md), [part 4](../research/2026-11-21-p7-knowledge-model-part-4.md)) with `packages/sim`. Part 4 ends with what this ADR has to decide:
  - the memory model and the planner;
  - how the retention goal is counted;
  - the forecast and its unit;
  - the grade of each task type;
  - when katakana is offered;
  - credit to parts;
  - the sync format.

  The phase says that the acceptance criteria of P7 are set here. The maintainer took the open choices on 2026-11-21: the forecast unit, the fate of the current learning data, the storage of the log in D1, what the log holds, no compaction, one session button, when a kana counts as mastered, and how a session treats two tracks.

- **Decision:**
  1. **Items and their state.**
     - An item is a learnable kana of either track ([Learning](../spec/learning.md#tracks)), keyed by its kana key. Words join as items of their own in P12 and do not change the state of a kana.
     - Each item has a phase (new, learning or learned), an FSRS-6 memory (stability and difficulty) with the default weights, the time it was last seen, and, while it is learning, its count of correct recalls in a row.
     - The state is never stored or synced. It is a fold of the answer log (point 7): applying the log in order to an empty state gives it. Values of the learner as a whole (the gaps between sessions, the observed review retention) are folded from the same log.
     - Fitting the memory model to the learner's answers is not part of the MVP. It is a question for after the release, when there are real answers to fit on (part 3).

  2. **The planner** is candidate A4 of part 3.
     - **Introduction.** A new kana is introduced when fewer than 4 kana are learning and every kana it is built from is learned. The dependencies are those of [Learning](../spec/learning.md#unlocking) (が → か; きゃ → き, や); the order is track order (see point 5 for two tracks). An introduction gives the kana its first memory with the grade "again" and puts it in learning.
     - **Learning steps in time.** A learning kana comes back 30 s after its last answer, and the step doubles after each correct recall: 30 s, 1, 2, 4, 8 min. It is learned after 5 correct recalls in a row. An error sets the count to 0; a correct recognition keeps it.
     - **Look-ahead.** A learned kana is due when its predicted recall would fall below the requested retention, 0.90, by the expected start of the next session. That moment is now plus the median of the learner's last 10 gaps of over an hour between two answers, or 12 hours until there is one. A failed review puts the kana back in learning.
     - **Adaptation.** A moving average of the outcomes of reviews, at rate 0.05, starts at 0.90. While it is below 0.90, a pressure `p = clamp((0.90 − average) / 0.10, 0, 1)` raises the requested retention towards 0.98, lowers the number of kana learning at once from 4 towards 1, and adds up to 2 correct recalls before a kana is learned.
     - **Tasks.** Each task takes, in this order: the due kana with the lowest predicted recall; a learning kana whose step has passed, the one waiting longest first; an introduction; a learning kana whose step has not passed. The kana of the previous task is left out when another is available. A task on a learning kana is recognition with probability 0.25 and recall otherwise; a review is recall.
     - **Session.** A session has at most 30 tasks and ends early when the planner has nothing to offer. There is one kind of session: reviews, learning steps and introductions mix in it.
     - All numbers of this point are code constants, as simulated. A change to one needs a run of `packages/sim` on the production model (point 10).

  3. **The retention goal** of [Learning goals](../spec/README.md#learning-goals) is counted on the scheduled reviews of learned kana. The first answers on a new kana on the days after its introduction are learning, not reviews (part 3). Under the simulated reference learner, the next-day recall of a new kana is about 46%. Relearning on the second day is part of the plan and is not shown as a failure.

  4. **Grades.** An answer becomes an FSRS grade when the log is folded; grades are never stored, so a change of this table reinterprets the history. A wrong answer is "again". A correct one:

     | Task                                  | Kana it updates                                                      | Grade of a correct answer                                    | Other state                                      |
     | ------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
     | recall (shape → romaji)               | the kana                                                             | good within the target time, hard when slower or with a hint | confusion with the kana typed, when there is one |
     | recognition (sound → one of 4 shapes) | the kana                                                             | hard                                                         | confusion with the option chosen                 |
     | contrast (which of a confusable pair) | the kana asked                                                       | hard                                                         | the pair's confusion count decays on a success   |
     | transfer (か → カ)                    | the katakana; the hiragana as a hard review, only when it is learned | hard                                                         | none                                             |
     | build (か + ゛ → が)                  | the composite; each learned part as a hard review                    | good or hard by time                                         | none                                             |
     | fluency run (about 20 s of kana)      | each kana typed, once per run                                        | good within the target time, otherwise no update             | none; an error counts as a recall error          |
     | listening (sound → shape)             | the kana                                                             | hard                                                         | confusion with the option chosen                 |
     | dictation (sound → romaji)            | the kana                                                             | good or hard by time                                         | none                                             |
     | minimal pair (か or が)               | the kana asked                                                       | hard                                                         | the pair's confusion count                       |
     | a word (P12)                          | each kana of the word that is learned, as a hard review              | set by the P12 ADR                                           | none                                             |
     - The target time is `settings.learn.targetMs` (1500 ms by default). It keeps its range and now separates good from hard. The answer time of a recall is A37's.
     - A recall with an error (a rejected key, or Esc that shows the romaji) is wrong, as now. A hint is a help that does not give the whole answer; none exists before P9.
     - **Credit to parts:** a correct recall or build of a composite (が, きゃ) is a hard review of each of its parts that is learned (part 4: about 5% fewer reviews at no cost).
     - **Re-check after an error:** an error puts the kana in learning (point 2), so the kana comes back about 30 s later in the same session. The re-check is a learning step and does not raise the stability as a review on a later day would.
     - **Answer features.** The log stores the task type, the kana, correctness, the answer time, whether a hint was used, and the wrong answer given (the option chosen, or the kana the typed romaji matched). The lag in tasks since the kana was last seen, the re-check and the confusion count per ordered pair (kana asked, kana given) are derived from the log.
     - P7 builds recall and recognition only. The log format and the fold accept every row of the table from the start and are tested on synthetic answers. A later phase whose research finds a better grade for its task changes the row in its own ADR.
     - The confusion counts replace `mixups`: the recognition options of [Learning](../spec/learning.md#recognition-options) take the first distractor from them.

  5. **Two tracks.**
     - A session reviews the due kana of both tracks. A started track is not left to fade while the other is selected.
     - New kana come from the selected track (`settings.learn.track`). Once both tracks have an introduced kana, the planner also introduces from the other track when it is more than 10 introduced kana behind the selected one, as the simulation alternated them.
     - The model suggests katakana once the 46 basic hiragana are learned (part 4: the 46 basic katakana on day 15 instead of 20, nothing lost on hiragana). It is a value of the model; P8 shows the suggestion. The learner can start katakana at any time by switching the track.
     - A katakana gets no head start from its hiragana: its memory starts as that of any new kana. A transfer answer is at most a hard review of the hiragana (point 4). Part 4 found a head start costs 2–2.5 points of retention even when transfer is real.
     - Each track introduces its own items; A7 as amended by ADR 099 holds.

  6. **Forecast and outline,** computed by the model in P7 and shown by the home in P8.
     - **The forecast** is of one target: the next row of the selected track that is not fully introduced. Far targets ("all 46 basic") are shown as counts ("23 of 46"), not forecast (part 4).
     - **Unit:** sessions, as ADR 099 asks; a session is the planner's session of point 2. It is shown as a range ("in 2–4 sessions"), never as one number, and never in days.
     - **Method:** the planner is copied and played forward 10 times. Future sessions have the learner's usual length and follow at the median gap. The learner answers with its observed share of correct answers, taken separately over its last 200 learning answers and its last 200 reviews. The median of the plays, multiplied by the median ratio of actual to forecast sessions of the last 10 settled forecasts of a next row, is the forecast; the 10th and 90th percentiles of the plays, multiplied by the same ratio, are its range. The past forecasts are device-local, like K, and are not synced.
     - **The outline** of the next session ("5 reviews, 2 new") plays the planner over one session with the answers the memory model predicts. It is an outline, not a promise.
     - **What got stronger** compares the item states at the start of the previous session with the current ones; both come from the fold.
     - The forecast and the outline are computed before a session starts or after it ends, never in a keystroke handler.

  7. **Sync format 3: an answer log built on the client.**
     - **Events.** The log holds learning events: an introduction, an answer, the start of a session and its end. A session start carries the device's UTC offset, so the local days of its answers can be derived. An answer holds its outcome and time, not its keys: the raw keystroke log is still never persisted. Settings are not events: they stay one document, last-write-wins, as now.
     - **Identity and order.** Each event carries `at` (the device clock in Unix ms, never lower than the device's previous event), a log device id `dev` (random, created with the log on the device) and a counter `n` per device. `(dev, n)` identifies an event, so an event received twice counts once. The log is ordered by `(at, dev, n)`. A wrong clock puts an event at the wrong place, which changes its kana's state but loses nothing.
     - **Client.** IndexedDB keeps the whole log. The state, the chart and the statistics are a fold of it. An event is written after its answer, outside the keystroke handler, as now. A guest's log stays local; at the first sign-in its events go up in batches.
     - **Batches.** A batch is a slice of the events not yet acknowledged, within the existing body limits (256 KB, 60 KB for `keepalive`). The `seq` rule per device of [Storage and sync](../spec/storage-sync.md#batches) stays. The caps per kana and per bucket day, `splitLearnDelta`, decay and the merge rules of the learning state go.
     - **D1: one row per accepted batch,** with the user, the device, `seq`, the events as one JSON text, and a server-assigned increasing id. The server checks the batch against the schema and stores it. It never parses the events into a state and never computes one, so its CPU cost depends on the batch, not on the history. A device reads the rows of other devices after the last id it holds, in pages within the body limit. The learning columns of `user_stats` go. Per answer, a row would spend the 100,000 rows written per day on a few hundred learners.
     - **Statistics** come from the log on the client: the session counters, the runs of active days and the streak (A41), and the daily median answer time, now the exact median of the day's recall answers rather than a bucket's midpoint (A42).
     - **No compaction in the MVP.** A year of daily practice is about 40,000 answers, 1–2 MB per learner; a fresh fold of that many took about 10 ms in Node (part 4). The whole history stays, so a better model, and fitting after the release, apply to every past answer without a migration. Compaction returns only if the fold or the first download breaks a limit of point 10.
     - `SYNC_FORMAT_VERSION` becomes 3; a client of format 2 gets the existing `400` path.

  8. **The current learning data are reset, not converted** (ADR 061). `SCHEMA_VERSION` grows, so each device's IndexedDB starts empty. A D1 migration removes the learning columns of `user_stats`; the users, their sessions and their settings stay. The maintainer's progress starts over. A conversion of the 10 recent answers per kana would be code for one person, run once.

  9. **The screens in P7,** with the smallest change the new state needs and no new design (ADR 099, point 8):
     - **One "Continue"** starts the planner's session. "Review (N)" goes; the number of due kana stays visible as text. The session line shows `learning · 7 of 30`.
     - **Chart states:**

       | State    | Condition                                          |
       | -------- | -------------------------------------------------- |
       | Locked   | new                                                |
       | Learning | learning, including a learned kana that lapsed     |
       | Learned  | learned, stability under 21 days (was "Confident") |
       | Mastered | learned, stability of at least 21 days             |

       The due mark is a due learned kana (point 2). "Mastered X of N" counts mastered kana. 21 days is the "mature" line of Anki. It lies between the intervals of the former boxes 4 and 5 (14 and 30 days), the boxes that made a kana mastered.

     - **The tooltip and the details** keep the median answer time and the accuracy of the last 10 recall answers, now derived from the log. The next review is the date on which the predicted recall reaches 0.90. Mixups become the confusion counts of the kana.
     - **The session summary** lists the kana introduced, the kana learned during the session (in place of "became confident"), faster and slower kana, and confused kana.
     - `/stats` keeps its content, computed from the log.

  10. **Acceptance criteria of P7:**
      - **Model.** The model and the planner are pure TypeScript, with no DOM, storage or signals, with time and randomness injected; they run in the browser and in a Worker. The FSRS-6 code matches ts-fsrs 6.0.0 on reference cases, as `packages/sim` tests it now.
      - **Simulation on the production model.** `packages/sim` runs A4 from the production code, not from a copy. Its main table for the beginner under the reference learner gives:
        - the 46 basic hiragana read by day 8 (median);
        - review retention of at least 90%;
        - at most 10 minutes a day over days 1–14.

        The rows of part 3 for the slow learners stay within 2 points of their published values.

      - **Fold and merge.** The state is a pure function of the log. Property tests show that two devices that exchange their events converge to the state of one device that saw every event, whatever the order of delivery, with duplicates, and with syncs that fail.
      - **Grades.** Every row of point 4 has a test on synthetic answers.
      - **Sync.**
        - A sync writes at most 3 rows as D1 counts them, indexes included: the batch and, when they changed, the settings.
        - The CPU time of `POST /api/sync` with a batch of 256 KB stays within the line of [ADR 086](086-sync-endpoint-cpu-line.md), measured on the test Pages project.
        - The sync e2e covers two devices, one of them offline for a while.
      - **Client cost.**
        - A fold of 40,000 answers on both tracks takes at most 100 ms in Chromium with a 4× CPU slowdown.
        - A forecast takes at most 200 ms under the same slowdown.
        - Neither runs in a keystroke handler. The hot-path rules and the budgets of [Quality](../spec/quality.md) hold, and the latency test passes.
      - **Forecast accuracy.** The forecast of point 6 is measured on the production model in the sim and the result is in the closing note of P7. For the reference learner, the median absolute error for the next row is at most 1 session.
      - **Spec.** The spec describes the model, the log and the screens of P7 when the phase closes (see Consequences).

- **Justification:**
  - **A4 is the only candidate that met the goals across the learners tried.** The reference beginner reads the basic hiragana on day 7, with 95% review retention, in 8.4 minutes a day. The current rule takes 11 days for 89% (part 3). Review retention stays at or above 89% for every learner but the hardest one (87%).
  - **The look-ahead fixes the misses that a fixed requested retention cannot fix.** Reviews were missed because they came late overnight. With look-ahead, a requested retention of 0.90 is enough. Adaptation is a small correction that costs nothing where retention holds.
  - **FSRS-6 with default weights rather than the half-life model.** Once the planner looks ahead, the half-life model doubles the review time of learners who already know the kana (8.8 against 4.1 minutes a day).
  - **Grades.** Answer time and task type carry information: grading every correct answer alike costs 3.5–4.3 points of retention (part 4). Tasks that can be passed without recall are weaker evidence. Grades computed at the fold keep the log a record of what happened, so a better table applies to the past.
  - **Forecast.** Playing the planner forward is the best estimate of the next row, and the correction against past errors removes its bias for a slow learner. No estimate forecasts far targets from the first weeks. Sessions follow from the model and not from how often the learner comes back. A short session that ends because nothing is due does not move the next row, which waits for the learning steps either way.
  - **The answer log.**
    - It merges without loss: the stability of one kana in ten is off by half or more under a last state per kana when 30% of syncs fail, and 0% under the log (part 4).
    - It removes the merge rules, decay and caps of sync format 2, and the server stores rows without computing a state, which keeps it far from the 10 ms CPU limit.
    - Statistics from the same log need no second sync mechanism.
    - One row per batch keeps the writes of a sync where they are now.
  - **A reset** is what ADR 061 provides before the release; the only data at stake are the maintainer's own.
  - **One session kind** is what was simulated. A review-only session would be a second planner mode with no evidence, and P8 gives one next action anyway.
  - **Reviews of both tracks in every session** keep a started track from fading, and new kana from the selected track keep the learner's choice.

- **Rejected alternatives:**
  - _Keeping the current rule:_ 11 days to the basic hiragana, and a learner who knows the kana spends 8 days unlocking them.
  - _A2 without look-ahead:_ it holds 90% only for the reference learner, and 66% for a learner whose memory grows slowly.
  - _B4, the half-life model with the A4 planner:_ the same pace for a beginner, but twice the review time for a learner who knows the kana.
  - _A requested retention of 0.93:_ it holds 91% for the hardest learner, at about a minute a day more for the others. It is the first lever to pull if real reviews fall short.
  - _Fitting FSRS to the learner now:_ about one point of retention in 30 days, and a risk the simulation cannot measure.
  - _Every correct answer graded good:_ 3.5–4.3 points of retention lost.
  - _A katakana starting as recalled when its hiragana is learned:_ 2–2.5 points of retention lost and two days later.
  - _Katakana paired with its hiragana from the start:_ the basic hiragana on day 12 instead of 7.
  - _A forecast from the rate of introductions:_ off by 5–8 sessions on the 46 basic and within ±1 session on the next row only about 60% of the time.
  - _A forecast in days or in sittings:_ days depend on how often the learner comes back (ADR 099); sittings are a concept the learner would need explained.
  - _A last state per kana as the sync format:_ it loses answers whenever a sync fails.
  - _One D1 row per answer:_ 300–500 written rows per learner a day against 100,000 a day for the whole application.
  - _The log in one document per learner:_ it grows to 1–2 MB, and parsing it does not fit in 10 ms of CPU.
  - _The log for the model and `user_stats` for the statistics:_ two sync mechanisms instead of one.
  - _Compacting old answers into a snapshot:_ the snapshot would need a merge of its own, and a change of the model would not reach the compacted history.
  - _Converting the current data into a seed log, or marking boxes 1–5 as learned:_ migration code for one person, run once.
  - _Keeping "Review (N)":_ a review-only mode of the planner that was not simulated.
  - _Sessions of the selected track only:_ the other track's reviews would wait until it is selected again.

- **Consequences:**
  - These change with this ADR:
    - [decisions.md](../spec/decisions.md): A26, A36, A40, A42 and A46 are superseded; A30, A38 and A41 are amended; A47–A52 are added;
    - [phases.md](../spec/phases.md): the acceptance criteria of P7;
    - [Learning goals](../spec/README.md#learning-goals): how retention is counted.
  - The spec files that describe the current code are rewritten in the pull requests of P7, with the code they describe. Until then they describe production:
    - [learning.md](../spec/learning.md): Unlocking, Learning session, Reviews, Boxes, the `/` screen, the session summary, Constants;
    - [metrics.md](../spec/metrics.md): confidence, mixups, decay, the streak and the daily median, the data model;
    - [storage-sync.md](../spec/storage-sync.md): the stores, the local view, merge rules, batches;
    - [backend.md](../spec/backend.md): the D1 schema, the row and CPU budgets, the sync API;
    - [frontend.md](../spec/frontend.md), `docs/architecture/` and `README.md` where they name confidence, boxes or `user_stats`.
  - Status lines change with this ADR:
    - superseded from P7: [ADR 063](063-unconfident-kana-in-focus.md), [ADR 078](078-user-stats-targeted-updates.md), [ADR 082](082-sync-acknowledgement-without-snapshot.md), [ADR 085](085-one-merge-function-tie-rule-and-split.md);
    - amended: [ADR 058](058-learning-first.md), [ADR 062](062-design-review-of-the-p3-build.md), [ADR 087](087-local-view-delta-accumulators-and-update-transactions.md), [ADR 096](096-learning-only-data-and-sync-format-2.md).
  - `p7-plan.md` comes next and splits the phase into pull requests.
  - Open after the release:
    - whether real learners forget as the reference learner does;
    - whether knowing a hiragana helps with its katakana;
    - fitting the model to the learner;
    - ranges that hold 80% of actual values (they held about half in part 4).

    The first lever, if real reviews fall below 90%, is the requested retention (0.93).

- **Status:** In force.
