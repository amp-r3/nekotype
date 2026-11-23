# Learning

Learning is the core of the product ([ADR 058](../adr/058-learning-first.md)): it teaches hiragana and katakana from zero on `/`. A knowledge model ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md)) decides what each task of a session is: it introduces new kana, brings learning kana back after a few minutes and reviews learned kana before they are forgotten. A session mixes recall and recognition tasks. Learning uses the input engine and a romaji buffer of its own, with a session and no timer. Answer time, errors, grades and the streak are defined in [Metrics](metrics.md#learning-metrics); the data model is in [Metrics](metrics.md#data-model).

## Tracks

- Hiragana and katakana are separate tracks, each with items of its own (A7, amended by [ADR 099](../adr/099-learning-home-methods-and-phases-after-p6.md)): an answer in one does not change the memory of the other. Either can be started at any time. `settings.learn.track` selects the track shown on `/` and the one new kana come from; a session reviews the due kana of both tracks ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 5).
- The model suggests katakana once the 46 basic hiragana are learned. In P7 the suggestion is a value of the model (`suggestKatakana`) that nothing shows yet; P8 shows it.
- A track's kana are the entries of the selectable rows of the kana table (`allKanaRows` in `packages/engine`), in table order, which is also the order of introduction: the basic rows (vowels, k, s, t, n, h, m, y, r, w_n), the dakuten and handakuten rows (g, z, d, b, p), the yōon rows (ky, sh, ch, ny, hy, my, ry, gy, j, by, py) and, in katakana only, the extended rows (ext_fa, ext_va, ext_wi, ext_ti, ext_che). Hiragana has 104 kana, katakana 125.
- っ, ー, small kana, ゐ and ゑ are not learned: they belong to no selectable row (see "Tokens" in [Input engine rules](engine.md)).

## Unlocking

- The planner introduces a new kana when fewer than `LEARN_MAX` = 4 kana are learning (fewer under pressure, see "Memory") and every kana it is built from is learned. It takes the first such kana of the selected track in track order; once both tracks have an introduced kana, it takes the first of the other track when that track is more than `TRACK_LAG` = 10 introduced kana behind. Nothing is unlocked in advance: a kana the planner has not introduced is locked.
- **Dependencies** are derived from the kana table, not listed by hand:
  - a kana with a dakuten or handakuten depends on its base kana, found by Unicode canonical decomposition: が → か, ぱ → は, ヴ → ウ;
  - a kana of two characters (yōon, extended katakana) depends on the full-size form of each character: きゃ → き, や; ファ → フ, ア; ヴァ → ヴ, ア.

  In the current table this changes the order in one row: ヴァ and ヴィ come before ヴ in `ext_va`, so ヴ is introduced first and they follow once it is learned.

- An introduced kana never goes back to locked: a kana that is forgotten returns to learning and is trained again.

## Learning session

"Continue" starts a learning session. It is always available. There is one kind of session: reviews, learning steps and introductions mix in it ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 2).

- A session has `SESSION_TASKS` = 30 tasks and ends early, with its summary, when the planner has nothing to offer. The session writes a `start` event when it begins and an `end` event when it reaches its summary; leaving it early writes no `end`.
- **The planner chooses each task when it is shown**, from the model's state: the due kana with the lowest predicted recall (a recall); a learning kana whose step has passed, the one waiting longest first; an introduction; a learning kana whose step has not passed. The kana of the previous task is left out when another is available. A task on a learning kana is a recognition task with probability `RECOGNITION_SHARE` = 0.25 and a recall task otherwise; a review is always recall. Random choices use the injected `Rng`, so a session is reproducible in tests.
- **Introduction.** The kana and its displayed romaji (see "Displayed romaji") are shown large; the user types that romaji once with a ghost hint. Only the shown spelling is accepted: another spelling of the kana is a rejected key, which flashes the caret and is not recorded (ADR 062). An introduction is not an answer: nothing is timed and errors are not recorded. It is an `intro` event of the log and puts the kana in learning.
- **Recall.** The kana is shown; the user types its romaji in the learning strictness (`settings.learn.strictness`, relaxed by default), with the romaji buffer next to the kana. A rejected key flashes the caret; Esc shows the displayed romaji, and on a touch screen, which has no Esc, a "Show the romaji" button does the same; either counts as an error. The answer ends when the kana is typed in full. The wrong answer given is the kana that the typed romaji matched: the accepted prefix plus the first rejected key, when that is exactly one spelling of exactly one kana of the track in the strictness; otherwise none (Esc alone gives none).
- **Recognition.** The displayed romaji is shown; the user picks the kana from 4 numbered options by click, tap or keys 1–4. A wrong choice is recorded as the wrong answer given and reveals the right option. The time from showing the task to the choice is recorded.
- **Recording is deferred.** The key handler of a task finishes its view (the buffer, the caret, the hold timer, the sound) and does nothing else; the record is made by a timer a moment later, before the next task is chosen. No fold, grade or IndexedDB call runs in a keystroke handler ([Frontend](frontend.md#hot-path-d16)). An answer recorded is in the log whatever the learner does next, including leaving the session.
- **After an answer** the result stays on screen for `ANSWER_PAUSE_MS` = 400 and the next task follows. After a wrong recognition choice the next task waits for Enter, Space or a click, so the right option can be read. Keys pressed before the next task is shown are ignored.
- **Displayed romaji.** Wherever learning shows a kana's romaji (the introduction, the recognition prompt, the romaji revealed by Esc, the chart's tooltip and details), it is `canonicalFor`, except ん and ン, shown as `n`: one `n` completes them at the end of a task, so `nn` would teach a keystroke the learner does not need (ADR 062). Recall accepts every spelling of the learning strictness.
- **Screen.** Every task is drawn by the design system's `KanaTask` ([Frontend](frontend.md#hot-path-d16), ADR 059): a session line with the progress (`learning · 7 of 30`), the task, one reserved notice line and a line of key hints. There is no timer, and the answer time is not shown. The navigation and the footer are not rendered during a session; "Leave session" in the session line returns to the chart without a confirmation.
- The session ends after its last task with the summary. A session is not resumable (A30): leaving it early keeps every recorded answer, because each answer is in the log, but the summary, held in memory, is lost.

## Memory and phases

Every introduced kana has a phase and a memory ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), points 1–2); the state is a fold of the log, never stored.

