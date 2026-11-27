# ADR 117: The Grades of the P9 Task Types: a Word as One Recall per Kana, Rules of っ and ー Without Memory, a Forgiven Slip in a Fluency Run

- **Status:** In force. Amended by [ADR 118](118-the-p9-planner.md), point 5: one quick slip in a recall, or on a kana of a word, is "hard" (point 1). The threshold of 2 rule errors is confirmed.
- **Context:**
  - [ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md), point 4, grades an answer by task type when the log is folded. [ADR 115](115-answer-time-graded-against-the-learners-pace.md) amended it to grade time against the learner's pace. The row of a word was left to a later ADR, and "a later phase whose research finds a better grade for its task changes the row in its own ADR".
  - [ADR 116](116-words-written-in-kana-and-varied-tasks-in-p9.md) moved the word tasks into P9 and added three task types: "find the error", "hiragana or katakana?" and the rules of っ and ー.
  - [Part 2 of the P9 research](../research/2026-11-27-p9-task-types.md) simulated word tasks on the production model, with a word after every 5 kana tasks. Counting each kana of a word as a recall of its own keeps the pace of a run without words. It needs 19% fewer reviews (1,103 against 1,354 in 60 days) and holds the retention of reviews at 93.8%. The row ADR 100 sketched, a hard review of each learned kana on success and nothing on an error, leaves the learner about 4 kana behind on day 14. The result holds whether reading in a word strengthens a kana at 0.3, 0.6 or 1 of a recall. Words that hold learning kana are read right 96–97% of the time, and the basic kana open a day earlier.
  - The note also found a fault of today's engine. A merged っX token carries the key of X, so `kite` typed for きって charges the error to て. Graded as a recall, that would send a known kana back to learning for a rule the learner has not yet got.
  - In a fluency run every rejected key is a recall error today. A run of about 20 seconds is dozens of keystrokes.
  - On 2026-11-27 the maintainer accepted the word as one recall per kana, words of learning kana, option B for the rules and the rule for a slip in a run.

- **Decision:**
  1. **A word is one recall per kana.**
     - Each kana of a word task is graded as a recall. It is right or wrong, and its time from the engine's timing of that token is measured against a pace of its own.
     - A kana read wrong is "again", with a confusion with the kana it was read as, and goes back to its learning steps.
     - A kana read right counts towards the kana's correct recalls in a row, as a recall does.
     - The log holds one answer per kana: `task: 'word'`, `k` the kana, its own `ok`, `ms` and `wrong`, and a field that links the events of one word (its reading).
     - `word` becomes a timed task type of ADR 115's pace, per device.
     - `WordKey` and the word row of `eachEffect` stay for the vocabulary of P13.
  2. **Words may hold learning kana.** A word task takes words whose kana are all introduced, not only learned, so that a learning kana is learned faster through reading. When word tasks start and how many a session holds is part 3's question.
  3. **The rules of っ and ー are introductions with an error count, not items.**
     - **Keys.** Each rule has a key of its own (`rule:sokuon`, `rule:choon`), beside `LearnKanaKey` and `WordKey`. An `intro` event introduces it, before the first word that needs it.
     - **Events.** A word logs one event per rule token, `task: 'word'` with `k` the rule key, next to the events of its kana. A merged っX gives a rule event and an event for X.
     - **A rule error** is a rejected key on a merged っX whose typed romaji is a spelling of X without the doubling (`te` for って), or any rejected key on a standalone っ or on ー. It makes the rule event wrong and grades no kana. X's event stays right once X is typed.
     - **State.** The fold keeps per rule a flag and the number of rule errors in a row. A word read with the rule right resets the count.
     - **Re-teaching.** After two rule errors in a row, the planner shows the rule again and prefers words with it. Part 3 checks the number.
     - The rules have no memory, no place on the kana chart and no place on the path. っ and ー stay "not learned" as kana ([learning.md](../spec/learning.md)).
  4. **A single slip in a fluency run is forgiven.** Each kana of a run logs the number of keys rejected on it (`misses`), beside `wrong` and its time.

     | what happened on a kana of the run                                              | grade                     |
     | ------------------------------------------------------------------------------- | ------------------------- |
     | right, no rejected key, within its pace                                         | good                      |
     | right, no rejected key, slower than its pace                                    | no update (as now)        |
     | one rejected key that matches no kana, then the right input within its pace     | no update                 |
     | the romaji of another kana typed                                                | "again" and the confusion |
     | two or more rejected keys, or the right input after a slip but slower than pace | "again"                   |

  5. **The other rows of P9:**
     - **Contrast.** Its options are the kana's confusion set (2–4 kana). The rest is as ADR 100 has it: hard on the kana asked, and the confusion count of the pair decays on a success and rises on an error. `alt` is the lure the learner is most likely to choose.
     - **Feedback that teaches, transfer and build** keep their rows. The re-check after an error stays a learning step.
     - **"Find the error"** is a new task type, `mismatch`. A word is shown with its romaji, and one kana X stands under the romaji of a kana Y from X's confusion set; `alt` is Y. Finding X is hard on X, and the confusion (X, Y) decays. Missing it is "again" on X, and the confusion (X, Y) rises. The other kana of the word are not graded.
     - **"Hiragana or katakana?"** is a new task type, `script`. It has no effect on memory or confusion and is logged for the session's ticks.
  6. **The log and the schema change.** These are the new task types, the rule keys and their events, the field that links a word's events, and `misses`. The sync format and the IndexedDB schema change with them. Before P14 that is a reset with no migration ([ADR 061](061-schema-reset-before-release.md)).

