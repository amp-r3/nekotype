# Metrics and statistics

Learning measures how fast and how reliably the learner recalls each kana. The keystroke-based WPM (keystrokes / 5) is removed (D12), and so are the speed tests on single kana (D25).

## Learning metrics

| Metric                   | Definition                                                                                                                                                                                                                                 | Shown in                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Answer                   | A finished recall or recognition task ([Learning](learning.md)). An introduction is not an answer                                                                                                                                          | —                                |
| Error                    | In recall, a rejected keystroke or Esc; in recognition, a wrong choice. An answer with an error is wrong                                                                                                                                   | Summary                          |
| Typing interval          | The time between two consecutive accepted keystrokes of one recall answer with no rejected key and no Esc between them                                                                                                                     | —                                |
| K                        | The median of the last 50 typing intervals of the device; 200 ms while fewer than 20 are recorded                                                                                                                                          | —                                |
| Answer time, recall      | `max(t_first, t_last − (n − 1) × K)`, where `t_first` and `t_last` run from showing the task to its first and its last accepted keystroke, and `n` is the number of accepted keystrokes of the answer (A37)                                | Chart tooltip, summary, `/stats` |
| Answer time, recognition | From showing the task to the choice. Not recorded: confidence and the daily median use recall answers only (A38)                                                                                                                           | —                                |
| Median answer time       | The median of the answer times of a kana's last 10 recall answers. The median of an even count is the mean of the two middle values                                                                                                        | Chart tooltip, summary           |
| Accuracy                 | Correct answers / answers, over a kana's last 10 recall answers                                                                                                                                                                            | Chart tooltip                    |
| Confidence               | A kana is confident when it has 10 recall answers, their median answer time is at most the target (`settings.learn.targetMs`, 1500 ms by default) and their accuracy is at least 90%. Derived from the stored answers, never stored itself | Chart, unlocking                 |
| Recognition accuracy     | Correct choices / choices, over all recognition answers of a kana (decayed with its other counters)                                                                                                                                        | Cell details                     |
| Streak                   | Consecutive local calendar days with at least one answer in a learning or review session                                                                                                                                                   | `/`, `/stats`                    |
| Daily median             | The median answer time of all recall answers of a track on one local day                                                                                                                                                                   | `/stats`                         |

**Answer time (A37).** The first key shows only that the consonant was recognised (き and け both start with `k`), while the time to the last key includes typing speed, so し (`shi`) would always be slower than あ (`a`). Subtracting `(n − 1) × K` takes out the typing of the letters after the first, and the floor `t_first` keeps the answer time of a fast typist from dropping below the time of the first key. With K = 200 ms: あ typed at 800 ms gives 800; し typed at 800, 1000 and 1200 ms gives 800; き typed at 300 and 1100 ms gives 900.

- K is computed before the answer's own intervals are added. An answer time is stored as computed and is not recomputed when K changes.
- K is kept per device and is not synced, because typing speed depends on the keyboard. The intervals live in `meta` ([Storage and sync](storage-sync.md)).
- Answer times are capped at `ANSWER_TIME_CAP_MS` = 10,000 when they are recorded.
- If the tab is hidden while a task is shown, the task starts over when the tab is visible again: its input is cleared and its times restart. An error made before stays.
- Keys pressed before a task is shown are ignored.

**Local day.** A local calendar day is the number of days from 1970-01-01 to the date in the device's time zone at the moment of the answer. Due dates ([Learning](learning.md), "Boxes") use the same calendar.

**Streak (A41).** A day is active when it has at least one answer in a learning or review session; an introduction alone or a typing test does not make a day active. The current streak counts the consecutive active days ending today, or ending yesterday while today has no answer yet; otherwise it is 0, so one missed day resets it. The best streak is the longest run of active days. Both are derived from the stored runs of active days.

**Daily median (A42).** Recall answer times are counted per track and local day in buckets of 100 ms: bucket `i` holds times from `100 × i` to `100 × i + 99` ms, and the cap puts longer times in bucket 100. The day's median is the midpoint (`100 × i + 50` ms) of the bucket that holds the ⌈n / 2⌉-th shortest answer time of the day. Days more than 365 days before the newest day of the track are dropped.

