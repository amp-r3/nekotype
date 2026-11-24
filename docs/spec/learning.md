# Learning

Learning is the core of the product ([ADR 058](../adr/058-learning-first.md)): it teaches hiragana and katakana from zero on `/`. A knowledge model ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md)) decides what each task of a session is: it introduces new kana, brings learning kana back after a few minutes and reviews learned kana before they are forgotten. A session mixes recall and recognition tasks. Learning uses the input engine and a romaji buffer of its own, with a session and no timer. Answer time, errors, grades and the streak are defined in [Metrics](metrics.md#learning-metrics); the data model is in [Metrics](metrics.md#data-model).

## Tracks

- Hiragana and katakana are separate tracks, each with items of its own (A7, amended by [ADR 099](../adr/099-learning-home-methods-and-phases-after-p6.md)): an answer in one does not change the memory of the other. Either can be started at any time. `settings.learn.track` selects the track shown on `/` and the one new kana come from; a session reviews the due kana of both tracks ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 5).
- The model suggests katakana once the 46 basic hiragana are learned. In P7 the suggestion is a value of the model (`suggestKatakana`) that nothing shows yet; P8 shows it.
- A track's kana are the entries of the selectable rows of the kana table (`allKanaRows` in `packages/engine`), in table order, which is also the order of introduction: the basic rows (vowels, k, s, t, n, h, m, y, r, w_n), the dakuten and handakuten rows (g, z, d, b, p), the yōon rows (ky, sh, ch, ny, hy, my, ry, gy, j, by, py) and, in katakana only, the extended rows (ext_fa, ext_va, ext_wi, ext_ti, ext_che). Hiragana has 104 kana, katakana 125.
- っ, ー, small kana, ゐ and ゑ are not learned: they belong to no selectable row (see "Tokens" in [Input engine rules](engine.md)).

## Unlocking

- The planner introduces a new kana when fewer than `LEARN_MAX` = 5 kana are learning (fewer under pressure, see "Memory"; [ADR 109](../adr/109-five-kana-learning-at-once.md)) and every kana it is built from is learned, so a first session introduces the five vowels. It takes the first such kana of the selected track in track order; once both tracks have an introduced kana, it takes the first of the other track when that track is more than `TRACK_LAG` = 10 introduced kana behind. Nothing is unlocked in advance: a kana the planner has not introduced is locked.
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
- **Pressure.** A moving average of the outcomes of reviews (rate 0.05, starting at 0.90) below 0.90 raises the requested retention towards 0.98, lowers the number of kana learning at once from 5 towards 1 (`max(1, round(5 − 4p))`) and adds up to 2 recalls before a kana is learned.
- A review is a recall; a late review has no penalty. A learned kana is never reviewed on a calendar schedule: the model's predicted recall decides.

## Recognition options

Three distractors are picked in this order, skipping duplicates and any kana that fails the rule below:

1. at most one from the kana that were given instead of this one (its confusions, from the log), highest count first;
2. at most one from the visually-similar kana table in `packages/engine` (curated pairs such as さ/ち, ぬ/め, わ/ね/れ, シ/ツ, ソ/ン);
3. from the same row;
4. from the rest of the track, introduced kana first, then in track order.

A distractor MUST be of the same script and MUST NOT share any accepted spelling with the correct answer in the current strictness (for example じ/ぢ, ず/づ, お/を in relaxed mode). Spellings come from `spellingsFor`. Option positions are shuffled with `Rng`.

## `/` screen

