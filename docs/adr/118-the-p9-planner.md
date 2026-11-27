# ADR 118: The P9 Planner: a Word After Every 5 Kana Tasks, a Round of Errors After the Session, a Slip in a Recall Graded Hard

- **Status:** In force.
- **Context:**
  - [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), point 2, has the planner pick a kana and a task for it. A session has `SESSION_TASKS` = 30 tasks and ends early when the planner has nothing to offer ([learning.md](../spec/learning.md)).
  - [ADR 116](116-words-written-in-kana-and-varied-tasks-in-p9.md) added words and new task types to P9 and asked that they be interleaved. [ADR 117](117-grades-of-the-p9-task-types.md) graded them. It left to part 3 of the research when word tasks start, how many a session holds, and the threshold of rule errors.
  - [Part 3 of the P9 research](../research/2026-11-27-p9-planner.md) simulated these questions on the production model, 50 beginners over 60 days on hiragana:
    - **Placement.** A word after every 5 kana tasks keeps the pace of a run without words, with 15% fewer reviews and 93.2% retention of reviews. It holds at 0.3 of a recall per kana read.
    - **The carrier.** A word that takes the place of a recall is faster if reading a kana in a word gives at least 0.6 of a recall. At 0.3 the retention of reviews falls to 86%.
    - **The start.** A threshold of 25 readable words starts words with the k row on day 1, at no cost. Leaving out the last 30 words takes repeats on the same day from 4.3% to 0.2%.
    - **The re-check.** An extra recall after an error changes nothing measurable: the model's own step of 30 seconds already comes about 7 tasks later.
    - **The closing word** costs nothing.
  - An error near the end of a session breaks the promise of the notice line that the kana comes back later in the session (decision 152). The maintainer proposed that the session keep its length and be followed by a round that checks each kana answered wrong once, to tell an error of haste from one of memory.
  - Table 5 of the note measured slips and that round:
    - **Slips read as errors.** With an assumed 3% of slips on recalls of known kana, a slip read as an error, as today, leaves the learner knowing 89 kana on day 14 instead of 103, and the track is read on day 15 instead of 13. At 6% it is 65 kana and day 22.
    - **Slips read as "hard"** cost nothing at either rate.
    - **The round.** A round of at most 5 kana reads the track on day 12 instead of 13, at no cost in retention or time, and adds about 0.2 tasks to an average session.
  - On 2026-11-27 the maintainer accepted the start at 25 words, the round after the session, and an MVP without the carrier.

- **Decision:**
  1. **Word tasks go between the kana tasks.**
     - **Cadence.** A word comes after every 5 kana tasks, about 16% of the tasks. The planner chooses the kana as it does now.
     - **Start.** Word tasks start once at least 25 words are readable at the start of a session.
     - **Repeats.** A word among the last 30 words given is not given again. When no word is readable, the cadence waits for one.
     - **The rules of っ and ー.** A word with っ or ー is readable only after the introduction of its rule (ADR 117, point 3).
     - **No carrier.** A word never takes the place of a recall. That comes back after the release only if the answer log of real learners shows that a kana read in a word holds as well as one recalled alone.
  2. **The closing word.** The last task of a session is a word whose kana were all answered in the session. When no such word is readable, the session ends as it does now.
  3. **The re-check after an error is the model's learning step.** No extra recall is planned after an error.
  4. **A round of errors follows the session.**
     - **Length.** A session keeps its length: `SESSION_TASKS`, or fewer when the planner has nothing to offer.
     - **The round.** Right after the last task, each kana answered wrong in the session comes back once as a recall, in the order of its first error, at most 5. A kana is wrong when it was confused or not remembered (point 5). A forgiven slip does not make it wrong.
     - **Grade.** A round task is a recall like any other and is graded as one.
     - **The summary** follows the round, and the session's `end` event is written after it. A session left early has no round, as it has no `end`.
     - **The notice line** after an error says that the kana comes back at the end of the session.
  5. **A slip in a recall is "hard".** This applies to a recall and to each kana of a word, which is one recall per kana (ADR 117, point 1).

     | what happened on the kana                                                                | reading        | grade                     | in the round |
     | ---------------------------------------------------------------------------------------- | -------------- | ------------------------- | ------------ |
     | one rejected key that matches no kana, then the kana typed right within its pace, no Esc | haste (a slip) | hard                      | no           |
     | the romaji of another kana typed                                                         | confused       | "again" and the confusion | yes          |
     | Esc, two or more rejected keys, or the right input after a slip but slower than the pace | not remembered | "again"                   | yes          |

     The event logs the number of rejected keys as `misses`, the field ADR 117 gives a fluency run. The fold grades it from `misses`, `wrong` and the time, so the log stays a record of what happened. In a fluency run the slip keeps ADR 117's grade, no update.

  6. **The rules of っ and ー are shown again after 2 rule errors in a row.** After the introduction of a rule, and after each time it is shown again, the next 2 word tasks are words with it.
  7. **The other task types enter by conditions, not by a lottery.** Each takes the task of a kana the planner has already chosen, when its condition holds:

     | task type             | takes the task of                                    | when                                                                                                | at most                       |
     | --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------- |
     | rule introduction     | the next word task                                   | before the first readable word that needs the rule; again after 2 rule errors in a row              | 1 a session                   |
     | transfer (か → カ)    | the introduction and the recognitions of a katakana  | its hiragana is learned                                                                             | as recognition today (1 in 4) |
     | build                 | the introduction and the recognitions of a composite | its parts are learned                                                                               | as recognition today          |
     | contrast              | a recognition                                        | the kana has a confusion count of at least `WEAK_CONFUSIONS` (2) with an introduced kana of its set | as recognition today          |
     | find the error        | a review recall                                      | the kana has such a confusion and a readable word holds it                                          | 1 a session                   |
     | fluency run           | one slot in the middle of the session                | at least 8 learned kana are accurate (`WEAK_ACCURACY`) and slower than their pace                   | 1 a session, about 20 s       |
     | hiragana or katakana? | a recognition                                        | both tracks have learned kana                                                                       | 1 a session                   |

     Recall keeps three tasks in four of the learning tasks, as now. No rule against two tasks of a kind in a row is added: the cadence of words and these conditions interleave the session.

