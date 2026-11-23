# Metrics and statistics

Learning measures how fast and how reliably the learner recalls each kana. Every answer is an event of the learning log ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md)); statistics and the model's state are folds of it. The keystroke-based WPM (keystrokes / 5) is removed (D12), and so are the speed tests on single kana (D25).

## Learning metrics

| Metric                   | Definition                                                                                                                                                                                                                                                                        | Shown in                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Answer                   | A finished task of any type: recall or recognition in P7, more types in later phases ([Learning](learning.md)). An introduction is not an answer. Each answer is an event with the task type, the kana, its outcome, its time, whether a hint was used and the wrong answer given | —                                |
| Error                    | In recall, a rejected keystroke or Esc; in recognition, a wrong choice. An answer with an error is wrong                                                                                                                                                                          | Summary                          |
| Typing interval          | The time between two consecutive accepted keystrokes of one recall answer with no rejected key and no Esc between them                                                                                                                                                            | —                                |
| K                        | The median of the last 50 typing intervals of the device; 200 ms while fewer than 20 are recorded                                                                                                                                                                                 | —                                |
| Answer time, recall      | `max(t_first, t_last − (n − 1) × K)`, where `t_first` and `t_last` run from showing the task to its first and its last accepted keystroke, and `n` is the number of accepted keystrokes of the answer (A37)                                                                       | Chart tooltip, summary, `/stats` |
| Answer time, other tasks | From showing the task to the answer. Recorded with the answer (A38 amended by A48); the daily median and the median answer time use recall answers only                                                                                                                           | —                                |
| Median answer time       | The median of the answer times of a kana's last 10 recall answers. The median of an even count is the mean of the two middle values                                                                                                                                               | Chart tooltip, summary           |
| Accuracy                 | Correct answers / answers, over a kana's last 10 recall answers                                                                                                                                                                                                                   | Chart tooltip                    |
| Grade                    | What an answer is worth to the model: wrong is "again"; a correct recall within the target time (`settings.learn.targetMs`, 1500 ms by default) is "good", a slower one "hard"; a correct recognition is "hard" (A48). Worked out when the log is folded, never stored            | Model                            |
| Recognition accuracy     | Correct choices / choices, over all recognition answers of a kana in the log                                                                                                                                                                                                      | Cell details                     |
| Streak                   | Consecutive local calendar days with at least one answer                                                                                                                                                                                                                          | `/`, `/stats`                    |
| Daily median             | The median answer time of all recall answers of a track on one local day                                                                                                                                                                                                          | `/stats`                         |

**Answer time (A37).** The first key shows only that the consonant was recognised (き and け both start with `k`), while the time to the last key includes typing speed, so し (`shi`) would always be slower than あ (`a`). Subtracting `(n − 1) × K` takes out the typing of the letters after the first, and the floor `t_first` keeps the answer time of a fast typist from dropping below the time of the first key. With K = 200 ms: あ typed at 800 ms gives 800; し typed at 800, 1000 and 1200 ms gives 800; き typed at 300 and 1100 ms gives 900.

- K is computed before the answer's own intervals are added. An answer time is stored as computed and is not recomputed when K changes.
- K is kept per device and is not synced, because typing speed depends on the keyboard. The intervals live in `meta` ([Storage and sync](storage-sync.md)).
- Answer times are capped at `ANSWER_TIME_CAP_MS` = 10,000 when they are recorded.
- If the tab is hidden while a task is shown, the task starts over when the tab is visible again: its input is cleared and its times restart. An error made before stays.
- Keys pressed before a task is shown are ignored.

**Local day.** A local calendar day is the number of days from 1970-01-01 to the date in the device's time zone at the moment of the answer. The day of an answer uses the time zone the device had when its session started (the `start` event carries it), so the days do not move when a device travels.

**Streak (A41).** A day is active when it has at least one answer; an introduction alone does not make a day active. The current streak counts the consecutive active days ending today, or ending yesterday while today has no answer yet; otherwise it is 0, so one missed day resets it. The best streak is the longest run of active days. Both are derived from the days of the log (the keys of `LogStats.days` with an answer).