The learning home: it answers "what now". No kana table is here; it is on `/progress` ([Metrics](metrics.md#screens)). On a desktop the action and "since the last session" stand on the left and the path on the right; below 640px they stack in the order action, path, since the last session.

- **Top.** The track switch (the choice is saved and everything below follows it) and, from the first answer on, the current streak, shared by both tracks (`streak: 6 days`; a zero shows as it is).
- **The action.** The _reason_ for Continue, one line, then "continue" (Enter) with the outline of the session. The reason is a label of what the session does first, read from the planner's first task, so it never promises what the session does not do:

  | Reason     | When                                                               | Wording                                                                             |
  | ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
  | `review`   | the first task is a review: kana of either track are due           | `5 kana are due for review`                                                         |
  | `weak`     | a learning kana first, and some learning kana are weak             | `practise 1 weak kana: ぬ`                                                          |
  | `learning` | a learning kana first, none weak                                   | `finish learning 2 kana`                                                            |
  | `new`      | the first task introduces a kana; the row may be the other track's | `next: the m row`; the first visit `next: the vowels`; `next: the vowels, katakana` |
  | `none`     | the planner offers nothing                                         | `nothing to review now`                                                             |

  A kana is weak while it is learning and either has at least 5 recall answers among the last 10 with an accuracy under 0.8, or confusions summing to at least 2; the weak kana are listed after the reason. The reason is planned again when the learn view or the track changes, when the tab becomes visible and every minute while the home is shown; it changes the screen only when it changed.

- **The outline** after "continue": `about 30 tasks: 6 reviews, 2 new kana`, computed after the first paint with a fixed seed; a part at 0 is left out, and learning tasks count in the total only. Not shown with nothing to do.
- **Nothing to do** (`none`): the reason and, under it, `next review: tomorrow at 9:15` (`at 18:40` today, `12 Nov, 9:15` later); there is no "continue", and neither a click nor Enter starts a session. One kind of session exists, and it would end with no task.
- **The katakana suggestion.** While hiragana is selected, the 46 basic hiragana are learned and no katakana kana is introduced: the line `The basic hiragana are learned. You can start katakana.` with `start katakana`, over the reason; with nothing to do it comes after the reason and its button is the primary action. It sets the track to katakana, cannot be dismissed and ends once a katakana kana is introduced.
- **The path** of the selected track: the forecast line, then the blocks (basic, voiced, combinations, and extended for katakana) as buttons with their name, `introduced/total` and a tick per row; the open block, the current one by default, lists its rows as columns with their kana. A row is _done_ when every kana of it is introduced, _current_ when it is the first row not done (the row the forecast names), _locked_ otherwise, also when it holds a kana introduced out of order.
- **The forecast line** under the path's title is the [Forecast](#forecast) of the selected track: a range (`the whole m row opens in 2–4 sessions`), one number with "about" when low equals high, a rough-estimate note while the basis is the model or the learner's habits, `no forecast for the m row yet` when over 60 sessions, `every hiragana is open` when the track is complete. While it computes the line keeps its height.
- **Since the last session** ([What got stronger](#what-got-stronger)): the kana as table cells in the state they have now, grouped `new`, `learned`, `mastered`, `stronger` (a kana is in one group; one that was locked is new); each is a button that opens the kana's details. `no changes since the last session` when none; not shown on the first visit (no answer yet).
- A reserved status line under the action: loading, storage unavailable, a load error with retry, a sign-in notice. Until the progress has loaded "continue" is disabled and the numbers are not shown.
- "Continue" takes the focus when the screen is ready (with nothing to do, the katakana suggestion does if it is shown), so Enter starts the session. The reason, the forecast, the path and the cells are never computed in a key handler of a task, and nothing of them runs during a session.
- Sessions count in the `learn` counters, read from the log. The daily median and the best streak are on `/progress`.

## Forecast

The home and the session summary show how many sessions the next row of the selected track needs: `low`, `median` and `high` (the 10th, 50th and 90th percentile of the model's plays), for the first row of the track with a kana not introduced. Its states:

- `ready`: a range of 1 to 60 sessions, with a `basis`: `model` while the learner has fewer than 20 learning answers (the model predicts the answers), `habits` from 20 answers on (the learner's own shares), `corrected` once three forecasts have settled;
- `beyond`: the median is over 60 sessions; the row has no forecast;
- `complete`: every kana of the track is introduced.

It is computed outside the first render and outside any key handler, with a fixed seed, so the same log gives the same numbers; it is not computed during a session.

**The history.** The first forecast shown for a row on a local day is kept on the device with the number of sessions started before it. It settles once every kana of its row is introduced: it took the number of the session that introduced the row's last kana minus the sessions before it. A result below 1 (a pull brought sessions older than the forecast) drops the record. From the third settled forecast, the forecast is multiplied by the median ratio of actual to forecast of the last ten. The history is never synced and is cleared with the log ([Storage](storage-sync.md)).

## What got stronger

The kana whose state rose, or that stayed learned or mastered with their stability at least doubled, since the last session started: the current view is compared with the state just before the last `start` of the log, of any device. Before the first session there is nothing to compare (`first`); after it, every kana the session introduced is listed.

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

`SESSION_TASKS` = 30, `RECOGNITION_SHARE` = 0.25, `LEARN_MAX` = 5, `GRADUATE` = 5, `RETENTION` = 0.90, `TRACK_LAG` = 10, `MASTERED_STABILITY_DAYS` = 21 and the others of `packages/model/src/constants.ts` are code constants ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md); `LEARN_MAX` by [ADR 109](../adr/109-five-kana-learning-at-once.md)); `ANSWER_PAUSE_MS` = 400 is the session's. The target answer time, which separates a good grade from a hard one ([Metrics](metrics.md#learning-metrics)), is the only setting.
