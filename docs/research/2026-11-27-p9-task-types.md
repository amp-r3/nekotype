# P9 research, part 2: the task types of P9 and their weight in the model

An answer becomes an FSRS grade when the log is folded, by the table of [ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 4, which [ADR 115](../adr/115-answer-time-graded-against-the-learners-pace.md) amended: time is graded against the learner's own pace. P7 wrote a row for every task type of ADR 099 and left the row of a word to a later ADR. P7 also said that "a later phase whose research finds a better grade for its task changes the row in its own ADR". P9 brings these task types:

- the methods of [ADR 099](../adr/099-learning-home-methods-and-phases-after-p6.md), point 5: contrast, feedback that teaches, transfer, build, the fluency run;
- those of [ADR 116](../adr/116-words-written-in-kana-and-varied-tasks-in-p9.md): the word, "find the error", "hiragana or katakana?" and the rules of っ and ー.

This part asks, for each of them, what an answer shows about which kana, and how the fold should count it. [Part 1](2026-11-27-p9-words-content.md) counted the words, and part 3 (the planner: the mix of a session, when word tasks start, the re-check) follows.

This note decides nothing and changes neither the model nor the app. The word was simulated, because it is the task type with the most answers and the only row still open. The others are argued from the [methods note](2026-11-21-kana-learning-methods.md) and from part 4 of the P7 research.

## In short

- **A word should count as one recall per kana.** Each kana of the word is graded as a recall would be: right or wrong, with its own time against a pace of its own. In the simulator this costs the learner no pace against sessions without words. It needs 19% fewer scheduled reviews (1,103 against 1,354 in 60 days), and the retention of reviews stays at 93.8%, above the 0.90 goal. Thirty days after day 60 the learner recalls about 3 more kana of 104.
- **The row ADR 100 sketched is the weakest choice.** That row makes each learned kana a hard review on success and ignores an error. Words then take session time while the model learns little from them, so it reviews kana the learner has just read. On day 14 the learner knows about 4 fewer kana (98.6 against 102.3), and the whole track is read one day later. Counting the first wrong kana as a recall error ("again") barely helps: words of learned kana are read right 99% of the time.
- **The result holds whatever reading in a word does to memory.** The simulator does not know how much reading a kana inside a word strengthens it, compared with recalling it alone. At 0.3, 0.6 and 1 of a recall, "one recall per kana" keeps its lead, with retention from 93.6% to 94.1%.
- **Words may use kana that are still learning.** Such words are read right 96–97% of the time. They give the learning kana their recalls in context, and the basic kana unlock on day 5 instead of 6. A word read with an error then puts that kana back to its learning steps, as a recall error does.
- **The log needs one event per kana of a word.**
  - Each event has `task: 'word'`, the kana as `k`, and its own `ok`, `ms` (from the engine's timing per token) and `wrong`.
  - The pace of ADR 115 gets `word` as a task type of its own, because a kana read inside a word is not timed like a kana alone.
  - `WordKey` stays for the vocabulary of P13. The words of part 1 have 3.4 kana on average. At one word after every 5 kana tasks, the log holds about 1.4 times the events of a run without words (in table 1, 2,685 kana tasks and 499 words against 3,005 tasks).
- **The other rows:**
  - Contrast, transfer and build keep their rows.
  - In a fluency run, a slip that matches no kana stops counting as a recall error. A typed kana that is another kana still does.
  - "Find the error" is a contrast in context: hard for the odd kana when the learner finds it, "again" and a confusion when they do not.
  - "Hiragana or katakana?" has no effect on memory.
  - The rules of っ and ー stay out of the model as items. Each is shown once, as an introduction, before the first word that needs it.
- **The mix is part 3's question.** A word after every 2 or 3 kana tasks already slows the kana: on day 14 the learner knows 89.5 and 98.6 kana. After every 5 or 10 it costs nothing.

## The word

### What the simulator does

The changes are opt-in and every earlier table reproduces (`p7 PART=main` is identical to `main`; the sim's tests pass).

- **The learner** reads a word kana by kana (`Learner.read`). Each kana is a recall with its true probability. A kana recalled is strengthened with `wordShare` of the gain of a recall alone (0.6 by default, 0.3 and 1 as bounds). A kana not recalled is shown, as after a recall error, and the reading goes on. The answer time is the sum of the kana's times, and a word task takes one overhead per word, not per kana.
- **The planner** is the production model. Its policy (`createProductionPolicy`, option `words`) puts a word after every N kana tasks of a session. The word is drawn at random from the words whose kana are all learned, or all introduced (`of`). It is chosen on its own random stream, so the planner's choices are those of a run without words.
- **What the model hears** (`mode`):
  - `none`: nothing (the learner reads, the log has no event);
  - `credit`: a `word` answer that today's fold grades by ADR 100's row: each learned kana a hard review on success, nothing on an error;
  - `again`: `credit`, plus the first kana read wrong as a failed recall;
  - `recalls`: each kana as a recall of its own, right or wrong, with its own time.
- **The words** are the 1,077 hiragana words written in kana of part 1, 1,074 of them with two kana or more. A word of one kana is a recall and is left out. There are 50 beginners, 60 days, hiragana only, and the routine of the P7 research (two sittings of about 5 minutes a day).

### Table 1: how the model hears of a word

A word after every 5 kana tasks, words of learned kana, `wordShare` 0.6. A cell is a median over 50 seeds. "Tasks" counts word tasks too. "Known" is the expected number of the 104 kana recalled.

| case     | reads 46 basic, day | reads 104, day | basic unlocked, day | review retention | reviews | tasks | words (read right) | known, day 14 | known 30 days after day 60 |
| -------- | ------------------- | -------------- | ------------------- | ---------------- | ------- | ----- | ------------------ | ------------- | -------------------------- |
| no words | 7                   | 13             | 5                   | 93.6%            | 1354    | 3005  | —                  | 102.3         | 100.0                      |
| none     | 8                   | 14             | 6                   | 94.8%            | 1320    | 3381  | 532 (99.1%)        | 97.8          | 103.0                      |
| credit   | 7                   | 14             | 6                   | 94.6%            | 1226    | 3316  | 519 (99.2%)        | 98.6          | 103.0                      |
| again    | 7                   | 14             | 6                   | 94.6%            | 1239    | 3361  | 527 (99.3%)        | 99.4          | 103.1                      |
| recalls  | 7                   | 13             | 6                   | 93.8%            | 1103    | 3184  | 499 (99.0%)        | 102.5         | 102.8                      |

- Every variant with words leaves the learner knowing more after a break (102.8–103.1 against 100.0): reading is practice.
- Only `recalls` gets the pace back. The others spend part of each sitting on words that the planner does not count, then review the same kana as if they had not been read.
- `recalls` holds retention 3.8 points above the goal with 19% fewer reviews. The model sees the reads as recalls, so it reviews less, and the reviews it keeps are harder ones.

### Table 2: what reading in a word does to memory

The same, with `wordShare` 0.3 (a kana read in a word helps half as much as the default) and 1 (as much as a recall alone).

| case    | wordShare | reads 46 basic, day | reads 104, day | review retention | reviews | known, day 14 | known after the break |
| ------- | --------- | ------------------- | -------------- | ---------------- | ------- | ------------- | --------------------- |
| credit  | 0.3       | 8                   | 14             | 94.1%            | 1253    | 95.2          | 102.5                 |
| again   | 0.3       | 8                   | 14             | 94.3%            | 1243    | 97.6          | 102.5                 |
| recalls | 0.3       | 7                   | 13             | 93.6%            | 1106    | 101.7         | 101.8                 |
| credit  | 1         | 7                   | 14             | 94.4%            | 1227    | 100.3         | 103.3                 |
| again   | 1         | 7                   | 14             | 94.9%            | 1226    | 99.5          | 103.4                 |
| recalls | 1         | 7                   | 13             | 94.1%            | 1111    | 102.7         | 103.2                 |

- **The risk of `recalls` is counting a read as more than it is.** At 0.3 the model's recalls overstate what the learner gained, and retention drops by only 0.2 points (93.6%). The learner knows 1 kana less after the break than with `again` (101.8 against 102.5), still 1.8 more than without words. A likely reason is that FSRS gains little from a recall made soon after another, and a word often comes in the same session as the kana's own task.

### Table 3: words of kana that are still learning

Words whose kana are all introduced, learning ones too (`of: 'introduced'`), a word after every 5 kana tasks.

| case    | wordShare | reads 46 basic, day | reads 104, day | basic unlocked, day | review retention | reviews | words (read right) | known, day 14 | known after the break |
| ------- | --------- | ------------------- | -------------- | ------------------- | ---------------- | ------- | ------------------ | ------------- | --------------------- |
| credit  | 0.6       | 7                   | 13             | 5                   | 93.9%            | 1209    | 513 (94.9%)        | 101.2         | 102.9                 |
| again   | 0.6       | 7                   | 14             | 6                   | 94.7%            | 1234    | 523 (96.9%)        | 101.5         | 103.1                 |
| recalls | 0.3       | 7                   | 13             | 5                   | 92.7%            | 1188    | 501 (96.5%)        | 101.8         | 101.9                 |
| recalls | 0.6       | 7                   | 13             | 5                   | 93.2%            | 1153    | 480 (96.8%)        | 103.1         | 102.8                 |
| recalls | 1         | 6                   | 12             | 5                   | 94.1%            | 1130    | 461 (96.9%)        | 103.3         | 103.3                 |

- Words that include learning kana are read wrong 3–4% of the time, so an error carries information. Under `recalls` they count towards the kana's 5 correct recalls in a row, and the basic kana open one day earlier.
- The retention of reviews stays above the goal in every case (92.7% at the lowest).
- Words make sense from the first learning kana on. What limits them early is the content, not the model: part 1 counts 12 hiragana words written in kana after the vowels and 25 after the k row.

### Table 4: how many words a session holds

Words of learned kana, `wordShare` 0.6, a word after every N kana tasks.

| case              | reads 46 basic, day | reads 104, day | review retention | reviews | words | known, day 14 | known after the break |
| ----------------- | ------------------- | -------------- | ---------------- | ------- | ----- | ------------- | --------------------- |
| recalls, every 2  | 8                   | 15             | 94.3%            | 968     | 1207  | 89.5          | 103.5                 |
| recalls, every 3  | 7                   | 14             | 94.1%            | 1028    | 756   | 98.6          | 103.3                 |
| recalls, every 5  | 7                   | 13             | 93.8%            | 1103    | 499   | 102.5         | 102.8                 |
| recalls, every 10 | 7                   | 13             | 93.5%            | 1224    | 183   | 103.1         | 101.8                 |
| again, every 2    | 9                   | 16             | 95.2%            | 1090    | 1287  | 81.8          | 103.6                 |
| again, every 3    | 8                   | 15             | 95.0%            | 1166    | 806   | 93.7          | 103.4                 |

Words beyond about one in six tasks take time from introductions. That is a rule of the planner, and part 3 sets it with the other task types in the mix.

### Limits of the simulation

- **A word the learner already knows may be read whole.** A knower who knows the word ねこ may read it at a glance. The kana are then not each recalled, and `recalls` overstates the evidence. Beginners, the main audience, do not know the words. The placement test of P11 is the answer for knowers. Until then a word of a knower is still at least a correct reading.
- **Each kana of a word is timed as a recall alone.** The real engine times a kana from the end of the one before it, so the first kana also carries the time to start reading. That is why `word` needs its own pace (ADR 115).
- **No learner in the simulator confuses scripts or misreads a rule.** Those tasks are argued below, not simulated.

## The other task types

| task                                | what a correct answer shows                                                          | proposed row (correct; wrong)                                                                                                                                                  | change against ADR 100                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| word (P9)                           | each kana of the word read right                                                     | each kana graded as a recall, by its time against the `word` pace; a kana read wrong is "again", with a confusion with the kana it was read as                                 | the row is set; the log holds one event per kana                         |
| contrast (シ ツ ソ ン)              | the kana told apart from its confusables, its sound given                            | hard on the kana asked; the pair's confusion count decays. Wrong: "again" and the count rises                                                                                  | the options are the kana's confusion set (2–4), `alt` the strongest lure |
| feedback that teaches, the re-check | the re-check a few tasks after an error is a learning step                           | as now: the error puts the kana in learning, so the re-check is a learning step and raises little stability                                                                    | none; when the re-check comes is part 3                                  |
| transfer (か → カ)                  | the katakana chosen for its hiragana                                                 | as now: hard on the katakana; the hiragana a hard review when learned                                                                                                          | none (part 4 of P7: no head start)                                       |
| build (か + ゛ → が)                | the composite from its parts                                                         | as now: good or hard by its pace; each learned part a hard review                                                                                                              | none                                                                     |
| fluency run                         | the kana is fast as well as right                                                    | good within its pace, otherwise no update. Wrong: "again" only when the typed romaji is another kana; a key that matches no kana is a slip and has no effect                   | the slip no longer counts as an error                                    |
| find the error (ADR 116)            | the odd kana X noticed under the romaji of Y, with every other kana of the word read | hard on X; the confusion (X, Y) decays. Wrong: "again" on X and the confusion (X, Y) rises                                                                                     | a new task type (`mismatch`), `alt` = Y                                  |
| hiragana or katakana? (ADR 116)     | the script of a kana, not its sound                                                  | no effect on memory or confusion                                                                                                                                               | a new task type (`script`), logged for the session's ticks only          |
| the rules of っ and ー (ADR 116)    | that the learner knows the rule                                                      | no item: each rule is an introduction shown once, before the first word that needs it; afterwards っ and ー are part of words, and a kana around them is graded as in any word | a rule introduction event (below)                                        |
| the closing word (ADR 116)          | as a word                                                                            | as a word                                                                                                                                                                      | none beyond the word                                                     |
| stroke order                        | nothing: a view, not a task                                                          | none                                                                                                                                                                           | none                                                                     |

The reasons:

- **Contrast.** The methods note proposed a contrast over the whole confusion set (シ ツ ソ ン, わ ね れ), and the engine's table of similar kana already holds their pairs. A choice between two options is right by chance half of the time, so a correct contrast should stay a hard review and must not raise more than recognition does. Its main use is the confusion count, which the planner reads to place the next contrast. The log keeps one `alt`: the option the learner is most likely to mix the kana with.
- **Feedback that teaches.** The teaching is on the screen, not in the grade. The evidence for showing the right answer next to the wrong one is strong (Pashler et al. 2005; Butler and Roediger 2008). A re-check soon after the answer was shown is weak evidence of memory (the methods note). The fold already treats it as a learning step, so nothing changes in the grade.
- **Fluency.** A run is about speed on kana that are already accurate. A key that matches no kana in a fast stream is a motor slip, not forgetting, and an "again" for it would send a known kana back to learning. A typed romaji that is another kana (`wrong` is set) is a confusion and stays an error.
- **Find the error.** The word is shown with its romaji, and one kana X stands under the romaji of a kana Y from X's confusion set. The learner must read every kana to find X, and the task is set for the confusion (X, Y). Finding X therefore makes the same case as a contrast. Missing it shows that the learner reads X as Y, the same evidence as a recognition mixup. The other kana of the word get no update: comparing a kana with given romaji is easier than recalling it.
- **Hiragana or katakana?** Telling the script says nothing about the sound, which is what the model's memory is of. It can still catch the error the transfer note warns of, answering in the wrong script. If the planner needs that, a count per hiragana–katakana pair is a later change.
- **The rules of っ and ー.** As items they would need their own memory, a place on the kana chart and on the path, and keys outside the kana table. [learning.md](../spec/learning.md) says today that っ and ー are not learned. Their spellings are a rule of the engine, and part 1 found that they matter only inside words. One introduction per rule (っ doubles the next consonant; ー lengthens the vowel) teaches the rule. The words that use it practise it. The engine merges っ with the kana after it into one token (D22), so a mistake on a doubled consonant shows as an error on that token, and the fold grades its kana.

## What the model and the log need

Nothing of this is code yet. It lists what P9's model pull request would change, for the ADR that settles part 2.

1. **`TaskKind`** gains `mismatch` (find the error) and `script` (hiragana or katakana?). `word` exists already.
2. **A word is logged as one answer per kana:**
   - Each answer has `task: 'word'`, `k` the kana, and its own `ok`, `ms` and `wrong`. The time comes from the engine's timing of that token.
   - A word in the log is the run of these events with the same word. Linking them needs a field, for example `w`: the word's reading. The session's ticks and the insights then count one word, not three tasks.
   - `WordKey` and the "word" row of `eachEffect` stay for the vocabulary of P13, where a word becomes an item of its own.
3. **The pace of ADR 115** gets `word` as a timed task type per device, next to recall, build, fluency and dictation.
4. **A rule introduction**: an `intro` event with a rule key (`rule:sokuon`, `rule:choon`). The fold keeps it as a flag, not a memory. The planner then lets words with っ or ー through.
5. **Fluency:** an error with `wrong` null no longer grades.
6. **The sync format** and the IndexedDB schema change with the events (a new field, new task types, a rule key). Before P14 that is a reset with no migration ([ADR 061](../adr/061-schema-reset-before-release.md)).
7. **The log grows faster:** one event per kana of a word, about 1.4 times the events at one word in six tasks. The acceptance of P8 measured the home's insights on a log of 40,000 answers; P9's acceptance measures them again with words.

## Questions for the maintainer

1. **Words of learning kana.** Only words whose kana are all learned (read right 99% of the time, a reward with little to teach), or words of every introduced kana (96–97%, which helps learning)? The simulator favours the second.
2. **The rules of っ and ー:** one introduction each, with no state of their own (the proposal), or items of the model with their own memory and a place on the chart?
3. **A slip in a fluency run:** no effect (the proposal), or an error as today?

## Reproduce

```bash
python3 -I packages/sim/scripts/p9-jmdict.py /tmp/p9         # the words written in kana (part 1)
WORDS=/tmp/p9/hiragana-kana.json pnpm --filter @nekotype/sim run p9-tasks   # tables 1–4
# PART=modes|truth|share|introduced for one table; SEEDS (50)
```