- **Learning.** A kana comes back 30 s after its last answer; the step doubles after each correct recall (30 s, 1, 2, 4, 8 min). It is learned after 5 correct recalls in a row (`GRADUATE`); an error sets the count to 0, a correct recognition keeps it.
- **Learned.** A learned kana is due when its predicted recall would fall below the requested retention (`RETENTION` = 0.90) by the expected start of the next session: now plus the median of the learner's last 10 gaps of over an hour between two answers, or 12 hours until there is one. A failed review puts the kana back in learning.
- **Mastered** is a learned kana whose stability is at least 21 days (A52).
- **Pressure.** A moving average of the outcomes of reviews (rate 0.05, starting at 0.90) below 0.90 raises the requested retention towards 0.98, lowers the number of kana learning at once from 4 towards 1 and adds up to 2 recalls before a kana is learned.
- A review is a recall; a late review has no penalty. A learned kana is never reviewed on a calendar schedule: the model's predicted recall decides.

## Recognition options

Three distractors are picked in this order, skipping duplicates and any kana that fails the rule below:

1. at most one from the kana that were given instead of this one (its confusions, from the log), highest count first;
2. at most one from the visually-similar kana table in `packages/engine` (curated pairs such as さ/ち, ぬ/め, わ/ね/れ, シ/ツ, ソ/ン);
3. from the same row;
4. from the rest of the track, introduced kana first, then in track order.

A distractor MUST be of the same script and MUST NOT share any accepted spelling with the correct answer in the current strictness (for example じ/ぢ, ず/づ, お/を in relaxed mode). Spellings come from `spellingsFor`. Option positions are shuffled with `Rng`.

## `/` screen

- Track switch, one primary "Continue", and the progress line: "mastered X of N" (N is the number of the selected track's kana, X its mastered kana), the current streak and, when there is any, "due: n" (n is the number of due kana of both tracks, which is what "Continue" reviews; the part is hidden at 0). A first-visit line stays until the first answer.
- **Kana chart** of the selected track, one cell per kana, laid out by rows as in the design system:

  | State    | Condition                          |
  | -------- | ---------------------------------- |
  | Locked   | not introduced                     |
  | Learning | introduced, learning               |
  | Learned  | learned, stability under 21 days   |
  | Mastered | learned, stability 21 days or more |

  A due kana (learned or mastered, due by the model) also carries a due mark; a learning kana never does. The locked kana that opens next is named in its tooltip.

- The state is not conveyed by colour alone: each state and the due mark have a marker that does not depend on colour, and the cell's tooltip and `aria-label` name them.
- The tooltip gives the median answer time and the accuracy of the last 10 recall answers ("n of 10" while there are fewer) and, for a learned or mastered kana, the date its predicted recall reaches 0.90 or that the review is due.
- Activating a cell of an introduced kana (click, tap, Enter or Space) opens a details panel under its row with the tooltip's lines, the kana's confusions, highest count first, and its recognition accuracy (ADR 062). A locked cell has no panel. The tooltip is not shown on a cell whose panel is open.
- Sessions count in the `learn` counters, read from the log. The daily median and the best streak are on `/stats` ([Metrics](metrics.md#screens)).

## Session summary

Shown at the end of a learning session; a chunk of its own. It lists kana of both tracks:

- kana introduced during the session;
- kana learned during the session: locked or learning at the start, learned or mastered at the end;
- faster and slower kana: for each kana that had 10 recall answers at the start, the change in the median answer time of its last 10 recall answers from the start of the session to its end; changes of at least 100 ms are listed, at most 5 each way, largest first;
- confused kana: kana chosen instead of the right one in recognition, and kana with errors in recall.

"Continue" (Enter) starts another learning session; "To the table", the second action, returns to the chart. The navigation is shown again on the summary.

## Audio

From P10 the session plays the sound of the task's kana after every task, introductions included, through the injected `AudioProvider` ([Architecture](architecture.md)) while `settings.learn.sound` is on. A sound that fails to load or play is skipped and never delays the next task. Until P10 the provider plays nothing.

## Constants

`SESSION_TASKS` = 30, `RECOGNITION_SHARE` = 0.25, `LEARN_MAX` = 4, `GRADUATE` = 5, `RETENTION` = 0.90, `TRACK_LAG` = 10, `MASTERED_STABILITY_DAYS` = 21 and the others of `packages/model/src/constants.ts` are code constants ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md)); `ANSWER_PAUSE_MS` = 400 is the session's. The target answer time, which separates a good grade from a hard one ([Metrics](metrics.md#learning-metrics)), is the only setting.