**Daily median (A42, superseded in P7).** The fold keeps the recall answer times of each track and local day exactly, in fold order; nothing is bucketed and no day is dropped, however old. The day's median is the exact median of those times (the mean of the two middle times when there are an even number).

**What learning writes.** An introduction, an answer, the start and the end of a session are appended to the log in IndexedDB after the key handler, never inside it ([Learning](learning.md#learning-session)). Nothing derived from the log is written: the state is the fold of what is stored.

## Data model

The learning data is an append-only log of events ([ADR 100](../adr/100-knowledge-model-fsrs-planner-and-answer-log.md), point 7); the types are in `packages/shared/src/types.ts`:

```ts
type Track = 'hiragana' | 'katakana';

// Identity and order: `at` is the device clock (never below the device's previous event),
// `dev` the log device id, `n` 1, 2, 3, … per `dev`.
type EventId = { at: number; dev: string; n: number };

type LogEvent =
  | (EventId & { t: 'intro'; k: KanaKey })
  | (EventId & {
      t: 'answer';
      task: TaskKind; // 'recall' | 'recognition' now; more in later phases
      k: KanaKey;
      ok: boolean;
      ms: number; // answer time, integer, 0–10,000
      hint: boolean;
      wrong: KanaKey | null; // the option chosen, or the kana the typed romaji matched
      alt: KanaKey | null; // the other option of a two-option task
    })
  | (EventId & { t: 'start'; tz: number }) // the device's UTC offset in minutes
  | (EventId & { t: 'end' });
```

- **The state is a fold.** `foldLog` of `@nekotype/model` applies the events in order (time, then device id, then `n`) to an empty state and gives the memory of each kana, the learner's values and the statistics; it is never stored or synced. The screens read `describe(state, stats)`: each kana's state, due and next review time, last 10 recall answers, median, accuracy, recognition counts and confusions; the statistics hold the per-day answers and the counts of sessions started and finished.
- **Confusions** count, for each ordered pair (kana asked, kana given), the wrong answers; they replace the old `mixups`.
- The raw keystroke log MUST NOT be persisted: an event holds the outcome and the time, never the keys.

## Screens

- **Session summary:** see [Learning](learning.md#session-summary).
- **Statistics (`/stats`, ADR 076, ADR 093):** the learning progress, all of the screen: no section switch and no URL hash. With no answer and no started session the screen shows one empty state with an action to `/` instead of zeros. The page stands on four equal columns (two below 640 px), so the width of a block comes from the screen, never from the data (design decision 137).
  - **Streak and activity:** column 1 holds the current streak as the large number, the best streak and the count of active days in the last 30 days (a fixed window); columns 2–4 hold the activity map.
    - _Activity by day:_ a calendar grid that fills its width: as many weeks as fit at 16 px, at most 26, the cells growing to 28 px at most. The weeks before the first answer are empty cells, so the frame does not depend on the history. A day's fill is its number of recall answers of both tracks, the number of the day's recall answers, in five steps: 1–9, 10–24, 25–49, 50–99, 100 and more. A day with an answer and no recall answer is drawn at the first step. The days counted by the current streak carry a dot; today has a border.
  - **Totals:** four figures: mastered kana of hiragana and of katakana, learning sessions started, learning sessions finished.
  - **Answer time:** one bar per local day from the day's exact recall times: the bar runs from the ⌈n / 4⌉-th to the ⌈3n / 4⌉-th shortest answer time, with a tick at the exact median. With more than 45 days on the axis the times of a week (Monday to Sunday) are joined and drawn as one bar. The period is 7 days, 30 days (default) or all. The target answer time is a line; lower is better. The track switch changes only this chart and is shown only when both tracks have answers.
  - Every value on a chart or a map is also in a tooltip and an accessible name; the chart and the map are reached and walked with the keyboard.