- **Justification:**
  - A word is several recalls in one task. Counting them lets the model skip the reviews the reading has already done, and that is where the pace comes back. The hard credit throws away what a word shows, and an error in a word is the most useful thing it shows.
  - The risk of counting a read as more than it is stays small. At 0.3 of a recall, retention falls by 0.2 points and the learner knows 1 kana less after a 30-day break, still more than without words.
  - Words of learned kana are read right 99% of the time and teach little. With learning kana they are a recall in context, which is the point of a learning step.
  - Two rules do not need a memory model. A wrong charge to the kana after っ is a fault whatever the grade, and the error count catches the one risk that remains: a rule the learner has not got.
  - A run invites slips. Sending an accurate kana back to learning for one is a cost with no gain. Forgiving only one quick slip keeps forgetting visible, because random keys, a wrong kana and a slow recovery all stay errors.

- **Rejected alternatives:**
  - _A word as a hard review of each learned kana, errors ignored (ADR 100's sketch):_ the weakest in the simulation.
  - _The same with the first wrong kana as "again":_ barely better, because words of learned kana are almost never read wrong.
  - _Words of learned kana only:_ see the justification.
  - _The rules as an introduction only:_ the wrong charge to the kana after っ stays, and a rule not understood goes unseen.
  - _The rules as items with FSRS memory:_ the planner would have to choose words for a rule, and the rules would need a place on the chart and on the path. That is new design for two rules.
  - _Every slip in a run as no effect:_ a learner pressing random keys would look like one who slipped.
  - _Every slip as an error (today):_ each slip sends an accurate kana back to learning.

- **Consequences:**
  - The table of ADR 100, point 4, is amended by points 1, 4 and 5. The rules of point 3 and the task types `mismatch` and `script` are new.
  - [phases.md](../spec/phases.md), P9, refers to this ADR. [learning.md](../spec/learning.md) and [storage-sync.md](../spec/storage-sync.md) take the rows, the events and the schema in P9's model pull request. They describe the model as it is until then.
  - The engine reports a rule error apart from an error of the kana. That is a change of [engine.md](../spec/engine.md) with its golden rows, in the same pull request.
  - Part 3 of the research sets when word tasks start, how many a session holds, and the threshold of two rule errors.
