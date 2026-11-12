# Metrics and statistics

Learning and typing are measured separately, and neither feeds the other (A39). Learning measures how fast and how reliably the learner recalls each kana; typing measures kana per minute (KPM) and per-kana accuracy on words and phrases. The keystroke-based WPM (keystrokes / 5) is removed (D12), and so are the speed tests on single kana (D25).

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

## Typing metrics

| Metric        | Formula                                                                                                                                                   | Shown in                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Token         | Every non-skip token counts as 1: kana, merged っX, standalone っ, ー, small kana                                                                         | —                            |
| Test time     | From the first keystroke to the end of the test                                                                                                           | Results                      |
| KPM           | Committed tokens / minutes. A token is committed when it is completed in every active NFA position. Committed tokens of an unfinished prompt are included | Live strip, results, history |
| Kana accuracy | Committed tokens without errors / committed tokens                                                                                                        | Live strip, results, history |
| Average KPM   | The mean KPM of the last 10 saved results with the same `personalBestKey` and `repeated` = false, before the current result (A43)                         | Results                      |
| Personal best | See "Data model"                                                                                                                                          | Results, history, `/stats`   |

The results screen compares KPM with the average and with the personal best, because typing speed often depends on touch typing rather than on knowing the kana. IPM, keystroke accuracy, the best streak, per-kana reaction times and the per-second chart are not part of the MVP.

## Test end

| Config        | Ends when                                                                        | `endReason` | Saved and counted as finished | Personal best |
| ------------- | -------------------------------------------------------------------------------- | ----------- | ----------------------------- | ------------- |
| Time          | The timer expires                                                                | `complete`  | Yes                           | Yes           |
| Count         | The end of the stream is reached (`isComplete`), so a single `n` ends a final ん | `complete`  | Yes                           | Yes           |
| Zen           | "Finish" button or Ctrl/Cmd+Enter                                                | `manual`    | Under the conditions below    | No            |
| Time or count | 5 seconds without input                                                          | `idle`      | Under the conditions below    | No            |
| Any           | The tab becomes hidden during a running test                                     | `hidden`    | Under the conditions below    | No            |
| Any           | Restart (Tab, Enter) or in-app navigation                                        | —           | No                            | No            |

**Conditions.** A test ended by `manual`, `idle` or `hidden` is saved only if at least one prompt is completed and `durationMs` is greater than 0. Otherwise it is discarded like a restart, and the application returns to a new test without a results screen.

**Completed prompts (ADR 050).** When a zen test is finished by hand or a time test reaches its deadline, every prompt before the one on screen is completed, including one that ends in ん typed with a single `n`: the display has moved on once the live conversion reaches the end of the prompt. The partly typed prompt on screen is not completed. The live counter shows this number, so it equals the count in the result. A count test ends as in the table above.

**Idle end (D24).**

- The idle time is the code constant `IDLE_END_MS` = 5000. Zen is exempt. The check starts at the first keystroke, so a test that has not started never ends.
- Any key handled by the input source resets it, including rejected and ignored keys and Esc. A modifier pressed alone does not, and neither does the repeat of a held key.
- `endedAt` is the time of the last keystroke, so the idle wait does not lower KPM. The same applies to `hidden`.
- The results screen states that the test ended because of no input.
- A keystroke only stores `lastKeyAt`. A single `Scheduler` timer re-arms itself for the remaining time when it fires, so the hot path creates no timers and triggers no renders.

**Hidden tab.** A hidden tab cannot receive input and the browser may discard the page, so the test ends at once and is written immediately. Closing the tab follows the same path on a best-effort basis.

**What a test writes (D23).** During a test all statistics stay in session memory. When the test is saved, its result, its kana statistics (attempts and errored attempts of every committed token, including those of an unfinished prompt) and its typing records are written in one IndexedDB transaction. When it is discarded, all of this is dropped and only the `started` counter is written. `weakFocus` therefore uses the statistics as they stood when the test began.

**Repeat (ADR 033).** The results screen offers "Repeat" next to "Next test". A repeat runs the prompts of the finished test in the same order with the same settings; when a time or zen test runs out of them, new prompts follow. Its result is saved and counted like any other, with `repeated` = true, except that it gives no personal best and stays out of the average and the KPM-per-test chart. History marks it in the mode column. The prompt list is held in memory until the results screen closes. Restart during a repeat starts an ordinary test with new prompts.

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
  startedAt: number;
  endedAt: number;
  durationMs: number;
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
  unlocked: Record<Track, KanaKey[]>; // in track order; starts with the vowels
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
- **Personal best** — maximum KPM per `personalBestKey`, for a test with `endReason` = `complete`, `repeated` = false and kana accuracy ≥ 80% (A3). The eligibility rule and the key function live in `shared/runtime`, so the client and the server apply the same rule.
- **`personalBestKey`** — `content|script|strictness|config`. `config` is `time:60`, `count:25` or `zen`. Example: `words|hiragana|learner|time:60`. `weakFocus` is not part of the key: it only makes a test harder.
- **Average** — `recent` holds, per key, the last 10 saved results with `repeated` = false, whatever their `endReason`. The average shown with a result is the mean of `recent` before that result is added; with no earlier result nothing is compared. The difference to the personal best is to the best before the test; a new best shows the badge and the difference to the previous best. The first eligible result of a key is a new best, with no previous best to compare with.
- **Typing record storage** is described in [Storage and sync](storage-sync.md). `celebratedPersonalBest` only records what was shown at completion.
- The raw keystroke log MUST NOT be persisted.

## Screens

- **Typing results:** KPM (large) with the difference to the average and to the personal best, kana accuracy, time, and up to 5 kana with errors in this test, most errors first, with spellings from `spellingsFor`; the list comes from the test's error log in memory. On a personal best: badge and the `content` cat. Actions: "Next test" (Enter) and "Repeat".
- **Session summary:** see [Learning](learning.md#session-summary).
- **Statistics (`/stats`):** learning — the daily median answer time of each track (lower is better), the current and best streak, mastered kana per track; typing — personal bests from `TypingRecords`, the KPM-per-test chart (repeats left out) and the paginated test history (see "History" in [Storage and sync](storage-sync.md)); started and finished counters per mode.
