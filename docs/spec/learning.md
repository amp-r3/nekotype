# Learning

Learning is the core of the product ([ADR 058](../adr/058-learning-first.md)): it teaches hiragana and katakana from zero on `/`. Kana unlock one at a time as the learner becomes confident with the ones already unlocked; a learning session mixes recall and recognition tasks and favours weak kana; Leitner boxes schedule reviews once a kana is confident. Learning uses the same engine and romaji buffer as typing, with a session of its own and no timer. Answer time, errors, confidence and the streak are defined in [Metrics](metrics.md#learning-metrics); the data model is in [Metrics](metrics.md#data-model).

## Tracks

- Hiragana and katakana are independent tracks (A7): an answer in one never changes the other. Either can be started at any time, and both can be learned in parallel. `settings.learn.track` selects the track shown on `/`.
- A track's kana are the entries of the selectable rows of the kana table (`allKanaRows` in `packages/engine`), in table order, which is also the unlock order: the basic rows (vowels, k, s, t, n, h, m, y, r, w_n), the dakuten and handakuten rows (g, z, d, b, p), the yōon rows (ky, sh, ch, ny, hy, my, ry, gy, j, by, py) and, in katakana only, the extended rows (ext_fa, ext_va, ext_wi, ext_ti, ext_che). Hiragana has 104 kana, katakana 125.
- っ, ー, small kana, ゐ and ゑ are not learned: they belong to no selectable row (see "Tokens" in [Input engine rules](engine.md)).

## Unlocking

- The five vowels of each track are unlocked from the start.
- The next kana unlocks when every unlocked kana of the track is confident. It is the first locked kana, in track order, whose dependencies are all confident; a kana whose dependencies are not is skipped and stays locked. A newly unlocked kana is not confident, so kana unlock one at a time (A36).
- **Dependencies** are derived from the kana table, not listed by hand:
  - a kana with a dakuten or handakuten depends on its base kana, found by Unicode canonical decomposition: が → か, ぱ → は, ヴ → ウ;
  - a kana of two characters (yōon, extended katakana) depends on the full-size form of each character: きゃ → き, や; ファ → フ, ア; ヴァ → ヴ, ア.

  In the current table this changes the order in one row: ヴァ and ヴィ come before ヴ in `ext_va`, so ヴ unlocks first and they follow once it is confident.

- Unlocking is evaluated after every answer and whenever the learning state is loaded or merged with a sync snapshot. The unlocked set never shrinks: a kana that loses its confidence stays unlocked and holds back the next unlock until it is confident again.

## Learning session

"Continue" starts a learning session of the selected track. It is always available.

- A session has `SESSION_TASKS` = 25 tasks.
- **Introduction.** Each unlocked kana that has not been introduced gets an introduction task: at the start of the session, in track order, or as the next task when the kana unlocks during the session. The kana and its romaji (`canonicalFor`) are shown large; the user types the romaji once with a ghost hint. An introduction is not an answer: nothing is timed and errors are not recorded. It creates the kana's `LearnEntry` in box 0 and is one of the session's tasks.
- **Other tasks** take an introduced, unlocked kana and a task type:
  1. The kana of the previous task is left out when another kana is available.
  2. Kana with fewer than 10 recall answers are **in focus**. The task takes a kana in focus with probability `FOCUS_SHARE` = 0.5 when there are kana both in and out of focus, with probability 1 when every candidate is in focus, and 0 when none is (A40). Kana in focus are equally likely; a kana out of focus is chosen with probability proportional to its weight.
  3. The **weight** of a kana out of focus is `1 + 4 × min(1, slow + err)`, with `slow = clamp((m − T) / T, 0, 1)` and `err = clamp((1 − a) / 0.5, 0, 1)`, where `m` is the median answer time and `a` the accuracy of its last 10 recall answers, and `T` is the target answer time. A confident kana without errors weighs 1; a kana twice as slow as the target, or wrong in half its answers, weighs 5.
  4. The task is a recognition task with probability `RECOGNITION_SHARE` = 1/3, and a recall task otherwise.
- **Recall.** The kana is shown; the user types its romaji in the learning strictness (`settings.learn.strictness`, relaxed by default), with the romaji buffer as on the typing screen. A rejected key flashes the caret; Esc shows the romaji (`canonical`), and on a touch screen, which has no Esc, a "Show the romaji" button does the same; either counts as an error. The answer ends when the kana is typed in full.
- **Recognition.** The romaji (`canonicalFor`) is shown; the user picks the kana from 4 numbered options by click, tap or keys 1–4. A wrong choice is recorded in the kana's `mixups` and reveals the right option.
- **After an answer** the result stays on screen for `ANSWER_PAUSE_MS` = 400 and the next task follows. After a wrong recognition choice the next task waits for Enter, Space or a click, so the right option can be read. Keys pressed before the next task is shown are ignored.
- Random choices use the injected `Rng`, so a session is reproducible in tests.
- **Screen.** Every task is drawn by the design system's `KanaTask` ([Frontend](frontend.md#hot-path-d16), ADR 059): a session line with the session kind and progress (`learning · 7 of 25`, `review · 3 of 5`), the task, one reserved notice line and a line of key hints. There is no timer, and the answer time is not shown. The navigation and the footer are not rendered during a session; "Leave session" in the session line returns to the chart without a confirmation.
- The session ends after its last task with the summary. A session is not resumable (A30): leaving it early keeps every recorded answer, because the learning state is written after each answer ([Storage and sync](storage-sync.md)), but the summary, held in memory, is lost.

## Reviews

"Review (N)" starts a review session of the selected track: one recall task per due kana, oldest `dueAt` first, at most `REVIEW_TASKS` = 20. N is the number of due kana of the track; with N = 0 the action is unavailable. Reviews are recall only (A30): choosing from four options is too easy to move a kana up a box. A review answer is recorded like any recall answer, so it counts toward confidence, and it moves the kana's box (see "Boxes"). A kana that unlocks during a review session is introduced in the next learning session.

## Recognition options

Three distractors are picked in this order, skipping duplicates and any kana that fails the rule below:

1. at most one from the user's `mixups` for this kana, highest count first;
2. at most one from the visually-similar kana table in `packages/engine` (curated pairs such as さ/ち, ぬ/め, わ/ね/れ, シ/ツ, ソ/ン);
3. from the same row;
4. from the rest of the track, unlocked kana first, then in track order.

A distractor MUST be of the same script and MUST NOT share any accepted spelling with the correct answer in the current strictness (for example じ/ぢ, ず/づ, お/を in relaxed mode). Spellings come from `spellingsFor`. Option positions are shuffled with `Rng`.

## Boxes

| Box | Review interval | Entry condition                                       |
| --- | --------------- | ----------------------------------------------------- |
| 0   | —               | introduced, never confident                           |
| 1   | 1 day           | confident for the first time; or an error in a review |
| 2   | 3 days          | correct review from box 1                             |
| 3   | 7 days          | correct review from box 2                             |
| 4   | 14 days         | correct review from box 3                             |
| 5   | 30 days         | correct review from box 4                             |

- A kana in box 0 enters box 1 as soon as it is confident; this is checked whenever unlocking is.
- A **review** is a task in a review session. Only reviews move a kana from box 1 upward or send it back to box 1. Learning-session answers for a kana in box 1 or higher count toward its confidence but do not change its box, even when it is due.
- A correct review is a recall answer without errors. Its answer time counts toward confidence, not toward the box.
- An error in a review sends the kana back to box 1 and is one of its last 10 recall answers.
- A correct review from box 5 keeps the kana in box 5.
- **Due date:** `dueAt` is the start of the local calendar day that lies the box's interval after the day of the answer, so a daily review does not slip by the time of day. A late review has no penalty. A kana in box 0 has `dueAt` = 0. A kana is due when it is in box 1 or higher and `dueAt` has passed.
- Boxes do not gate unlocking: it depends on confidence alone (A36).

## `/` screen

- Track switch, "Mastered X of N", the current streak, "Continue" and "Review (N)". N is the number of the track's kana; X is the number of its mastered cells.
- **Kana chart** of the selected track, one cell per kana, laid out by rows as in the design system:

  | State     | Condition                           |
  | --------- | ----------------------------------- |
  | Locked    | not unlocked                        |
  | Learning  | unlocked, not confident, in any box |
  | Confident | confident, box 1–3                  |
  | Mastered  | confident, box 4 or 5               |

  A cell in box 1 or higher whose `dueAt` has passed also carries a due mark. A kana in box 4 or 5 that has lost its confidence shows as learning, because it holds back the next unlock.

- The state is not conveyed by colour alone: each state and the due mark have a marker that does not depend on colour, and the cell's tooltip and `aria-label` name them.
- The tooltip gives the median answer time and the accuracy of the last 10 recall answers ("n of 10" while there are fewer) and, from box 1, the next review date.
- Activating a cell (click, tap, Enter or Space) shows the kana's mixups, highest count first, and its recognition accuracy.
- Learning and review sessions count in the `learn` counters. The daily median and the best streak are on `/stats` ([Metrics](metrics.md#screens)).

## Session summary

Shown at the end of a learning or review session; a chunk of its own, like the results screen of typing:

- kana unlocked during the session;
- kana that became confident: not confident at the start, confident at the end;
- faster and slower kana: for each kana that had 10 recall answers at the start, the change in the median answer time of its last 10 recall answers from the start of the session to its end; changes of at least 100 ms are listed, at most 5 each way, largest first;
- confused kana: kana chosen instead of the right one in recognition, and kana with errors in recall.

"Continue" (Enter) starts another learning session; "To the table", the second action, returns to the chart. The navigation is shown again on the summary.

## Audio

From P6 the session plays the sound of the task's kana after every task, introductions included, through the injected `AudioProvider` ([Architecture](architecture.md)) while `settings.learn.sound` is on. A sound that fails to load or play is skipped and never delays the next task. Until P6 the provider plays nothing.

## Constants

`SESSION_TASKS` = 25, `REVIEW_TASKS` = 20, `FOCUS_SHARE` = 0.5, `RECOGNITION_SHARE` = 1/3, `ANSWER_PAUSE_MS` = 400 and the box intervals are code constants. The confidence thresholds are in [Metrics](metrics.md#learning-metrics); of them, only the target answer time is a setting.