**What learning writes.** Every answer updates the kana's recent recall answers, its learning counters and mixups, its box in a review, the runs of active days, the day's buckets and the unlocked kana. These changes are written to IndexedDB after each answer, outside the keystroke handler. A learning session changes no typing statistic, and a typing test changes no learning state.

## Data model

```ts
type Mode = 'typing' | 'learn';
type Track = 'hiragana' | 'katakana';

// Typing

type KanaStat = {
  attempts: number; // committed tokens of this kana in saved typing tests
  erroredAttempts: number; // of which errored = true
};

type TestResult = {
  id: string; // UUID v7, generated on the client
  content: 'words' | 'phrases';
  script: 'hiragana' | 'katakana' | 'both';
  strictness: 'learner' | 'ime'; // code identifier kept; UI label "Relaxed"
  config: { kind: 'time'; seconds: number } | { kind: 'count'; prompts: number } | { kind: 'zen' };
  endReason: 'complete' | 'manual' | 'idle' | 'hidden';
  repeated: boolean; // started with "Repeat"
  startedAt: number; // whole milliseconds, like endedAt and durationMs
  endedAt: number;
  durationMs: number; // endedAt − startedAt; KPM is computed from the time as measured, before rounding
  tokens: number;
  erroredTokens: number;
  items: number; // completed prompts
  keystrokes: number;
  rejectedKeystrokes: number;
  assisted: number; // hints (Esc)
  kpm: number;
  kanaAccuracy: number;
  celebratedPersonalBest: boolean; // a personal best was shown on this device at completion
  contentVersion: string;
  appVersion: string;
};

type TypingRecords = Record<
  string /* personalBestKey(), see below */,
  {
    best: { kpm: number; resultId: string } | null; // null until a result is eligible
    recent: { resultId: string; endedAt: number; kpm: number }[]; // the last 10 results counted in the average, oldest first
  }
>;

// Learning

type RecallAnswer = {
  at: number; // time of the answer, Unix ms; identifies the answer in a merge
  ms: number; // answer time
  ok: boolean; // no error
};

type LearnEntry = {
  box: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: number; // 0 in box 0
  updatedAt: number;
};

type LearnStat = {
  recognitions: number; // recognition answers
  recognitionErrors: number; // of which wrong
  mixups: Record<KanaKey, number>; // kana chosen instead of this one → count
};

type LearnState = {
  unlocked: Record<Track, KanaKey[]>; // in track order on the client, sorted by key on the server; starts with the vowels
  entries: Record<KanaKey, LearnEntry>; // introduced kana
  recent: Record<KanaKey, RecallAnswer[]>; // the last 10 recall answers, oldest first
  stats: Record<KanaKey, LearnStat>;
  activeDays: [first: number, last: number][]; // runs of consecutive active local days; ascending, never overlapping or adjacent
  recallBuckets: Record<Track, Record<string /* local day */, Record<string /* bucket */, number>>>;
};

// started: a typing test on its first keystroke, a learning or review session on its first task;
// finished: a typing test per "Test end", a session that reached its summary
type Counters = { started: Record<Mode, number>; finished: Record<Mode, number> };
```

- **Decay:** when a kana's typing `attempts` exceeds 200, both its counters are halved and rounded down. When its learning `recognitions` exceeds 200, `recognitions`, `recognitionErrors` and every entry of `mixups` are halved and rounded down; map entries that reach 0 are removed. The same function runs on the client and on the server (see [Storage and sync](storage-sync.md)).
- **Statistic keys:** a merged っX is recorded under the `KanaKey` of the following kana, as in the baseline. A standalone っ and ー have no `KanaKey`: they count in `tokens` and `erroredTokens` but not in `KanaStat`.
- **Weakness** (typing): `weakness = (erroredAttempts + 1) / (attempts + 2)`; weight `1 + 4 × weakness`, bounded to 1–5. A word or phrase weighs the mean of its kana weights via `computeItemWeight` (D20). The weights serve `weakFocus` only.
- **Personal best** — maximum KPM per `personalBestKey`, for a test with `endReason` = `complete`, `repeated` = false and kana accuracy ≥ 80% (A3). With equal KPM the result with the smaller id is the best, so the best does not depend on the order in which results are applied (ADR 085); the "new best" of the results screen stays strictly higher than the best before. The eligibility rule and the key function live in `shared/runtime`, so the client and the server apply the same rule.
- **`personalBestKey`** — `content|script|strictness|config`. `config` is `time:60`, `count:25` or `zen`. Example: `words|hiragana|learner|time:60`. `weakFocus` is not part of the key: it only makes a test harder.
- **Average** — `recent` holds, per key, the last 10 saved results with `repeated` = false, whatever their `endReason`. The average shown with a result is the mean of `recent` before that result is added; with no earlier result nothing is compared. The difference to the personal best is to the best before the test; a new best shows the badge and the difference to the previous best. The first eligible result of a key is a new best, with no previous best to compare with.
- **Typing record storage** is described in [Storage and sync](storage-sync.md). `celebratedPersonalBest` only records what was shown at completion.
- The raw keystroke log MUST NOT be persisted.