- **Justification:**
  - Words between tasks add practice on top of the planner's own recalls. Even if the model over-counts a read, a review only moves a little later. A carrier replaces recalls, so the same error makes reviews fail. How much reading in a word gives is not measured anywhere for kana, and the carrier would be a bet on it.
  - At 25 readable words the first words are real ones (かき, おいしい) rather than the vowels' interjections, and the threshold costs nothing.
  - The benefit of feedback after an error comes from seeing the right answer, not from testing it again at once (Pashler et al. 2005). The model's step already brings the kana back a few tasks later.
  - **The round keeps the screen's promise without making the session longer.** It costs little because most sessions end with few errors. The cap of 5 keeps a hard session from being followed by a second one.
  - **Within the task, haste is told from forgetting by the error itself.** After Esc or the feedback that teaches, the learner has just seen the answer, so a right answer in the round shows that the answer was seen. That is why a slip is graded where it happens and is kept out of the round.
  - **Sending a known kana back to learning for a slip** is the costliest error the three parts measured. It costs 5 correct recalls and a place among the 5 learning kana, so introductions wait. A wrong kana, Esc, several errors and a slow recovery all stay errors, so forgetting stays visible.
  - With a threshold of 1, a katakana learner who knows the rules and slips one time in ten would see a rule again about every 4 sessions. With 2 it is about once in 50 sessions, and a learner who errs half the time still sees it within about 3. A threshold of 3 is too slow to catch a rule not understood.
  - Every condition of the mix is checked from the model's state. `WEAK_CONFUSIONS` and `WEAK_ACCURACY` keep "weak" meaning what it means on the home.

- **Rejected alternatives:**
  - _The carrier, alone or with words between tasks:_ see the justification. Words every 5 tasks with a carrier of 0.35 was also slower than either alone.
  - _Words from the first session:_ the vowels give mostly interjections.
  - _A word after every 2 or 3 kana tasks:_ slower for the kana (part 2). A word after every 4 to 7 tasks gives the same as every 5.
  - _A recall planned 1, 2, 3 or 5 tasks after an error:_ no measurable effect.
  - _A session that does not end while a kana answered wrong waits for its step, up to 5 tasks past `SESSION_TASKS`:_ the first proposal. The round does the same with a fixed session, and a session's length stays something the learner can count on.
  - _A round of every error:_ the same result as at most 5. Without the cap, a hard session would be followed by a second one.
  - _Slips in a recall as errors (today):_ the costliest choice measured.
  - _Slips in a recall as no update, as in a fluency run:_ a recall must still tell the model something, and the learner did recall the kana.
  - _A rule threshold of 1 or 3:_ see the justification.
  - _A random share of each task type, or no two tasks of a kind in a row:_ a lottery the model cannot justify, and a rule that would fight the planner's choice of kana.

- **Consequences:**
  - The recall row of ADR 100, point 4 ("a recall with an error … is wrong"), and point 1 of ADR 117 are amended by point 5: one quick slip is "hard". ADR 117's threshold of 2 rule errors is confirmed.
  - [phases.md](../spec/phases.md), P9, refers to this ADR.
  - [learning.md](../spec/learning.md) takes the cadence, the round, the closing word and the conditions of the mix in P9's planner pull request, together with the constants. It describes the planner as it is until then. The new `misses` of a recall changes the log with the rest of ADR 117, point 6.
  - The design session of P9 draws the round and the line that introduces it, the closing word, and the notice line "comes back at the end of the session".
  - The rate of slips is an assumption. After the release the log shows it, as it shows how a kana read in words holds.