## Screens

- **Session summary:** see [Learning](learning.md#session-summary).
- **Statistics (`/stats`, ADR 076):** one section at a time, `learning` or `typing`; the section with data opens first, learning when both have data; the section is kept in the URL hash (`/stats#learning`, `/stats#typing`), and a valid hash wins on load. A section without data shows a title, one line and one action instead of zeros; a guest without any data sees the empty state.
  - **Learning:** the current and best streak; mastered kana of each track; activity by day; the answer time of one track; the count of started and finished learning sessions.
    - _Activity by day:_ a calendar grid of 12 to 26 weeks (at most 13 below 640 px), as many as there is history. A day's fill is its number of recall answers of both tracks, the sum of the day's buckets in `recallBuckets`, in five steps: 1–9, 10–24, 25–49, 50–99, 100 and more. A day in `activeDays` without a recall answer is drawn at the first step. A day with a finished typing test (`endedAt`) carries a mark. The two are never added into one number (A39).
    - _Answer time:_ one bar per local day from the day's buckets: the bar runs from the bucket of the ⌈n / 4⌉-th to the bucket of the ⌈3n / 4⌉-th shortest answer time, with a tick at the daily median. With more than 45 days on the axis the buckets of a week (Monday to Sunday) are added up and drawn as one bar. The period is 7 days, 30 days (default) or all. The target answer time is a line; lower is better. The track switch changes only this chart and is shown only when both tracks have answers.
  - **Typing:** filters, then what they change, then the figures of all time.
    - _Filters:_ the mode — one `personalBestKey` out of those that have a saved result, most results first, or all modes; at start, the mode of the latest result. The period — 7 days, 30 days (default) or all saved results on the device. "With repeats" — off by default. A filter reads every local result, not only the latest page of the history.
    - _Figures of the selection:_ the number of tests; kana accuracy (median); for one mode also the median and the highest KPM of the results with `repeated` = false.
    - _Chart:_ one mark per result at `endedAt`. Metrics, one at a time: KPM; kana accuracy; rejected keys, `rejectedKeystrokes / keystrokes`; hints, `assisted`. "One mode" means the selection holds results of one mode only, whatever the mode filter says. For one mode and at least five results, a line starts at the fourth result and goes through the median of the last 10 results of the selection up to each result, and a band from their first to their third quartile (quartiles by linear interpolation). The result in `TypingRecords.best` of the mode is marked; a repeat is a hollow mark. Fewer than five results: no time axis and no line, the results in order with their values and dates. The y axis follows the data: KPM is not forced to start at 0; accuracy ends at 100% and starts at 90% or lower; rejected keys and hints start at 0.
    - _History:_ the results of the selection, newest first, in pages (see "History" in [Storage and sync](storage-sync.md)).
    - _All time_ (the filters do not apply): personal bests from `TypingRecords`; weak kana — the kana table of a script filled by `erroredAttempts / attempts` of each kana's `KanaStat` in five steps (over 0, 3, 7, 12 and 20%), a kana without attempts left empty; the count of started and finished typing tests.
  - Every value on a chart or a map is also in a tooltip and an accessible name; the chart, the map and the kana table are reached and walked with the keyboard.
