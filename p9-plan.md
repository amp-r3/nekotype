# P9 plan: learning methods and words

Working file of phase P9 ([phases.md](docs/spec/phases.md), item 10). It tells the executor of each pull request what to build, in which order, and which decisions are already made. It is not part of `docs/`: the last pull request of the phase moves it to `docs/archive/`.

- Written on 2026-11-27 against `main` at 8acf510 (PR 249 merged: part 3 of the P9 research and [ADR 118](docs/adr/118-the-p9-planner.md)). The research decided the scope, the grades and the planner in [ADR 116](docs/adr/116-words-written-in-kana-and-varied-tasks-in-p9.md), [ADR 117](docs/adr/117-grades-of-the-p9-task-types.md) and ADR 118; the maintainer answered this plan's four questions on the same day ([section 5](#5-answered-questions)).
- Where this plan and `docs/spec/` disagree, the spec wins until the pull request named here changes the spec. Every such change is listed in [section 3.10](#310-spec-changes) with its pull request.
- **Two kinds of content.** Section 3 holds the data, the rules and the computations as final contracts: types, names, files, keys and constants. An executor copies them and does not invent names. Everything that depends on how a screen looks is a brief for the design session ([section 4](#4-design-brief)): proposals, not decisions. The design export decides, and its decision numbers fill the brief's last column.
- **The screens follow the design export.** No code pull request starts before PR D is merged (ADR 116, point 7). PR D rewrites the cards of the pull requests that build screens (6, 7, 8, 10, 11, 12) against the export.
- **Decisions are final, and the code may force a deviation.** An executor builds what this plan says and decides nothing on its own. Where the code makes a contract impossible or clearly worse, it deviates by the rule of [section 8](#8-instructions-for-executor-agents), item 3, and records the deviation here and in its pull request.
- Sections: [status](#status), [goal and scope](#1-goal-and-scope), [what was checked](#2-what-was-checked), [decisions](#3-decisions), [design brief](#4-design-brief), [answered questions](#5-answered-questions), [manual steps](#6-maintainers-manual-steps), [pull requests](#7-pull-requests), [executor instructions](#8-instructions-for-executor-agents), [risks](#9-risks).

## Status

The executor of a pull request fills its row ([section 8](#8-instructions-for-executor-agents), item 11). Every row goes to `main`: P9 has no integration branch ([D30](#d30-no-integration-branch)).

| PR  | Branch                     | Status | Pull request |
| --- | -------------------------- | ------ | ------------ |
| D   | `docs/p9-design`           | —      | —            |
| 1   | `p9-01-words-content`      | —      | —            |
| 2   | `p9-02-log-format-4`       | —      | —            |
| 3   | `p9-03-engine-rule-errors` | —      | —            |
| 4   | `p9-04-grades`             | —      | —            |
| 5   | `p9-05-session-plan`       | —      | —            |
| 6   | `p9-06-session-screen`     | —      | —            |
| 7   | `p9-07-words`              | —      | —            |
| 8   | `p9-08-report`             | —      | —            |
| 9   | `p9-09-kanjivg`            | —      | —            |
| 12  | `p9-12-stroke-order`       | —      | —            |
| 10  | `p9-10-choice-tasks`       | —      | —            |
| 11  | `p9-11-fluency`            | —      | —            |
| 13  | `p9-13-close`              | —      | —            |

## 1. Goal and scope

**What the user gets.** A session that is no longer one kana after another:

- Every few tasks comes a real word written in kana. The learner types its romaji, each kana counts as a recall, and the English meaning appears after the answer, with a way to report a wrong word. A session may close with a word made of its own kana.
- Similar kana are trained against each other. A katakana is met next to its hiragana and, where they share one, the kanji both come from. Voiced and combined kana are built from their parts. A short run trains the slowest accurate kana for speed. "Find the error" and "hiragana or katakana?" come once in a while. The rules of っ and ー are taught before the first word that needs them, and again when the learner keeps missing them.
- After an error the screen shows what the learner's answer was next to the right kana, how the two differ, and that the kana comes back. A short round after the session brings back each kana answered wrong. One quick slip no longer sends a known kana back to learning.
- Every kana's details show its stroke order.
- The session screen as a whole is redrawn by a design session.

**In scope** ([phases.md](docs/spec/phases.md), P9; [ADR 099](docs/adr/099-learning-home-methods-and-phases-after-p6.md), point 5; ADRs 116–118):

- the design session in a workbench artifact and its export (M1, PR D);
- the content pipeline: the common words written in kana (ADR 116, point 2), and the stroke data and origin kanji from KanjiVG;
- the log of format 4, sync format 4 and IndexedDB schema 8 (ADR 117, point 6);
- the engine's rule errors (ADR 117, point 3);
- the fold's grades (ADR 117; ADR 118, point 5) and the session plan (ADR 118) in `@nekotype/model`, with `packages/sim` on the production plan;
- the session screen and every P9 task type, the report dialog on word tasks, the stroke order in the kana details, and the JMdict and KanjiVG credits on `/about` and in `NOTICE.md`;
- the spec, `README.md` and `docs/architecture/` for all of the above.

**What stays:**

- the memory model (FSRS-6), its constants, and every rule of [ADR 100](docs/adr/100-knowledge-model-fsrs-planner-and-answer-log.md) that ADRs 115–118 and this plan do not amend;
- the kana planner `nextTask`: its order, its share of recognition, and the 30 tasks of a session;
- the home, Progress and their insights: the outline and the forecast still play the kana planner alone ([D18](#d18-the-forecast-and-the-outline));
- the server's storage of the log as received;
- the hot-path rule (0 renders per keystroke, at most 1 on the answer), every budget limit and one dark theme;
- no score, record, timer or kana per minute ([ADR 093](docs/adr/093-learning-only-words-in-learning.md), point 1).

**Out of scope:**

- "Words you can read now" on `/` and in the summary (P12); words as items of the model and the vocabulary (P13).
- Phrases: their chunks stay out of the build.
- The carrier, a word in place of a recall (ADR 118, point 1).
- Sound (P10), the placement test and the mnemonics (P11), drawing on the screen (ADR 099).
- A change to a constant or a rule of the model beyond section 3: it needs a sim run and an ADR ([section 8](#8-instructions-for-executor-agents), rule 4c).
- IndexedDB migrations: a schema change still resets the local data ([ADR 061](docs/adr/061-schema-reset-before-release.md)).

## 2. What was checked

Checked on 2026-11-27 against the code on `main` at 8acf510.

| Item                    | Finding                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Budgets today           | `pnpm run build && pnpm run budget`: initial JS 30.73 of 35 KB gzip, initial CSS 7.75 of 10 KB, first load 99.66 KB. Lazy: session runtime 10.42 KB, model 8.44, Progress 7.00, sync 4.87, home panels 1.85, summary panel 1.47, insights 1.43, kana details dialog 1.30                                                                                                                         |
| Content in the build    | `check-budget.mjs` fails a build that holds a chunk whose source is under `content/` ("no content before P9"). The committed word chunks are the N5–N4 selection (`words-hiragana` 1,167, `words-katakana` 108, content version 098be8bfd536), and nothing imports them                                                                                                                          |
| The log's codec         | `packages/shared/src/log-codec.ts` holds the bounds of an event for the client and the server. An answer encodes as 9 fields; `task` is one of 10 kinds; `k` is a kana key or, for `word`, a word key. The server checks every batch with `isLogPage` and stores it as received; `readPullResponse` rejects a whole pull when one row fails. The server accepts only `v` = 3                     |
| What the session logs   | Recall: `ok` is false on any rejected key or Esc; `wrong` is the kana of the first error; `hint` is always false, so Esc cannot be told from a rejected key. Recognition: the option chosen. Every event is written in a deferred callback, never in the key handler (`pages/learn/model/session.ts`)                                                                                            |
| The fold                | A `word` answer with a kana key grades nothing; with a word key it is ADR 100's sketch, a hard review of each learned kana. The learning streak counts `recall` with `ok`; the review outcomes (`observed`) read `ok`. The paces cover `recall`, `build`, `fluency` and `dictation`. Every event moves the learner's clock (`noteTask`, `tasks`)                                                 |
| The planner             | `nextTask` gives an introduction, a recall or a recognition; the model has no notion of a session. The research's word cadence, closing word, round and slips are options of the simulator's own policy (`packages/sim/src/policies/production.ts`), not of the model                                                                                                                            |
| The engine              | A merged っX token carries the key of X (`matcher/compile.ts`), so a rejected key on it is charged to X. A standalone っ and ー have no key. `errorTarget` gives the token a rejected key is charged to, `committedTimings` the accepted keystrokes of each finished token, `spellingsFor` the spellings of a kana                                                                               |
| The task component      | `KanaTask` draws `introduction`, `recall` and `recognition`; its controller writes classes, text and transforms. Its styles are in the initial CSS (`app/styles/index.css`); `nk-caret` is also used by the home's path                                                                                                                                                                          |
| Strings                 | The session's strings (`learn.session.*`) are in the English core. The lazy dictionary parts are `progress`, `home`, `details`, `settings` and `about`                                                                                                                                                                                                                                           |
| Similar kana            | `similarPairs` of `packages/engine`: 23 hiragana pairs and 24 katakana pairs, 47 in all                                                                                                                                                                                                                                                                                                          |
| Reports                 | `POST /api/reports` with Turnstile is live ([ADR 092](docs/adr/092-report-dialog-turnstile-keys-by-host-and-fail-closed-secret.md)). The client dialog left with `/type` in P6 PR 1 (#182); its last version is in commit 753df9f (`apps/web/src/pages/trainer/`: the dialog, about 2 KB gzip, and `lib/turnstile.ts` with the site key by host). `shared/ui` has `select.tsx` and no `Textarea` |
| `/about`                | Only the terms of Nekotype; the sources section left in P6 (design decision 132)                                                                                                                                                                                                                                                                                                                 |
| Stroke data             | KanjiVG has one SVG per character, kana included, each stroke a centre-line path in writing order, under CC BY-SA 3.0 ([methods note](docs/research/2026-11-21-kana-learning-methods.md), section 7)                                                                                                                                                                                             |
| The selection of part 1 | `proposed` in `packages/sim/scripts/p9-jmdict.py` gives 1,077 hiragana and 828 katakana words from the pinned JMdict; the pipeline's parser (`packages/content/src/jmdict/`) does not read the `misc` and `pos` of a sense                                                                                                                                                                       |
| Storage                 | IndexedDB schema 7 (`shared/lib/idb/schema.ts`); sync format 3 (`packages/shared/src/sync-format.ts`)                                                                                                                                                                                                                                                                                            |
| Design export           | Decisions up to 158. P9 is drawn as places only (decision 152): a dashed box per task type, the place of the stroke order in the details, and a notice line after an error                                                                                                                                                                                                                       |
| Records                 | The last ADR is 118; the last design decision is 158                                                                                                                                                                                                                                                                                                                                             |

## 3. Decisions

Each decision fills a gap that ADRs 116–118 leave open, or carries one of their points into code. The maintainer answered four questions on 2026-11-27 ([section 5](#5-answered-questions)); everything else is decided here, with its reason. Paths are relative to the repository root.

### 3.1 Content

#### D1. Words written in kana

The pipeline selects the words by the rule of ADR 116, point 2, for both scripts. The JLPT lists no longer select words; they stay for the vocabulary filter of phrases.

- **The port.** `proposed` of `packages/sim/scripts/p9-jmdict.py` moves into `packages/content/src/words.ts` as `selectKanaWords(entries)`, applied to the pinned `JMdict.gz` of `sources.json`. The JMdict parser gains the `misc` and `pos` of each sense. The port must give exactly the readings of the script on the pinned file before the exclusion list: 1,077 hiragana and 828 katakana. The PR shows both counts.
- **The rule,** in the words of the script, written into [content.md](docs/spec/content.md), "Words", in place of steps 2–3 for words:
  1. **Written in kana:** the entry has no kanji, or its first sense is "usually written using kana alone" (`uk`).
  2. **Common:** the first reading of one script that is not search-only carries `news1`, `ichi1`, `spec1` or `spec2` (hiragana), or `ichi1`, `spec1` or `spec2` (katakana; `news1` gives no katakana entry, and `gai1` marks loanwords only).
  3. **Fit to show:** no sense is vulgar, rude or X-rated, derogatory or sensitive; the first sense is not archaic, obsolete, rare, dated or historical.
  4. **A word:** the first sense is not a name, and its parts of speech are not all grammar (particle, auxiliary, conjunction, copula, prefix, suffix, counter, expression); it has an English gloss.
- **Learnable:** a reading that `readingTokens` ([D5](#d5-reading-tokens-and-rule-errors)) cannot read, because a character is neither a learnable kana nor っ, ッ or ー, is excluded and counted as `notLearnable`.
- **The exclusion list.** `packages/content/word-exclusions.json`, `[{ "seq": number, "text": string, "reason": string }]`, is applied after the rule and counted as `excludedByList`. It holds the leftovers of part 1 that the rule lets through (クソ, ナチス and any other) and what the maintainer names in M2. It is part of the pipeline and reviewed like code; no chunk is edited by hand (D19 of the spec).
- **Items** are built as steps 4–7 of "Words" build them today: the meaning (the first gloss of the first 3 senses, with `stagr`, at most 60 characters), homonyms merged into `w:<script>:<reading>`, the Russian coverage. Items are sorted by reading in code-point order.
- **Output:** `words-hiragana.json` and `words-katakana.json` (`ContentItem[]`, format unchanged), the manifest's counts and `contentVersion`; each chunk at most 40 KB gzip (part 1 estimated 24 and 17 KB). A word of one kana stays in the chunk; the session leaves it out ([D11](#d11-words-in-the-model)).
- **The sample.** The build writes `packages/content/audit-words.md`: 100 words of each script in the order of `sha256("audit:" + id)`, each with its reading, meaning and JMdict entry number, then every word of the exclusion list with its reason. The maintainer reads it before PR 1 is merged (M2).
- **Glyphs:** `glyphs.txt` and the Noto subset follow the content ([ADR 071](docs/adr/071-glyph-set-from-generated-content.md)); the font stays within 45 KB.

#### D2. Stroke data and the origin kanji from KanjiVG

KanjiVG is the source of the stroke order that ADR 099 left to P9. It holds each stroke as a centre line in writing order, and the same files draw the kanji a pair of kana comes from (Q3), so no font grows.

- **Source:** the latest release of `KanjiVG/kanjivg` on GitHub on the day of PR 9, its archive of the main SVG files (one file per character, named by its code point). It is pinned in `packages/content/sources.json` (URL, sha256, size, date, licence `CC BY-SA 3.0 (Ulrich Apel, KanjiVG)`) and mirrored as an asset of a new release `content-sources-YYYY-MM-DD` ([ADR 068](docs/adr/068-content-sources-mirrored-as-release-assets.md); M3).
- **Glyphs:** every character of every learnable kana of both tracks (each of the two characters of a yōon or an extended kana; a kana with a dakuten or handakuten as its own character), and the origin kanji of the table below. A character with no file fails the build.
- **Chunks** in `apps/web/src/entities/prompt/content/`: `strokes-hiragana.json` and `strokes-katakana.json` keyed by character, `origins.json` keyed by kanji, each at most 40 KB gzip:

  ```ts
  type StrokeGlyph = {
    /** The path data of each stroke in writing order, in KanjiVG's 109 × 109 box, one decimal. */
    readonly d: readonly string[];
    /** Where each stroke's number stands (KanjiVG's stroke numbers), one decimal. */
    readonly n: readonly (readonly [x: number, y: number])[];
  };
  type StrokeChunk = Readonly<Record<string, StrokeGlyph>>;
  ```

- **The origins table** `packages/engine/src/data/origins.ts`: `kanaOrigins: Readonly<Record<string, string>>`, hiragana → kanji, for the basic kana whose hiragana and katakana come from the same kanji (か and カ from 加), and `originOf(kana: string): string | null` for either script. It is compiled from the tables of origins (字源) of the Japanese Wikipedia articles 平仮名 and 片仮名, cited with the date in the file. A pair whose two scripts come from different kanji is left out. The maintainer reads the table before PR 9 is merged (M7).
- **Credit:** CC BY-SA 3.0 applies to the converted data, shipped as these separate files. `/about` credits KanjiVG from the pull request that first shows its data (PR 12, [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen)); `NOTICE.md` lists it under "Third-party data" and "Mirrored content sources" in PR 9.

### 3.2 The log

#### D3. Events of format 4

`packages/shared/src/types.ts`:

```ts
/** A rule of P9 (ADR 117, point 3): っ doubles the next consonant, ー lengthens the vowel. */
export type RuleKey = 'rule:sokuon' | 'rule:choon';

export type TaskKind =
  | 'recall'
  | 'recognition'
  | 'contrast'
  | 'transfer'
  | 'build'
  | 'fluency'
  | 'listening'
  | 'dictation'
  | 'pair'
  | 'word'
  | 'mismatch' // find the error: the kana shown under another kana's romaji (P9)
  | 'script'; // hiragana or katakana? (P9)

export type IntroductionEvent = EventId & {
  readonly t: 'intro';
  readonly k: LearnKanaKey | RuleKey;
};

export type AnswerEvent = EventId & {
  readonly t: 'answer';
  readonly task: TaskKind;
  /**
   * The kana asked: the composite of `build`, the katakana of `transfer`, the odd kana of
   * `mismatch`. A `RuleKey` only for a rule token of a word; a `WordKey` only for a word item (P13).
   */
  readonly k: LearnKanaKey | WordKey | RuleKey;
  /** Typed: no rejected key and no reveal on it. A choice: the right one. */
  readonly ok: boolean;
  readonly ms: number;
  /** The answer was revealed before it was typed (Esc, "show the romaji"). */
  readonly hint: boolean;
  readonly wrong: LearnKanaKey | null;
  readonly alt: LearnKanaKey | null;
  /** Keys rejected on it, 0–9 (more count as 9); 0 for a choice. A rule's: its rule errors. */
  readonly misses: number;
  /** The reading of the word the event belongs to; null outside a word task. */
  readonly w: string | null;
};
```

- **Encoding.** An answer encodes as 9, 10 or 11 fields: `[dt, 'a', task, k, ok, ms, hint, wrong, alt]` when `misses` is 0 and `w` is null, `[…, misses]` when only `w` is null, `[…, misses, w]` otherwise. The encoder writes the shortest form, so an event of format 3 keeps its bytes. The decoder accepts the three forms; a missing field reads as 0 or null.
- **Bounds** (`log-codec.ts`, the only place with them): `misses` an integer from 0 to `MISSES_MAX` = 9; `w` a string of 1 to `WORD_TEXT_MAX` = 32 characters; a rule key only as `k` of an `intro` or of an answer of task `word`; `mismatch` and `script` with a kana key.
- **Sync format 4.** `SYNC_FORMAT_VERSION` = 4 and `SyncRequest.v: 4`. The server answers `400 invalid_body` to any other `v`, so a tab of format 3 stops syncing until it is reloaded (A28). A row of format 3 that D1 holds is still a valid page, so no D1 row is rewritten or dropped.
- **IndexedDB schema 8.** The log pages and the outbox change format, so `SCHEMA_VERSION` becomes 8 and a database of schema 7 is reset (ADR 061). The maintainer syncs first (M4); signing in again pulls the log back.
- **`hint` now means a reveal.** ADR 100 reserved it for a help that does not give the whole answer, which never existed. From format 4 it is set when the answer was revealed, and such an answer is never `ok`. An event of format 3 logged Esc as a rejected key; it grades as before ([D6](#d6-grades)).

#### D4. What each task logs

Every event of one task is written in one append with the same `at`: a word's events, a run's events. The events of a word come in reading order; a merged っX gives the rule's event, then the event of X.

| Task                                  | Events                                 | `k`            | `ok`                                          | `ms`                                                 | `hint`         | `wrong`                       | `alt`                  | `misses`                         | `w`         |
| ------------------------------------- | -------------------------------------- | -------------- | --------------------------------------------- | ---------------------------------------------------- | -------------- | ----------------------------- | ---------------------- | -------------------------------- | ----------- |
| introduction (plain, transfer, build) | `intro` when the shown romaji is typed | the kana       | —                                             | —                                                    | —              | —                             | —                      | —                                | —           |
| rule introduction                     | `intro` when the example is typed      | the rule       | —                                             | —                                                    | —              | —                             | —                      | —                                | —           |
| recall (the round's too)              | `recall`                               | the kana       | no rejected key, no reveal                    | A37                                                  | revealed       | the kana of the first error   | null                   | rejected keys                    | null        |
| build                                 | `build`                                | the composite  | as recall                                     | A37                                                  | revealed       | as recall                     | null                   | rejected keys                    | null        |
| recognition                           | `recognition`                          | the kana       | the right option                              | shown → chosen                                       | false          | the option chosen, when wrong | null                   | 0                                | null        |
| contrast                              | `contrast`                             | the kana       | the right option                              | shown → chosen                                       | false          | the option chosen, when wrong | the plan's `alt`       | 0                                | null        |
| transfer                              | `transfer`                             | the katakana   | the right option                              | shown → chosen                                       | false          | the option chosen, when wrong | null                   | 0                                | null        |
| hiragana or katakana?                 | `script`                               | the kana       | its script chosen                             | shown → chosen                                       | false          | null                          | null                   | 0                                | null        |
| find the error                        | `mismatch`                             | the odd kana X | X picked                                      | shown → picked                                       | false          | the kana picked, when not X   | Y, whose romaji X wore | 0                                | null        |
| word: a kana                          | `word`                                 | the kana       | no rejected key except rule errors, no reveal | the token's A37 ([D22](#d22-typed-answers-by-token)) | revealed on it | the kana of its first error   | null                   | its rejected keys, not rule ones | the reading |
| word: a rule token                    | `word`                                 | the rule       | no rule error, no reveal                      | 0                                                    | false          | null                          | null                   | its rule errors                  | the reading |
| fluency run: each kana once           | `fluency`                              | the kana       | no rejected key, no reveal                    | the token's A37                                      | revealed on it | the kana of its first error   | null                   | rejected keys                    | null        |

### 3.3 The engine

#### D5. Reading tokens and rule errors

- **`readingTokens`** (`packages/engine/src/data/reading.ts`, exported from the index), built in PR 1 because the pipeline needs it first:

  ```ts
  export type ReadingToken =
    | { readonly kind: 'kana'; readonly kana: string; readonly script: Script }
    | { readonly kind: 'sokuon' } // っ or ッ
    | { readonly kind: 'choon' }; // ー
  /** The tokens of a reading, longest kana of the selectable rows first; null when a character is none. */
  export function readingTokens(text: string): readonly ReadingToken[] | null;
  ```

  The longest match is two characters, then one, over the kana of `allKanaRows`; then っ or ッ; then ー. Small kana outside a yōon or an extended kana, ゐ, ゑ and ヶ make it null.

- **`Token.sokuon: boolean`** of the matcher: true for a merged っX `kana` token, false for every other token.
- **`Engine.ruleError(m, s, ch): boolean`** for a key `ch` that `step` rejected in `s`, about the token `errorTarget(m, s)`. It is true when that token is a standalone `sokuon` or a `choonpu`, or a merged っX token for which, in an active position on it, the letters of the token typed so far plus `ch` form a non-empty prefix of a spelling of X in the strictness: the learner typed X without the doubling (ADR 117, point 3, with a prefix in place of a whole spelling, because the key is rejected before the spelling ends).
- The web wrapper (`pages/learn/lib/prompt/engine.ts`) exports `ruleError` beside `errorTarget`.
- **Golden rows** in [engine.md](docs/spec/engine.md), "Rule errors", in both strictness modes:

  | Prompt   | Typed     | The rejected key | Error of      |
  | -------- | --------- | ---------------- | ------------- |
  | きって   | `kite`    | `e` after `kit`  | the rule (っ) |
  | きって   | `kita`    | `a` after `kit`  | て (as た)    |
  | きって   | `kie`     | `e` after `ki`   | て            |
  | がっこう | `gako`    | `o` after `gak`  | the rule (っ) |
  | まっちゃ | `mach`    | `h` after `mac`  | the rule (っ) |
  | あっ     | `at`      | `t` after `a`    | the rule (っ) |
  | コーヒー | `koh`     | `h` after `ko`   | the rule (ー) |
  | きって   | `kiltute` | none             | —             |

### 3.4 The fold

#### D6. Grades

`eachEffect` (`packages/model/src/grade.ts`), the table of ADR 100, point 4, as ADRs 115, 117 and 118 amend it. "By time" is good when `ms ≤ line` and no `hint`, hard otherwise; `line` is the pace of the task type and the device (ADR 115).

| Task, `k`                        | `ok`                                                                            | Not `ok`                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| recall, a kana                   | by time; each learned part a hard review (credit)                               | **a slip** (`misses` = 1, `wrong` null, no `hint`, `ms ≤ line`) grades as a correct recall with a hint: hard, with the credit. Otherwise "again", and the confusion (k, `wrong`) + 1 when `wrong` is set |
| word, a kana                     | as recall, against the pace `word`                                              | as recall                                                                                                                                                                                                |
| word, a rule                     | no memory; the rule's errors in a row → 0 ([D8](#d8-the-rules-in-the-state))    | no memory; errors in a row + 1                                                                                                                                                                           |
| word, a word key (P13)           | each learned kana of the reading a hard review (ADR 100's sketch, kept for P13) | nothing                                                                                                                                                                                                  |
| fluency                          | good when `ms ≤ line`, otherwise no update                                      | `wrong` set: "again" and the confusion + 1; a slip, as recall's: no update; otherwise "again"                                                                                                            |
| recognition, listening           | hard                                                                            | "again"; confusion (k, `wrong`) + 1                                                                                                                                                                      |
| contrast                         | hard; confusion (k, `alt`) − 1                                                  | "again"; confusion (k, `wrong` ?? `alt`) + 1: the option chosen, which the four options of P9 make other than `alt` at times                                                                             |
| mismatch                         | hard on X; confusion (X, `alt`) − 1                                             | "again" on X; confusion (X, `alt`) + 1                                                                                                                                                                   |
| script                           | nothing                                                                         | nothing                                                                                                                                                                                                  |
| transfer, build, dictation, pair | as now                                                                          | as now                                                                                                                                                                                                   |

- Every event of format 3 decodes with `misses` 0, so a recall that is not `ok` is never a slip: an old log folds to the state it folds to today. The executor records a digest of the state and the statistics of `syntheticLog({ answers: 40_000, seed: 1 })` folded by the code before the change, as a fixture, and a test checks that the new fold gives the same digest.
- A slip in a recall keeps the credit to parts because the research simulated it so: a forgiven slip was a correct recall with a hint (`packages/sim/src/policies/production.ts`, `slips: 'hard'`).

#### D7. Verdicts

What an answer did to its kana, in one function that the fold and the session share (`packages/model/src/verdict.ts`, exported from the index):

```ts
/** `wrong`: the main grade is "again" (the round takes the kana); `slip`: not `ok`, spared by the slip rule. */
export type Verdict = 'right' | 'slip' | 'wrong';
/**
 * The verdict of an answer whose `k` is a kana, folded on `state` now: the same `line` and the same
 * rule as the fold. A rule's answer: `right` when `ok`, else `wrong`.
 */
export function verdictOf(state: ModelState, answer: AnswerEvent): Verdict;
```

The fold uses it for:

- **the learning streak:** a `recall` or a kana of a `word` adds 1 when `right` or `slip`, and sets 0 when `wrong`; the other tasks keep the rule of today (a correct recognition keeps the streak);
- **the outcomes of reviews:** an answer on a learned kana with task `recall` or `word` moves `observed` and `outcomes.review` with `verdict !== 'wrong'`; any other task on a learned kana moves neither. An answer on a learning kana moves `outcomes.learning` the same way, except `script`, which has no effect;
- **the statistics:** `RecallStat.ok` = `verdict !== 'wrong'`, so a forgiven slip counts as right in a kana's accuracy, in "weak" and in the fluency run's choice ([D16](#d16-the-fluency-run)). `KanaLog.recall` still holds `recall` answers only: a kana read in a word is timed from the kana before it, not like a kana alone.

The learn store returns the verdicts it computed before applying each event ([D21](#d21-the-session)).

#### D8. The rules in the state

```ts
export type RuleState = {
  /** Rule errors in a row; a right rule token and an introduction set it to 0. */
  readonly errors: number;
};
export type ModelState = {
  readonly items: ReadonlyMap<LearnKanaKey, ItemState>;
  readonly learner: LearnerState;
  readonly confusions: ReadonlyMap<LearnKanaKey, ReadonlyMap<LearnKanaKey, number>>;
  /** The rules introduced, by key. */
  readonly rules: ReadonlyMap<RuleKey, RuleState>;
};
```

- An `intro` of a rule sets `{ errors: 0 }`, introduced or not: showing a rule again starts its count again.
- An answer on a rule introduces it when it is not, then sets `errors` to 0 when `ok` and adds 1 otherwise.
- A rule has no memory, no statistics, and no place on the chart or the path. `snapshot`, `clone` and `foldFromState` copy `rules`; the property tests compare it.

#### D9. One task per moment, and the recent words

- **A task is the events of one `(dev, at)`.** An `intro` or `answer` event whose `dev` and `at` equal those of the last `intro` or `answer` applied continues that task. It does not call `noteTask`, does not add to `tasks`, and every kana it grades takes that task's `lastTask`. A word of three kana is then one task of the learner's clock, not three with gaps of 0 ms. A log without such pairs folds as before: task events are at least `ANSWER_PAUSE_MS` apart.
- **`LearnerState.words: readonly string[]`**: the `w` of the last `WORDS_RECENT` = 30 word tasks applied, oldest first, one per task (the first event of the task with a `w`). It is copied like `gaps`, and it merges across devices with the log. The session plan reads it for "not one of the last 30 words" (ADR 118, point 1), so the rule spans sessions and devices with no store of its own.

#### D10. The pace of a word, and the synthetic log

- `TimedTask` gains `word`: a kana of a word is graded against the pace `word` of its device (`word:<dev>`, then `word`), as ADR 117, point 1, decided. An answer whose `k` is not a kana is never timed and never moves a pace (`countsForPace` asks for a kana key).
- **`syntheticLog({ answers, seed, words })`.** With `words: true`, after every 5 kana tasks of a sitting comes a word task of 3 introduced kana of the selected track drawn with the seeded `Rng` (a pseudo-word whose reading is their characters). Each kana is an event of task `word`, answered as the log answers a recall of that kana, sharing the task's `at`; there are no rules. Without `words`, the log is byte for byte as today. `model-cost.spec.ts` and `home-cost.spec.ts` use `words: true` from PR 4; the 40,000 answers count each event of a word.

### 3.5 The session plan

The session's rules live in `@nekotype/model`, so the app and `packages/sim` run the same code (P7 plan, rule 3a: the simulator runs the production model, never a copy).

#### D11. Words in the model

`packages/model/src/words.ts`:

```ts
export type WordEntry = {
  /** The word as written: its reading in kana; `w` in the log. */
  readonly text: string;
  readonly track: Track;
  /** The kana of its tokens in reading order, repeats kept; a merged っX gives X. */
  readonly keys: readonly LearnKanaKey[];
  /** The rules it needs, each once: `rule:sokuon` for っ or ッ, `rule:choon` for ー. */
  readonly rules: readonly RuleKey[];
};
/** Null when `readingTokens` is null, the kana are of two tracks, or it has fewer than 2 kana. */
export function wordEntry(text: string): WordEntry | null;
/** Every kana of the word introduced, and every rule it needs introduced. */
export function isReadable(state: ModelState, word: WordEntry): boolean;
```

A word of one kana is a recall, so it is never a word task (part 2 of the research). Readable means introduced, not learned (ADR 117, point 2).

#### D12. The session plan

`packages/model/src/session.ts`, exported from the index:

```ts
export type PlanFeature =
  | 'word'
  | 'closing'
  | 'rule'
  | 'round'
  | 'contrast'
  | 'transfer'
  | 'build'
  | 'script'
  | 'mismatch'
  | 'fluency';
export const PLAN_FEATURES: readonly PlanFeature[];

export type SessionTask =
  | {
      readonly kind: 'introduction';
      readonly key: LearnKanaKey;
      readonly via: 'plain' | 'transfer' | 'build';
    }
  | {
      readonly kind: 'recall';
      readonly key: LearnKanaKey;
      readonly review: boolean;
      /** A task of the round after the session. */
      readonly round: boolean;
    }
  | { readonly kind: 'recognition'; readonly key: LearnKanaKey }
  | {
      readonly kind: 'contrast';
      readonly key: LearnKanaKey;
      /** The kana and 1–3 of its contrast set, not shuffled. */
      readonly options: readonly LearnKanaKey[];
      readonly alt: LearnKanaKey;
    }
  | { readonly kind: 'transfer'; readonly key: LearnKanaKey; readonly from: LearnKanaKey }
  | { readonly kind: 'build'; readonly key: LearnKanaKey }
  | { readonly kind: 'script'; readonly key: LearnKanaKey }
  | {
      readonly kind: 'mismatch';
      readonly key: LearnKanaKey;
      readonly alt: LearnKanaKey;
      readonly word: WordEntry;
      /** The position of `key` in `word.keys` that wears the romaji of `alt`. */
      readonly index: number;
    }
  | { readonly kind: 'word'; readonly word: WordEntry; readonly closing: boolean }
  | {
      readonly kind: 'rule';
      readonly key: RuleKey;
      readonly example: WordEntry;
      /** The rule was introduced before: shown again after its errors. */
      readonly again: boolean;
    }
  | { readonly kind: 'fluency'; readonly keys: readonly LearnKanaKey[] };

export type SessionPlanDeps = {
  /** `settings.learn.track` when the session starts. */
  readonly track: Track;
  /** The words of that track read by `wordEntry`, never the other track's (Q1). May be empty. */
  readonly words: readonly WordEntry[];
  readonly rng: Rng;
  /** What the screen can show; a feature left out falls back ([D13], [D14]). Default: all. */
  readonly features?: ReadonlySet<PlanFeature>;
  /** `SESSION_TASKS` unless a test asks for fewer. */
  readonly tasks?: number;
};

/** The fold's live state and statistics (`Fold.state`, `Fold.stats`). */
export type PlanInput = { readonly state: ModelState; readonly stats: LogStats | null };

export interface SessionPlan {
  /** The next task, planned on `input` at `now`; null when the session and its round are over. */
  next(input: PlanInput, now: number): SessionTask | null;
  /** The kana the last task answered wrong (verdict `wrong`), in the order they were answered. */
  record(wrong: readonly LearnKanaKey[]): void;
  /** Tasks given before the round: the number of the session line. */
  readonly count: number;
  /** The round's length once it has started; null before. */
  readonly roundSize: number | null;
  /** Tasks of the round given so far. */
  readonly roundCount: number;
}
export function createSessionPlan(deps: SessionPlanDeps): SessionPlan;
```

- `next` runs when a task is shown, never in a key handler, as `nextTask` does now.
- `features` lets each pull request turn a kind on in the pull request that draws it ([D21](#d21-the-session)); `packages/sim` and the tests use all of them.
- A feature left out: `word`, `closing` or `rule` gives no such task; `round` gives no round; `fluency` gives no run; `contrast`, `script`, `build`, `transfer` and `mismatch` give the next row of the mix ([D14](#d14-the-mix)), down to the planner's own task.

#### D13. The order of a session

1. **Counting.** `count` runs from 0 to `tasks` (30); every task given adds 1, the run and the rule introduction too. The round comes after.
2. **Words open** when, at the first `next`, at least `WORDS_START` = 25 words of `deps.words` are readable and `word` is on. That holds for the whole session. ADR 116, point 4, and the answer to Q1: the count is of the selected track's words, and only they are given.
3. **Each `next`** takes the first of these steps that gives a task:
   - **the end:** once `count === tasks`, the closing word has been given, or the round has started: the round (rule 6);
   - **the closing slot:** `count === tasks − 1`, words open, `closing` on and no closing word given: the closing word (rule 5), when one exists;
   - **the run's slot:** `count === FLUENCY_AT − 1` (the 15th task) and `fluency` on: the run of [D16](#d16-the-fluency-run), when it gives one;
   - **the word slot:** words open, and at least `WORD_EVERY` = 5 planner tasks since the last word slot: a rule introduction when [D15](#d15-the-two-rules) says one is due, otherwise a word (rule 4). With neither, the slot waits: the planner goes next, and the next call tries again. A slot that gives a task sets the count of planner tasks to 0;
   - **the planner:** `nextTask(state, { now, track, previous, rng })`. When it returns null: the closing word under the closing slot's conditions, at any `count`, else the round. Otherwise the count of planner tasks grows by 1, `previous` becomes its kana, and [D14](#d14-the-mix) turns it into the session's task.
4. **A word** is drawn uniformly by `rng` from the readable words of `deps.words` that are not in `state.learner.words` ([D9](#d9-one-task-per-moment-and-the-recent-words)) and were not given in this session. After a rule introduction, the next `RULE_WORDS` = 2 word slots draw from the readable words that need that rule, when there are any.
5. **The closing word** is drawn the same way from the readable words whose every kana was the kana of a task of this session: an introduction, a recall, a choice, a word's kana or a run's kana. `closing` is true.
6. **The round.** When it starts it takes the first `ROUND_MAX` = 5 kana of the session's wrong list, in the order of their first error, each once. `roundSize` is that length; each `next` gives one of them as `{ kind: 'recall', review: false, round: true }` and makes it `previous`; then null. An empty list gives null at once. `record` adds nothing once the round has started.
7. **`record(wrong)`** comes after every task, with the kana its verdicts judged `wrong`, in the order they were answered; the plan keeps each kana's first error only.
8. Words, the run and the rule introduction leave `previous` alone: it is the kana of the last planner task or round task.

#### D14. The mix

A task of the planner becomes the first kind of its rows whose condition holds and whose feature is on (ADR 118, point 7). The precedence and the limits are decided here; the research gave the conditions.

| The planner gives      | Becomes                      | When                                                                                                                                                                                           | At most     |
| ---------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| an introduction of K   | a build introduction         | K has parts (dakuten, handakuten, yōon, extended); the planner introduces it only once they are learned                                                                                        | —           |
|                        | a transfer introduction      | K is katakana and its pair (`ITEMS.get(K).pair`) is learned                                                                                                                                    | —           |
|                        | a plain introduction         | otherwise                                                                                                                                                                                      | —           |
| a recognition of K     | contrast                     | the contrast set of K holds a kana with confusions (K → it) ≥ `WEAK_CONFUSIONS` (2)                                                                                                            | —           |
|                        | hiragana or katakana?        | none given in this session, and both tracks have a learned kana                                                                                                                                | 1 a session |
|                        | build                        | K has parts                                                                                                                                                                                    | —           |
|                        | transfer (`from` = K's pair) | K is katakana and its pair is learned                                                                                                                                                          | —           |
|                        | recognition                  | otherwise                                                                                                                                                                                      | —           |
| a review recall of K   | find the error               | none given in this session; the first kana Y of K's contrast set has confusions (K → Y) ≥ 2; a readable word of `deps.words`, not recent, holds K and has at most `MISMATCH_MAX_KANA` (9) kana | 1 a session |
|                        | recall                       | otherwise                                                                                                                                                                                      | —           |
| a learning recall of K | recall                       | always                                                                                                                                                                                         | —           |

- **The contrast set of K:** the introduced kana of K's track that are similar to K (`similarKana` of the engine) or that K was confused with (confusions K → it above 0), without any kana that shares a spelling with K in the relaxed mode (the `learner` and `ime` spellings of the engine's table: じ/ぢ, ず/づ, お/を and their katakana). It is ordered by confusion count, highest first, then by the similar table's order, then by track order. Kana with a shared spelling are left out because the prompt of a contrast is a romaji that would fit two options.
- **contrast:** `options` = K and the first `CONTRAST_OPTIONS − 1` (3) of the set; `alt` = the first of the set.
- **find the error:** Y as in the table; the word drawn uniformly by `rng` among the qualifying words; `index` = the first position of K in `word.keys`. Words of at most 9 kana keep the pick to the keys 1–9.

#### D15. The two rules

- A rule R is **due** at a word slot when the session has given no rule introduction yet and either:
  - R is not introduced, and some word of `deps.words` needs R and would be readable with R introduced: every kana introduced, every other rule it needs introduced;
  - or R is introduced with `errors ≥ RULE_ERRORS` (2).
- When both rules are due, `rule:sokuon` comes first.
- The task is `{ kind: 'rule', key: R, example, again }`. `example` is a word that needs R and is readable with R introduced, drawn uniformly, not recent; `again` is true when R was introduced before.
- The app logs an `intro` of R once the learner has typed the example ([D4](#d4-what-each-task-logs)). The fold then introduces R or sets its count to 0 ([D8](#d8-the-rules-in-the-state)).
- A word that needs a rule not yet introduced is never readable ([D11](#d11-words-in-the-model)), so no word task holds a rule before its introduction.

#### D16. The fluency run

At the run's slot ([D13](#d13-the-order-of-a-session), rule 3):

- **Eligible:** the learned or mastered kana of `deps.track` whose last `RECENT_RECALLS` (10) recall answers in `stats` number at least `WEAK_MIN_RECALLS` (5), with a share of `ok` of at least `WEAK_ACCURACY` (0.8); `ok` is the verdict ([D7](#d7-verdicts)).
- **Given** when at least `FLUENCY_MIN` = 8 are eligible: the `FLUENCY_MAX` = 12 slowest of them by the median of those recall times (ties by track order), in an order shuffled by `rng`, each once. With fewer than 8, or with `stats` null, no run.
- This is the maintainer's reading of ADR 118's "accurate and slower than their pace" (Q4): the slowest of the accurate kana. Kana slower than the line between good and hard, the 90th percentile, are seldom eight, and the run would almost never come.

#### D17. Constants

New constants of `packages/model/src/constants.ts`. Each chooses tasks, so a change needs a sim run and an ADR ([section 8](#8-instructions-for-executor-agents), rule 4c).

| Constant            | Value | From                                  |
| ------------------- | ----- | ------------------------------------- |
| `WORD_EVERY`        | 5     | ADR 118, point 1                      |
| `WORDS_START`       | 25    | ADR 118, point 1                      |
| `WORDS_RECENT`      | 30    | ADR 118, point 1                      |
| `ROUND_MAX`         | 5     | ADR 118, point 4                      |
| `RULE_ERRORS`       | 2     | ADR 117, point 3; ADR 118, point 6    |
| `RULE_WORDS`        | 2     | ADR 118, point 6                      |
| `FLUENCY_AT`        | 15    | this plan: the middle of 30 tasks     |
| `FLUENCY_MIN`       | 8     | ADR 118, point 7                      |
| `FLUENCY_MAX`       | 12    | this plan: about 20 s at 1.5 s a kana |
| `CONTRAST_OPTIONS`  | 4     | ADR 117, point 5 (2–4 options)        |
| `MISMATCH_MAX_KANA` | 9     | this plan: the keys 1–9               |

`WORDS_RECENT` comes with PR 4, which keeps the recent words in the state ([D9](#d9-one-task-per-moment-and-the-recent-words)); the others come with PR 5. `MISSES_MAX` = 9 and `WORD_TEXT_MAX` = 32 are bounds of the codec in `packages/shared` ([D3](#d3-events-of-format-4)).

#### D18. The forecast and the outline

`forecastRow` and `outlineSession` keep playing `nextTask` alone, without words, runs, the mix or the round.

- The home does not load the words, and part 3 measured the same pace per day with and without them (the 104 kana on day 13 both), so a session's progress through a row changes little. The history's correction absorbs a steady bias per learner.
- PR 5 measures the forecast's error on the production plan in the simulator ([D19](#d19-the-simulator-on-the-production-plan)). Over 1 session (median) the pull request stops and asks.
- The outline still counts kana tasks (`about 30 tasks: 6 reviews, 2 new kana`). With words open a session holds 25 kana tasks and 5 words, which the outline does not name: it is an outline, not a promise ([learning.md](docs/spec/learning.md)). P12, which brings words to the home, may name them.

#### D19. The simulator on the production plan

- `createProductionPolicy` gains the option `plan: true`: each session is `createSessionPlan({ track, words, rng, features: all })`, with `words` the readable entries of the track's committed chunk (`apps/web/src/entities/prompt/content/words-<track>.json` after PR 1, read with `fs` and `wordEntry`; no import of `apps/web` code). Its fold keeps statistics for the run. The adapter converts the plan's tasks to the harness's tasks and the answers to the events of [D4](#d4-what-each-task-logs), and holds no rule of the plan.
- **The harness answers the new kinds:** contrast, transfer and find the error as a recognition of their kana; build as a recall; hiragana or katakana? always right; a word's kana by `Learner.read`; a run's kana as recalls; the round as recalls; a rule introduction as nothing, and a rule token always right (the reference learner has no rules).
- **Slips:** `ReferenceParams.slip` = 0.03 in the acceptance run (part 3, table 5).
- **Research options** (`every`, `carrier`, `recheck`, `minPool`, `recent`, `closing`, `endRound`, `slips`) stay outside the production path, so the tables of parts 1–3 still reproduce.
- **`src/p9.ts`** (`pnpm --filter @nekotype/sim run p9`), 50 beginners over 60 days, on hiragana and on both tracks with the katakana suggestion followed: the P7 line without words against the production plan, with the columns of part 3's table 5 and the forecast's median absolute error for the next row; then the slow learners of P7 part 3 on the production plan.
- **Lines** (P9 acceptance): the beginner reads the 46 basic hiragana by day 8 (median), with review retention of at least 90% and at most 10 minutes a day over days 1–14; each slow learner within 2 points of its P7 value; the forecast off by at most 1 session (median). A number outside its line stops the pull request; nothing is tuned to pass.

### 3.6 The session in the app

#### D20. Words in the app

- **`entities/prompt` becomes a slice** with an `index.ts` over its `content/` folder:

  ```ts
  export type WordItem = {
    /** `w:<script>:<reading>`: the `itemId` of a report. */
    readonly id: string;
    readonly text: string;
    /** English, shown after the answer only. */
    readonly meaning: string;
  };
  /** The word chunk of a track, by dynamic import. */
  export function loadWordItems(track: Track): Promise<readonly WordItem[]>;
  export function prefetchWords(track: Track): Promise<void>;
  export function loadStrokes(track: Track): Promise<StrokeChunk>;
  export function loadOrigins(): Promise<StrokeChunk>;
  /** `contentVersion` of the manifest, for a report. */
  export function loadContentVersion(): Promise<string>;
  ```

- **Loading.** The session loads the word chunk of `learn.track` with its runtime (`Promise.all`) and reads the items with `wordEntry` once, outside any key handler; an entry that is null is dropped. A chunk that fails to load gives a session without words (no word, closing word, rule introduction or find the error), never a blocked start.
- **Prefetch.** On idle after the store is ready, with the session runtime (`app/prefetch.ts`), when the selected track has an introduced kana.
- **`check-budget.mjs`:** content chunks may be in the build from P9. A content chunk is never the initial chunk, nor a static import of it or of a route chunk (the checks of `SYNC_ENTRY`), and is at most 40 KB gzip.

#### D21. The session

- **`createLearnSession`** plans with `createSessionPlan`. Its deps gain `words: readonly WordEntry[]` and `items: ReadonlyMap<string, WordItem>` (by text) of the selected track, and `features: ReadonlySet<PlanFeature>`. The features come from `SESSION_FEATURES` in `pages/learn/lib/constants.ts`, which each pull request extends with what it builds: PR 6 `round`; PR 7 `word`, `closing`, `rule`; PR 10 `contrast`, `transfer`, `build`, `script`, `mismatch`; PR 11 `fluency`.
- **`TaskView`** mirrors `SessionTask` with what the screen shows: the kana, the romaji, the options, and a word's meaning once it is answered. The export names the views.
- The session hands the plan `{ state: store.modelState(), stats: store.stats() }` when a task is shown.
- **The learn store** (`entities/learn`):
  - `recordAnswer(input: AnswerInput): Verdict | null`, where `AnswerInput` gains `misses: number`;
  - `recordTokens(input: TokensInput): readonly Verdict[] | null`, which writes the events of one word or run at one `at` and returns the verdicts of its kana in order;
  - `introduce(key: LearnKanaKey | RuleKey)`;
  - `stats(): LogStats | null`, the fold's live statistics.

  ```ts
  export type TokenAnswer = {
    readonly key: LearnKanaKey | RuleKey;
    readonly ok: boolean;
    readonly hint: boolean;
    readonly wrong: LearnKanaKey | null;
    readonly misses: number;
    /** Its keys, `t` from the end of the token before it (the first: from the task shown); none for a rule. */
    readonly keystrokes: readonly Keystroke[];
  };
  export type TokensInput = {
    readonly task: 'word' | 'fluency';
    /** The word's reading; null for a run. */
    readonly w: string | null;
    readonly answers: readonly TokenAnswer[];
  };
  ```

  The store computes each kana's `ms` from its keystrokes with K (A37, `recallAnswerTime`, K taken before the task's own intervals), adds the task's accepted key intervals to K's window as for a recall, and computes each verdict with `verdictOf` before applying the event. A rule's `ms` is 0.

- **Recording stays deferred.** In the deferred callback the session:
  - calls `plan.record` with the kana judged `wrong`;
  - adds the task's number to `misses` (its tick turns `miss`) when a verdict is `wrong`, or when the choice of a hiragana-or-katakana task is wrong;
  - sets the notice of [D23](#d23-feedback-that-teaches).
- **Ticks:** one per task of the session (`total` = `SESSION_TASKS`); the round adds `roundSize` ticks when it starts, as the export draws them.
- **The summary:** `errors` lists the kana with a `wrong` verdict (a slip is not listed); `mixups` lists the option chosen in a wrong recognition, contrast or transfer and the kana picked in a missed find-the-error; the rest as now.
- **The session's `end`** is written after the round, when `next` returns null. A session left early has no round and no `end`.

#### D22. Typed answers by token

A word and a fluency run are typed as one stream; each token gets its own answer. `pages/learn/lib/typed-answer.ts`:

```ts
export type TypedKey = {
  /** ms from the task shown. */
  readonly t: number;
  readonly accepted: boolean;
  /** A rejected key or a reveal: `errorTarget` at that moment. An accepted key: null. */
  readonly token: number | null;
  /** A rejected key that `ruleError` calls a rule error. */
  readonly rule: boolean;
  /** Esc or "show the romaji". */
  readonly reveal: boolean;
};
/** The answers of a finished word or run, in reading order; a merged っX gives the rule's, then X's. */
export function tokenAnswers(input: {
  readonly matcher: Matcher;
  readonly state: MatchState;
  readonly keys: readonly TypedKey[];
  readonly track: Track;
  readonly strictness: Strictness;
}): readonly TokenAnswer[];
```

- **The key handler** only pushes a `TypedKey`, with `errorTarget` and `ruleError` for a rejected key; both are cheap reads of the match state. `tokenAnswers` runs in the deferred callback.
- **Accepted keys** go to their token by `committedTimings(matcher, state)`: each token's first and last accepted key.
- **A kana token:**
  - `misses` = its rejected keys that are not rule errors;
  - `ok` = none of those and no reveal; `hint` = a reveal on it;
  - `wrong`, for its first such key: `typed` = the letters of the token typed before that key plus the key; `wrong` = `wrongKana(track, strictness, typed)`, or, when that is null on a merged っX, `wrongKana` of `typed` without its doubling (a leading `xtu`, `ltu`, `xtsu` or `ltsu`, or a first letter that the second repeats, `tch` and `cch` included). `ta` on って gives た; `kko` on っか gives こ.
- **A rule part** (a merged っX's doubling, a standalone っ, a ー) gives one answer with its rule key: `misses` = its rule errors (on a standalone っ or ー, every rejected key), `ok` = none and no reveal, `hint` false, `wrong` null, no keystrokes.
- **A reveal** shows the token's romaji and counts on what the token holds: a kana's `hint`; on a merged っX both X's `hint` and a rule error; on a standalone っ or ー a rule error. The token must still be typed in full.

#### D23. Feedback that teaches

After a task with a `wrong` verdict, the notice says (Q2; the wording and the layout are the export's):

- **The learner's answer next to the right one.**
  - A typed kana whose `wrong` names a kana: that kana with its romaji, next to the right kana and its romaji (`tsu` is ツ; this is シ, `shi`).
  - A typed kana with no `wrong` (a reveal, several keys, a slow recovery): the right kana and its romaji.
  - A choice: the option chosen next to the right one.
  - A word: its first wrong kana, as a typed kana.
  - A missed find-the-error: the odd kana with the romaji it wore and its own.
- **The difference of a pair:** when the two kana are a pair of `similarPairs`, one line on how they differ. The keys are `session.pair.<h|k>.<a>.<b>`, with `a` and `b` the romaji of the pair in the table's order (`session.pair.h.nu.me`, `session.pair.k.shi.tsu`). The executor of PR 6 drafts the 47 lines in English and Russian; the maintainer reads them before its merge (M6). Other pairs get no line.
- **The promise:** `it comes back at the end of the session` while the kana is among the first `ROUND_MAX` wrong kana of the session; once the round is full, no promise.
- **A slip:** no notice, and the tick stays right.

#### D24. Choice and build tasks

- **Contrast:** the prompt is `displayRomaji(K)`; the options are the plan's, shuffled with the session's `rng`; keys 1–4.
- **Transfer:** the prompt is the hiragana `from`; the options are `recognitionOptions` for the katakana K, as for a recognition; keys 1–4.
- **Build:** the prompt is the parts (が: か and ゛, from the kana's canonical decomposition; きゃ: き and ゃ, its two characters); the romaji is typed as in a recall, against the matcher of K.
- **Hiragana or katakana?:** the kana K; two options, `hiragana` and `katakana`, keys 1 and 2; `ok` when the chosen script is K's.
- **Find the error:** the word's kana, each with `displayRomaji` under it, the one at `index` under `displayRomaji(alt)`; the learner picks a kana by its number (1–9) or a click; `ok` when the pick is `index`.
- **Introductions:**
  - build: the parts, then the kana;
  - transfer: the katakana next to its hiragana, and the origin kanji drawn from `origins.json` when `originOf` has one ([D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen)).

  Both are typed once with the shown romaji, as an introduction is today, and log an `intro`.

#### D25. The fluency run on the screen

- The run's kana are the prompts of one stream (`compile` of the kana, one prompt each); a reveal shows the current kana's romaji.
- No timer, count, speed or score is shown (ADR 093); the run ends when its last kana is typed.
- It is recorded at the end with `recordTokens({ task: 'fluency', w: null, … })`: one `fluency` event per kana, each kana being in the run once.
- A keystroke renders nothing; the end of the run renders at most once.

#### D26. The report dialog

- Restored from commit 753df9f (`git show 753df9f:apps/web/src/pages/trainer/…`): the dialog into `pages/learn/ui/report/`, a lazy chunk of its own, and `lib/turnstile.ts` into `pages/learn/lib/turnstile.ts`. It is laid out as the export draws it.
- It opens from a word task after the answer, never while the word is typed. The session waits while it is open; closing it gives the focus back to the session's input.
- The request of [backend.md](docs/spec/backend.md): `itemId` the word's `id`, `contentVersion` from the manifest ([D20](#d20-words-in-the-app)), `reason` (`wrong_reading`, `wrong_translation`, `other`), an optional `comment`, and the Turnstile token. Turnstile's script loads only when the dialog opens; the site key is chosen by host (ADR 092); the action is disabled offline (`useOnline`).
- Its strings are in the `session` part ([D28](#d28-strings-and-styles)).

#### D27. Stroke order and the origin kanji on the screen

- **The kana details** (`features/kana-details`) load the stroke chunk of the kana's track (`loadStrokes`) when the dialog opens and draw each glyph of the kana (a yōon, two) as SVG paths in writing order with their numbers, as the export draws them. Motion, if the export has any, respects `prefers-reduced-motion`. While the chunk loads, and after a failure, the place keeps its size.
- **The origin kanji.** The session loads `origins.json` with its runtime when `learn.track` is katakana. A transfer introduction draws the kanji from it under the same rules; without the chunk it shows the pair alone.
- PR 12 adds the KanjiVG credit to `/about`, so the data is credited from the first pull request that shows it; PR 10, which shows the origins, comes after PR 12.

#### D28. Strings and styles

- **Strings.** A dictionary part `session` (en and ru, key parity) is loaded with the session runtime (`loadSessionRuntime` waits for it). It holds every new string of the session: the task types, the notices, the 47 pair differences, the round, the run, the rule introductions and the report dialog. The `learn.session.*` strings of the English core stay. The `details` part gains the stroke order's strings, and `about` the sources section.
- **Styles.** The styles of the session's tasks move from `app/styles/index.css` to a stylesheet that the session runtime imports, so they leave the initial CSS. `nk-caret`, which the home's path draws, stays.

### 3.7 Budgets and measurements

#### D29. Budgets

- **Lines** after every pull request into `main`:
  - initial JS ≤ 31.0 KB gzip and initial CSS ≤ 8.0 KB gzip;
  - the session runtime chunk ≤ 20.0 KB gzip and the model chunk ≤ 12.0 KB gzip;
  - each word, stroke and origin chunk ≤ 40 KB gzip (the content budget of [quality.md](docs/spec/quality.md)).

  Above a line: stop and ask. Reason: P11 and P12 still need the initial chunk (the first visit and the words on `/`), and a session runtime past 20 KB is the sign to split it (the run, the report dialog).

- Every pull request writes in its description the initial JS and CSS and the session runtime and model chunks, before and after.
- The limits of [quality.md](docs/spec/quality.md) are not raised.
- **Measurements.** The latency gate samples word keystrokes too: PR 7 seeds its log so that words open. `model-cost.spec.ts` and `home-cost.spec.ts` measure a log with words from PR 4 ([D10](#d10-the-pace-of-a-word-and-the-synthetic-log)).

### 3.8 How it reaches production

#### D30. No integration branch

Every pull request goes to `main`. Reasons:

- PRs 1–5 change no screen. PR 2 makes the session log the rejected keys and the reveal; PR 4 makes a slip "hard". Production keeps working.
- The screens turn their features on one at a time ([D21](#d21-the-session)); between two pull requests a session shows the kinds built so far.
- The one reset, schema 8, is PR 2; M4 comes first.
- Before P14 only the maintainer uses production (ADR 061).

### 3.9 Documents and decision records

- **ADRs,** each with the next free number when its pull request is opened (today the last is 118; the expected numbers follow):
  - **119** in PR D: the P9 design export (the session screen, every task type, the round, the stroke order, the report dialog), and what it changes in the code or the spec;
  - **120** in PR 1: words written in kana in the pipeline (the port, the learnable filter, the exclusion list as part of the pipeline, the order by reading; the JLPT lists no longer select words);
  - **121** in PR 2: the log and sync format 4 (`misses`, `w`, `mismatch`, `script`, the rule keys, `hint` as a reveal, the shortest encoding, format-3 pages still read, schema 8);
  - **122** in PR 4: the fold of P9 (verdicts and what they drive, a slip as a correct recall with a hint, contrast's confusion with the option chosen, one task per moment, the recent words, the rules' state, the `word` pace);
  - **123** in PR 5: the session plan in the model (the features, words of the selected track only as in Q1, the order of a session, the precedence of the mix, the contrast set without shared spellings, find the error on words of at most 9 kana, the run's kana as in Q4, the forecast and the outline on the kana planner). It amends ADR 118, point 7, for the run;
  - **124** in PR 6: the session's strings and styles out of the first load (the `session` part, the lazy stylesheet), and the feedback of D23 with the pair differences;
  - **125** in PR 9: the stroke data and the origin kanji from KanjiVG (the choice ADR 099 left to P9) and the origins table in the engine.
- PRs 3, 7, 8, 10, 11, 12 and 13 need no ADR: the engine's change is ADR 117's, and the screens follow the export and this plan. One that decides something new takes the next number.
- **A-items** in [decisions.md](docs/spec/decisions.md): PR 4 adds A53 (a word is one recall per kana; a slip is "hard"; a rule error grades no kana; ADRs 117, 118, 122); PR 5 adds A54 (the session: a word after every 5 kana tasks of the selected track, the closing word, the round, the mix; ADRs 118, 123). A47 gets "Amended by A53, A54".
- `docs/architecture/` changes with the code: `model.md` (PRs 4, 5), `sync.md` and `entities.md` (PR 2), `entities.md` (PR 7: `entities/prompt`), `pages.md` (PRs 6, 7, 8, 10, 11, 12), `quality-gates.md` (PR 7: content chunks and the latency gate).
- `README.md`: how a session looks (PRs 6, 7), the shipped content and its credits (PRs 7, 12).
- `docs/README.md` gets a row for this plan in this pull request; PR 13 removes it.
- `AGENTS.md` does not change.

### 3.10 Spec changes

| #   | Change                                                                                                                                                   | Spec file                                   | In PR    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------- |
| S1  | P9 specified in full: its acceptance                                                                                                                     | `phases.md`                                 | the plan |
| S2  | "Words": the rule of D1 in place of steps 2–3 for words, the learnable filter, the exclusion list, the order by reading; the JLPT lists for phrases only | `content.md`                                | 1        |
| S3  | Events of format 4 (D3, D4); schema 8 in "Schema changes"; the data model's events                                                                       | `storage-sync.md`, `metrics.md`             | 2        |
| S4  | Sync format 4; `400` for another `v`                                                                                                                     | `backend.md`                                | 2        |
| S5  | `readingTokens` (PR 1); rule errors and their golden rows (PR 3)                                                                                         | `engine.md`                                 | 1, 3     |
| S6  | Memory and grades: a slip, a word as recalls per kana, the rules, the pace `word`; accuracy by verdict; A53                                              | `learning.md`, `metrics.md`, `decisions.md` | 4        |
| S7  | The learning session: the plan (cadence, start, recent words, closing word, round, the mix, the rules, the run) and its constants; A54                   | `learning.md`, `decisions.md`               | 5        |
| S8  | The session screen: the frame, feedback that teaches, the round, the ticks, the summary's errors by verdict; the `session` part and the lazy styles      | `learning.md`, `frontend.md`                | 6        |
| S9  | Word tasks (the meaning after the answer, the closing word, the rule introductions); the content shipped and its budget row; JMdict on `/about`          | `learning.md`, `content.md`, `quality.md`   | 7        |
| S10 | The report action and dialog on word tasks                                                                                                               | `content.md`, `frontend.md`                 | 8        |
| S11 | KanjiVG: the source, the chunks, the credit                                                                                                              | `content.md`                                | 9        |
| S12 | The stroke order in the kana details; KanjiVG on `/about`                                                                                                | `metrics.md`, `content.md`                  | 12       |
| S13 | Contrast, transfer, build, hiragana or katakana? and find the error on the screen                                                                        | `learning.md`                               | 10       |
| S14 | The fluency run on the screen; its keys on the hot path                                                                                                  | `learning.md`, `frontend.md`                | 11       |
| S15 | The "Closed" line of P9; the "End of P9" budget column                                                                                                   | `phases.md`, `quality.md`                   | 13       |

## 4. Design brief

The design session (M1) is drawn in a workbench artifact `Nekotype · P9 design`, moved into the design-system artifact and exported by PR D ([design workflow](docs/design/workflow.md), [ADR 106](docs/adr/106-design-sessions-in-a-workbench-artifact.md)). This section is its brief: what each screen shows, every state it has, and proposals. **The proposals are not decisions:** the session may draw something else, and the export decides. PR D writes the numbers of the design decisions (from 159) into the last column of 4.2.

The maintainer expects a lot of this session (ADR 116, point 7): the session screen as a whole is to become better and more interesting, not only to gain places for the new tasks. Decision 152 drew those places; this session replaces them.

### 4.1 Data and states by screen

Names are those of [section 3](#3-decisions).

**The session screen, every task**

- Data: `SessionTask` and its `TaskView`; the session line (`count` of `total`; in the round, `roundCount` of `roundSize`); the ticks (`misses`, the round's ticks); the notice of D23 (the answer and the right kana, the pair's difference, the promise); the hint line; "Leave session".
- States: each kind before, during and after its answer; right, slip and wrong (confused, not remembered); a wrong answer the round will not bring back (round full); the first and the last task of the round; the hidden tab; the window without focus; touch, with the on-screen keyboard; the phone at 360 px.
- Rule: a keystroke renders nothing; the screen changes through classes, text and transforms ([frontend.md](docs/spec/frontend.md), "Hot path"); a choice renders once.

**A word, and the closing word**

- Data: `word.text`, its kana (`keys`) and rules; the romaji typed per kana; each kana's verdict; a reveal; the meaning in English (both interface languages); `closing`.
- States: typing (the current kana; a merged っX; ー); a rule error; a wrong kana; a slip; Esc on a kana; done right; done with errors; the meaning, short and at 60 characters; a long word of about 10 kana; the closing word; `report a problem` and its dialog (reasons, comment, Turnstile, sending, sent, check failed, send failed, check not loaded, offline).

**A rule introduction:** っ or ー, its rule in one line, and an example word with its romaji as a ghost hint to type; shown again (`again`) after 2 errors in a row.

**Contrast:** the romaji as the prompt; 2–4 options from the kana's contrast set; after an error the pair side by side with its difference.

**Transfer:** the introduction shows the katakana with its hiragana and, for the pairs that share it, the origin kanji drawn in strokes (`加 → か, カ`); the task shows the hiragana as the prompt and 4 katakana options.

**Build:** the introduction shows the parts and the kana (`か + ゛ → が`, `き + ゃ → きゃ`); the task shows the parts as the prompt, and the romaji is typed.

**Find the error:** the word (2–9 kana) with the romaji under each kana, one of them wrong; a pick by number or click; after it, the odd kana marked with both romaji.

**Hiragana or katakana?:** one kana; two options; then right or wrong.

**The fluency run:** 8–12 kana in a line; the caret moves through them; each kana takes its state as it is typed; no timer, count, speed or score; the end of the run.

**The session summary:** as decision 148; `confused` from `wrong` verdicts, slips left out. Optional: the kana the round brought back right.

**Kana details:** the stroke order of each glyph of the kana (a yōon, two), in order and numbered; loading and failure keep the place; reduced motion.

**`/about`:** "Sources and licences": JMdict and EDRDG (CC BY-SA 4.0) for the words and their meanings; KanjiVG (CC BY-SA 3.0, Ulrich Apel) for the stroke order and the origin kanji; the terms as now.

### 4.2 Proposals

| #   | Item                    | Proposal                                                                                                                                                                                                                                                                                                                          | Decision |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| a   | The session as a whole  | One frame for every kind: the session line and ticks on top, a caption naming the kind over the prompt (`new kana`, `word`, `which one?`, `find the error`, `hiragana or katakana?`, `run`, `rule`), the prompt, the answer area, the notice line, the hint line. The kind is felt through the caption and the form of the prompt |          |
| b   | Between tasks           | The answer is held (`ANSWER_PAUSE_MS`) and the next task replaces it in place, with a short fade of a motion token and none under reduced motion. A result to read (a meaning, a wrong choice) waits for Enter, Space or a click                                                                                                  |          |
| c   | Session line and ticks  | Decision 149 kept: a word or a run is one tick. The round's ticks follow after a gap under `round`, and the line reads `round · 1 of 3`                                                                                                                                                                                           |          |
| d   | Feedback after an error | In the notice line, two kana side by side with their romaji, the learner's answer and the right one (`ツ tsu · シ shi`); under it the pair's difference; then `it comes back at the end of the session`. A choice keeps its marks as today                                                                                        |          |
| e   | A slip                  | No notice; the tick stays right; the rejected key flashes as today                                                                                                                                                                                                                                                                |          |
| f   | The round               | Its first task's notice says `3 kana you missed, once more`; its tasks are recalls in the frame of a                                                                                                                                                                                                                              |          |
| g   | A word                  | The word large in the place of the kana, sized for up to about 10 kana; the caret under the current kana; the romaji under each kana as it is typed; each kana takes its state when done; a merged っX reads as one; Esc shows the current kana's romaji                                                                          |          |
| h   | The meaning             | Once the word is done, its English meaning under it, `report a problem` / `сообщить об ошибке` as a text button, and `Kbd enter` to go on                                                                                                                                                                                         |          |
| i   | The closing word        | A word task with the caption `a word of today's kana` / `слово из сегодняшних кан`                                                                                                                                                                                                                                                |          |
| j   | Rule introductions      | As a kana introduction: the mark large (`っ`, `ー`), one line (`っ doubles the next consonant: きって → kitte`), the example with its ghost romaji; shown again with `once more`                                                                                                                                                  |          |
| k   | Contrast                | As a recognition, with 2–4 options of similar shapes; after an error the pair large side by side with the difference                                                                                                                                                                                                              |          |
| l   | Transfer and its origin | The introduction: the origin kanji in strokes, then the hiragana and the katakana (`加 → か · カ`), or the pair alone; the task: the hiragana as the prompt and 4 katakana options                                                                                                                                                |          |
| m   | Build                   | The introduction: the parts and the result (`か + ゛ → が`); the task: the parts as the prompt, the romaji typed as in a recall                                                                                                                                                                                                   |          |
| n   | Find the error          | The word with the romaji under each kana, the kana numbered; a number key or a click picks; after the answer the odd kana is marked with both romaji                                                                                                                                                                              |          |
| o   | Hiragana or katakana?   | The kana large; two options numbered 1 and 2                                                                                                                                                                                                                                                                                      |          |
| p   | The fluency run         | The kana in one line (wrapping on a phone), the caret moving through them, each kana taking its state as typed; no timer, count or speed; at the end `done` and Enter                                                                                                                                                             |          |
| q   | The report dialog       | The shared `Dialog`: the word and its meaning, the reason (a `Segmented` of three, or what the export chooses), an optional comment, the Turnstile widget, `send`; the states of decisions 114–117 and 127                                                                                                                        |          |
| r   | Stroke order            | In the place of decision 152 in the details: each glyph with its strokes numbered in order; `play` draws them one by one, and under reduced motion every stroke is shown with its number; a yōon shows both glyphs                                                                                                                |          |
| s   | `/about`                | "Sources and licences" before the terms: JMdict and EDRDG for the words, KanjiVG for the stroke order and the origin kanji                                                                                                                                                                                                        |          |
| t   | The summary             | Decision 148 kept; `confused` without slips; optionally the kana the round brought back right                                                                                                                                                                                                                                     |          |

**Constraints for the session:**

- one dark theme; colours, sizes and motion from tokens only;
- `KanaTask` stays the task's component and its controller the DOM writer: a keystroke renders nothing, a choice and an answer once;
- the keyboard first: typed tasks by romaji, choices by number keys (1–4, 1–2, 1–9), Enter, Space or a click after a held result, Esc to reveal; every control named for screen readers; a phone by tap, with the on-screen keyboard open during typed tasks;
- no score, record, timer or kana per minute (ADR 093);
- the session's CSS outside the initial CSS ([D28](#d28-strings-and-styles)) and within the lines of [D29](#d29-budgets); fonts within their budgets, and any new glyph (`゛`, `゜`, `+`, `→`) listed under "Glyphs to add to subsets";
- every string in en and ru with key parity, interface copy in lower case; meanings in English in both languages, after the answer only;
- no data beyond section 3: a screen that needs other data stops the session and goes to the maintainer before the export; PR D adds the contract with the maintainer's consent.

### 4.3 Rounds

The session runs in four rounds ([design workflow](docs/design/workflow.md)):

1. The session frame with recall, recognition and introduction; feedback after an error; the slip; the round (4.2 a–f).
2. Words: the word task, the meaning, the closing word, the rule introductions and the report dialog (g–j, q).
3. The other kinds: contrast, transfer with the origin, build, find the error, hiragana or katakana?, the fluency run (k–p).
4. The stroke order in the details, `/about` and the summary (r–t).

## 5. Answered questions

### Q1. Words of the other track

**Question.** While the selected track has fewer than 25 readable words, should a session take words from the other track? A learner who learned the basic hiragana and switched to katakana reaches 25 katakana words only after 1–2 days.

**Answer (2026-11-27):** no. Only the selected track: words start once it has 25 readable words and come from it alone ([D12](#d12-the-session-plan), [D13](#d13-the-order-of-a-session)).

### Q2. What the notice says after an error

**Question.** The learner's answer next to the right one only, or also a line on how the two kana differ, as decision 152 sketched (`ぬ, not め: ぬ ends with a loop`)?

**Answer (2026-11-27):** both. The answer and the right kana side by side, and a line for each of the 47 pairs of the similar table in en and ru, drafted in PR 6 and read by the maintainer before its merge ([D23](#d23-feedback-that-teaches), M6).

### Q3. The origin kanji in a transfer

**Question.** ADR 099 introduces a katakana next to its hiragana "with their shared origin where there is one" (か and カ from 加), and the fonts hold no kanji. Draw the origin kanji, or show the pair alone?

**Answer (2026-11-27):** draw it in strokes from KanjiVG, for the pairs that share it ([D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg), [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen), M7).

### Q4. Which kana are slow for a fluency run

**Question.** ADR 118 gives a run when "at least 8 learned kana are accurate and slower than their pace". Kana slower than the line between good and hard are seldom eight. Take the slowest of the accurate kana, or keep the literal rule?

**Answer (2026-11-27):** the slowest of the accurate kana: a run when at least 8 learned kana have an accuracy of at least 0.8, made of the 12 slowest of them by median time ([D16](#d16-the-fluency-run)).

## 6. Maintainer's manual steps

### M1. The design session — before PR D

An agent runs the session by the [design workflow](docs/design/workflow.md) in a workbench artifact `Nekotype · P9 design`, by [section 4](#4-design-brief), in the four rounds of 4.3. Each round starts with the agent's questions (at most four) or, when the maintainer asks for it, with the variants the agent recommends; the maintainer's remarks come in the chat. After the last round the agent moves the approved variants into the design-system artifact as decisions from 159.

Check after approval: `decisions.md` has the new decisions after 158; every kind of `SessionTask` has a preview in each of its states; no P9 state is a dashed place any more. The workbench is deleted after PR D is merged, with the maintainer's confirmation.

### M2. The word sample — before PR 1 is merged

The maintainer reads `packages/content/audit-words.md` of PR 1 and names each word to leave out, with its reason. The executor adds them to `word-exclusions.json`, builds again and updates the sample, until the maintainer approves. Write "done" with the date under PR 1 in [section 7](#7-pull-requests).

### M3. KanjiVG mirrored — before PR 9

The executor of PR 9 downloads the archive of [D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg), checks that it holds the kana, and gives the maintainer its sha256 and the release notes (the source, the licence CC BY-SA 3.0, the attribution). The maintainer creates the release `content-sources-YYYY-MM-DD` with the archive as its asset ([ADR 068](docs/adr/068-content-sources-mirrored-as-release-assets.md)), or tells the executor in the chat to create it with `gh release create`. Write "done" under PR 9.

### M4. Sync before PR 2 is merged

PR 2 raises `SCHEMA_VERSION` to 8, and the reset deletes what a device has not sent. On every device where the maintainer is signed in: open `/settings` online and wait for `synced`. Then merge PR 2.

### M5. Production check of PR 2

After PR 2 is deployed:

1. On `https://nekotype.pages.dev` the application starts as a guest with default settings (the reset).
2. Sign in: the log of format 3 comes back by the pull; the home and `/progress` show the account's progress.
3. A session ends with `synced` in `/settings`.
4. Write "done" with the date under PR 2.

### M6. The pair differences — before PR 6 is merged

The maintainer reads the 47 lines of [D23](#d23-feedback-that-teaches) in English and Russian, which the PR lists in a table, and approves or corrects them. Write "done" under PR 6.

### M7. The origins table — before PR 9 is merged

The maintainer reads the table of [D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg) (each hiragana, its katakana and their kanji, with the source), which the PR lists, and approves or corrects it. Write "done" under PR 9.

### M8. Production check of the session — after PRs 11 and 12, before PR 13

On a desktop and a phone:

- once 25 words are readable, a word after every 5 tasks, its meaning after the answer, and a closing word;
- an error with its feedback, and the round at the end;
- a rule introduction; a contrast, a transfer with its origin, a build, a find-the-error, a hiragana-or-katakana and a fluency run, as their conditions arise on the maintainer's progress;
- a report sent from a word; the stroke order in a kana's details; the credits on `/about`.

Write "done" with the date under PR 13.

## 7. Pull requests

**The screens follow the export.** Cards 6, 7, 8, 10, 11 and 12 are rewritten by PR D against the design export (decisions from 159, ADR 119); until then their screens are what section 4 proposes. Cards 1–5, 9 and 13 do not depend on the export, but they start after PR D too (ADR 116, point 7). The maintainer approves the rewritten cards with PR D.

Common to all: the branch is cut from fresh `main`; the acceptance items are those of [phases.md](docs/spec/phases.md), numbered in the [table at the end](#acceptance-items-and-pull-requests); sizes are changed lines with tests, a guide to what one executor session holds.

| PR  | Depends on                 | Can run in parallel with |
| --- | -------------------------- | ------------------------ |
| D   | M1                         | —                        |
| 1   | D; M2 before the merge     | 2, 3, 9                  |
| 2   | D; M4 before the merge     | 1, 3, 9                  |
| 3   | D                          | 1, 2, 4, 9               |
| 4   | 2                          | 1, 3, 9                  |
| 5   | 1, 4                       | 3, 9, 12                 |
| 6   | 5; M6 before the merge     | 3, 9, 12                 |
| 7   | 3, 6                       | 9, 12                    |
| 8   | 7                          | 9, 12                    |
| 9   | D, M3; M7 before the merge | 1–8                      |
| 12  | 9                          | 5–8                      |
| 10  | 8, 12                      | —                        |
| 11  | 10                         | —                        |
| 13  | all, M8                    | —                        |

PRs 6, 7, 8, 10 and 11 all change the session (`pages/learn/model/session.ts`, `KanaTask`), so they go one after another. Sign-in is hidden on previews: what needs a session is checked locally (`pnpm run dev` with `pnpm run dev:api`) and, after the merge, by the maintainer on production.

### PR D — Design export

- **Branch:** `docs/p9-design`. **Depends on:** M1 (approved by the maintainer).
- **Goal.** The approved design exported from the artifact into `docs/design/source/` (never edited there by hand), and this plan brought in line with it.
- **Docs:** `docs/design/source/` (`README.md` "Learning session" and every section the session changes, `decisions.md` from 159, `tokens.json`, the component guidelines, `bundle.js`, `bundle.css`, `index.d.ts`, new or removed component folders); `docs/design/README.md` (the decisions it holds); ADR 119; the token CSS and `tokens.test.ts` only if tokens change; in this plan: the decision numbers in the last column of 4.2, the cards of PRs 6, 7, 8, 10, 11 and 12 rewritten against the export (layout, components and strings in en and ru), and section 3 amended where the export needs data it did not give, with the maintainer's consent.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm run docs:check` passes; every row of 4.2 names a decision; the rewritten cards name the export's components and strings; the maintainer approved them; the workbench is deleted after the merge.
- **Size:** documents only.

### PR 1 — Words written in kana

- **Branch:** `p9-01-words-content`. **Depends on:** PR D; M2 before the merge.
- **Goal.** The words of [D1](#d1-words-written-in-kana) in the committed chunks, and `readingTokens` of [D5](#d5-reading-tokens-and-rule-errors), which the pipeline needs first.
- **Creates:** `packages/engine/src/data/reading.ts` and its test; `packages/content/word-exclusions.json`; `packages/content/audit-words.md` (generated).
- **Changes:** `packages/engine/src/index.ts` (`readingTokens`, `ReadingToken`); `packages/content/src/jmdict/` (the `misc` and `pos` of a sense), `src/words.ts` (`selectKanaWords`; the JLPT path no longer selects words), `src/build.ts` (the selection, the learnable filter, the exclusion list, the sample, the report's counts), `src/types.ts`, the tests and fixtures; `apps/web/src/entities/prompt/content/` (the word chunks, `manifest.json`); `glyphs.txt` and the subset if they change; `packages/content/README.md`.
- **Tests:** `readingTokens` (a yōon, an extended katakana, a merged and a standalone っ, ー, a small kana alone, ゐ, ヶ, an empty string); each step of the rule on fixture entries (kanji with and without `uk` on the first sense, each priority tag by script, each unfit tag anywhere, each first-sense tag, a name, grammar only and grammar mixed with a noun, no English gloss, not learnable, on the exclusion list, homonyms merged, the order by reading); the build is reproducible (two builds, the same bytes).
- **Acceptance:** 2 (the content).
- **Docs:** ADR 120; S2; S5 (`readingTokens`).
- **Preview URL:** nothing changes: no chunk is imported yet.
- **Done when:** `verify:quick` passes; the description shows the counts of the port before the exclusion list (1,077 and 828), the build report and the chunk sizes in gzip (each ≤ 40 KB); M2 is done.
- **Size:** about 700 lines, plus the generated files.

### PR 2 — Log format 4

- **Branch:** `p9-02-log-format-4`. **Depends on:** PR D; M4 before the merge.
- **Goal.** [D3](#d3-events-of-format-4) and, for the tasks that exist, [D4](#d4-what-each-task-logs): a recall logs its rejected keys and the reveal.
- **Changes:** `packages/shared` (`types.ts`, `log-codec.ts`, `sync-format.ts`, `runtime.ts`); `apps/api` (`routes/sync.ts` and its tests); `apps/web/src/shared/lib/idb/schema.ts` (8; the comment names format 4); `entities/learn` (`AnswerInput.misses`, the store writes `misses` and `w: null`); `pages/learn/model/session.ts` (a recall counts its rejected keys up to 9 and sets `hint` on Esc and on "show the romaji"); every producer of events (`packages/model/src/testing/`, `syntheticLog`, the simulator's adapters: `misses` 0 and `w` null); the fold ignores an `intro` of a rule until PR 4 (it is not an item).
- **Tests:** the codec round-trips the three forms; a page of format 3 decodes with `misses` 0 and `w` null and encodes back to the same bytes; the bounds (`misses` 10, `w` of 33 characters, a rule key with a task other than `word`, an `intro` of a rule); `POST /api/sync` answers `400` to `v` 3 and serves a row of format 3 to a pull; a database of schema 7 is reset; a recall with two wrong keys logs `misses` 2, with Esc `hint` true.
- **Acceptance:** 3.
- **Docs:** ADR 121; S3, S4; `docs/architecture/` (`sync.md`, `entities.md`).
- **Preview URL:** the application starts with empty data (schema 8) and behaves as before.
- **Done when:** `verify:quick` passes; CI is green with the sync e2e (`pnpm run e2e:sync`); after the merge the maintainer does M5.
- **Size:** about 700 lines.

### PR 3 — Rule errors in the engine

- **Branch:** `p9-03-engine-rule-errors`. **Depends on:** PR D.
- **Goal.** `Token.sokuon` and `Engine.ruleError` of [D5](#d5-reading-tokens-and-rule-errors).
- **Changes:** `packages/engine/src/matcher/` (`types.ts`, `compile.ts`, `observe.ts` or a module of its own, `engine.ts`), `src/index.ts`; the golden table; `apps/web/src/pages/learn/lib/prompt/engine.ts` and `index.ts` (`ruleError`).
- **Tests:** every golden row of D5 in both strictness modes; a property: on a prompt without っ or ー, `ruleError` is false for every rejected key; coverage ≥ 95%.
- **Acceptance:** 4 (the rule errors).
- **Docs:** S5 (the API, "Rule errors", the golden rows).
- **Preview URL:** nothing changes.
- **Done when:** `pnpm --filter @nekotype/engine test` passes with its thresholds; `verify:quick` passes.
- **Size:** about 400 lines.

### PR 4 — The grades of P9

- **Branch:** `p9-04-grades`. **Depends on:** PR 2.
- **Goal.** [D6](#d6-grades)–[D10](#d10-the-pace-of-a-word-and-the-synthetic-log) in `@nekotype/model`, with the learn store returning verdicts.
- **Creates:** `packages/model/src/verdict.ts` and its test.
- **Changes:** `grade.ts` (the rows), `fold.ts` (verdicts, the rules, one task per moment, `learner.words`), `pace.ts` (`word`), `stats.ts` (`RecallStat.ok`), `constants.ts` (`WORDS_RECENT`), `index.ts` (`Verdict`, `verdictOf`, `RuleState`), `testing/synthetic-log.ts` (`words`), `fold.properties.test.ts`; `apps/web/src/entities/learn` (`recordAnswer` returns a verdict, `recordTokens`, `stats()`, `introduce` of a rule); `apps/web/e2e/model-cost.spec.ts`, `home-cost.spec.ts` and the probe (the log with words); `packages/sim` (the adapters write the events of D4).
- **Tests:**
  - every row of D6 on synthetic answers, the slip at its edges (`misses` 1 with `ms` = line and line + 1; `misses` 2; `wrong` set; `hint`);
  - a log of format 3 folds to the same state and statistics as before the change (`syntheticLog({ answers: 40_000, seed: 1 })`);
  - the rules: an introduction, errors in a row, the count reset by a right token and by an introduction, an answer that introduces;
  - one task per moment: a word's events add 1 to `tasks`, share `lastTask` and push one interval; `learner.words` keeps 30, one per task;
  - the pace `word` apart from `recall`'s;
  - `verdictOf` equals the fold's verdict on every event of a seeded log with words and slips;
  - the property tests converge with words, rules and runs in the log.
- **Acceptance:** 4 (grades, convergence), 7 (the cost with words).
- **Docs:** ADR 122; S6; `docs/architecture/model.md`.
- **The simulator:** `pnpm --filter @nekotype/sim run p7` before and after in the description; the P7 lines hold (rule 4c).
- **Preview URL:** in a session, one wrong letter that is no kana's spelling, then the right romaji, on a learned kana: on `/progress` the kana stays learned and its accuracy does not drop.
- **Done when:** `verify:quick` passes; CI is green with the latency gate (`packages/model/` changed); the model chunk ≤ 12 KB.
- **Size:** about 1,200 lines.

### PR 5 — The session plan

- **Branch:** `p9-05-session-plan`. **Depends on:** PRs 1 and 4.
- **Goal.** [D11](#d11-words-in-the-model)–[D19](#d19-the-simulator-on-the-production-plan) in `@nekotype/model` and `packages/sim`. The application still asks `nextTask`; PR 6 switches it.
- **Creates:** `packages/model/src/words.ts`, `src/session.ts` and their tests; `packages/sim/src/p9.ts`.
- **Changes:** `packages/model/src/constants.ts` (D17), `src/index.ts`; `packages/sim/src/policies/production.ts` (`plan: true`), the harness (the new kinds), `package.json` (`p9`).
- **Tests:**
  - words: the start at 25 readable words of the selected track, never the other track's; a word after every 5 planner tasks; a slot that waits when no word is readable; no word of `learner.words` or of the session;
  - the closing word at the 30th task and when the planner ends early, only of the session's kana; none when the session's kana make no word;
  - the round: first-error order, at most 5, each once, `record` ignored once it started, null after it, empty when nothing was wrong;
  - the rules: due when not introduced and a word would be readable, or after 2 errors in a row; one a session, っ first; the 2 rule words after it;
  - the mix: each row of D14 with its precedence and its limit; the contrast set without shared spellings; find the error only on words of at most 9 kana;
  - the run: eligibility, the 12 slowest, the shuffle, none under 8 or without statistics;
  - each feature off falls back as D12 says;
  - a property over 200 seeded sessions: every kana task's kana is the one `nextTask` gave, no kind passes its limit, and every session ends.
- **Acceptance:** 5, 6.
- **Docs:** ADR 123 with the Status line of ADR 118; S7; `docs/architecture/model.md`.
- **The simulator:** the output of `pnpm --filter @nekotype/sim run p9` in the description, with each line of D19; the research tables (`p9-words`, `p9-tasks`, `p9-planner`) still reproduce.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm --filter @nekotype/model test` passes with its thresholds; the lines of D19 are met; `verify:quick` passes.
- **Size:** about 1,500 lines.

### PR 6 — The session screen

The export decides the screen; PR D rewrites this card.

- **Branch:** `p9-06-session-screen`. **Depends on:** PR 5; M6 before the merge.
- **Goal.** The session screen of the export on the session plan, with the kinds that exist (introduction, recall, recognition), the feedback of [D23](#d23-feedback-that-teaches) and the round (feature `round`); [D21](#d21-the-session), [D28](#d28-strings-and-styles).
- **Creates:** `shared/i18n/parts/session` (en, ru, with the pair differences); `pages/learn/lib/feedback.ts`; the session's stylesheet.
- **Changes:** `pages/learn/model/session.ts` (the plan, verdicts, the round, the ticks, the summary's errors), `lib/constants.ts` (`SESSION_FEATURES`), `lib/summary.ts`, `ui/session-screen.tsx`, `ui/session-runtime.tsx`, `session-loader.ts` (the part), `shared/ui/kana-task.tsx` and `task-controller.ts` (as the export draws them), `app/styles/index.css` (the session's styles out), `shared/i18n` (`DictionaryPart` gains `session`), `e2e/learn-session.spec.ts`.
- **Tests:** `session-screen.test.tsx` shows 0 renders per keystroke and at most 1 on the answer; a wrong recall shows the answer next to the right kana, the pair's difference for a pair of the table, the promise while the round has room and none when it is full; a slip shows no notice and keeps its tick; the round's ticks, line and order, `end` after it, and no `end` when the learner leaves during it; the summary lists wrong kana, not slips; the `session` part loads with the runtime; e2e: a session with an error ends with its round.
- **Acceptance:** 1 (the screen), 7 (the hot path), 8 (the round).
- **Docs:** ADR 124; S8; `docs/architecture/pages.md`; `README.md` (the session).
- **Preview URL:** a wrong answer shows your answer next to the right kana, their difference for a pair such as ぬ and め, and that the kana comes back; after the last task the round brings back the kana answered wrong; one wrong letter that is no kana's spelling, then the right romaji, leaves the tick as a right one.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; the budgets of D29 (the initial CSS goes down); M6 is done.
- **Size:** about 1,500 lines.

### PR 7 — Word tasks

The export decides the screen; PR D rewrites this card.

- **Branch:** `p9-07-words`. **Depends on:** PRs 3 and 6.
- **Goal.** [D20](#d20-words-in-the-app) and [D22](#d22-typed-answers-by-token); the features `word`, `closing` and `rule`; the meaning after the answer; JMdict and EDRDG on `/about`.
- **Creates:** `entities/prompt/index.ts`, `entities/prompt/model/content.ts` and their tests; `pages/learn/lib/typed-answer.ts` and its test; `e2e/learn-words.spec.ts`.
- **Changes:** `pages/learn/model/session.ts` (word, closing word and rule tasks), `lib/constants.ts`, `session-loader.ts` (the word chunk), the screen and `KanaTask` (the word, as the export draws it); `app/prefetch.ts`; `scripts/check-budget.mjs` and its test; `pages/about` (the sources section); `shared/i18n`; `e2e/latency.spec.ts` (a log in which words open, so word keystrokes are samples).
- **Tests:**
  - `tokenAnswers`: a plain word; `te` for って (a rule error, て right); `ta` for って (て wrong as た); a standalone っ; ー; a reveal on a kana and on a merged token (the rule and X); `misses` saturating at 9; the time of each token by A37 from the token before it;
  - only the selected track's words; a chunk that fails to load gives a session without words;
  - 0 renders per keystroke of a word; the meaning absent before the answer and shown after it; the closing word is the last task; a rule introduction logs an `intro` of the rule;
  - the budget test fails a content chunk that a route imports statically;
  - e2e: a word task, its meaning after the answer, and a rule introduction.
- **Acceptance:** 1, 2 (shipped lazily), 7, 8, 10 (JMdict).
- **Docs:** S9; `README.md`; `docs/architecture/` (`entities.md`, `pages.md`, `quality-gates.md`).
- **Preview URL:** from a fresh start, after the k row (25 readable words) a word comes after every 5 tasks; its meaning appears only after it is typed; the last task of a session is a word of its kana; before the first word with っ the rule is introduced; `/about` names JMdict and EDRDG.
- **Done when:** `verify:quick` passes; CI is green with the latency gate and word keystrokes among its samples; the word chunks are lazy and ≤ 40 KB gzip.
- **Size:** about 1,500 lines.

### PR 8 — The report dialog

The export decides the screen; PR D rewrites this card.

- **Branch:** `p9-08-report`. **Depends on:** PR 7.
- **Goal.** [D26](#d26-the-report-dialog).
- **Creates:** `pages/learn/ui/report/` (restored from 753df9f), `pages/learn/lib/turnstile.ts`, their tests; `e2e/sync/report.spec.ts`.
- **Changes:** the word task (the action after the answer); `shared/ui` if the export brings back `Select` or a `Textarea`; `shared/i18n`; the e2e server's Turnstile verifier only if the test needs it.
- **Tests:** the dialog in each state with a fake Turnstile loader and a fake request (sending, sent, check failed, send failed, check not loaded, offline); the request's body; the Turnstile script requested only when the dialog opens; the focus back to the session after closing; e2e on the sync configuration: from a word task, open the dialog, send, and see the server's answer.
- **Acceptance:** 9.
- **Docs:** S10; `docs/architecture/pages.md`.
- **Preview URL:** after a word is typed, `report a problem` opens the dialog; the check passes and the report is sent; offline the action is disabled.
- **Done when:** `verify:quick` passes; CI is green with the e2e; the dialog is a lazy chunk.
- **Size:** about 700 lines, much of it restored.

### PR 9 — KanjiVG data

- **Branch:** `p9-09-kanjivg`. **Depends on:** PR D, M3; M7 before the merge.
- **Goal.** [D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg): the stroke chunks, the origins chunk and the origins table.
- **Creates:** `packages/content/src/kanjivg/` (reading a KanjiVG SVG: the strokes in order and their numbers) and the stroke build; `packages/engine/src/data/origins.ts` and its test; `strokes-hiragana.json`, `strokes-katakana.json`, `origins.json`.
- **Changes:** `packages/content/sources.json`, `src/fetch.ts`, `src/build.ts`, the manifest; `packages/engine/src/index.ts` (`kanaOrigins`, `originOf`); `NOTICE.md` ("Third-party data", "Mirrored content sources"); `packages/content/README.md`.
- **Tests:** the reader on fixture SVGs (order, the numbers, one decimal); every character of every learnable kana has a glyph; every entry of the origins table is a basic hiragana with a katakana pair; each chunk ≤ 40 KB gzip.
- **Acceptance:** 10 (the data).
- **Docs:** ADR 125; S11.
- **Preview URL:** nothing changes: no chunk is imported yet.
- **Done when:** `verify:quick` passes; the build is reproducible; M7 is done.
- **Size:** about 800 lines, plus the generated files.

### PR 12 — Stroke order in the kana details

The export decides the screen; PR D rewrites this card.

- **Branch:** `p9-12-stroke-order`. **Depends on:** PR 9.
- **Goal.** The details of [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen) and the KanjiVG credit on `/about`.
- **Changes:** `features/kana-details` (the stroke order, its loading); `entities/prompt` (`loadStrokes`); `shared/i18n/parts/details` and `about`; `pages/about`; `e2e/progress.spec.ts` (the details show the strokes).
- **Tests:** a kana, a yōon and a kana with a dakuten draw their strokes in order with numbers; loading and failure keep the place; reduced motion draws every stroke at once; the chunk is not loaded until a dialog opens.
- **Acceptance:** 10.
- **Docs:** S12; `docs/architecture/pages.md`.
- **Preview URL:** a kana's details on `/progress` show its stroke order; `/about` names KanjiVG.
- **Done when:** `verify:quick` passes; CI is green with the e2e; the stroke chunks are lazy and ≤ 40 KB gzip.
- **Size:** about 500 lines.

### PR 10 — Choice and build tasks

The export decides the screen; PR D rewrites this card.

- **Branch:** `p9-10-choice-tasks`. **Depends on:** PRs 8 and 12.
- **Goal.** [D24](#d24-choice-and-build-tasks); the features `contrast`, `transfer`, `build`, `script` and `mismatch`; the origin kanji of [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen).
- **Changes:** `pages/learn/model/session.ts`, `lib/constants.ts`, `lib/distractors.ts` if transfer needs it, `session-loader.ts` (`origins.json` when the track is katakana), the screen and `KanaTask` (as the export draws them); `shared/i18n`.
- **Tests:** each kind's view, keys and log (D4): contrast's options shuffled and its `alt`; transfer's options of katakana; build typed and timed; hiragana or katakana by 1 and 2; find the error by number and by click, `ok` only at `index`; a build and a transfer introduction (the origin drawn when the table has one, the pair alone without the chunk); one render per choice.
- **Acceptance:** 1, 7.
- **Docs:** S13; `docs/architecture/pages.md`.
- **Preview URL:** on a log with a confused pair, a recognition of its kana becomes a contrast; on katakana with the hiragana learned, an introduction shows the pair and its kanji; が is introduced and practised from か and ゛; one find-the-error and one hiragana-or-katakana come in a session when their conditions hold.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; budgets within D29.
- **Size:** about 1,300 lines.

### PR 11 — The fluency run

The export decides the screen; PR D rewrites this card.

- **Branch:** `p9-11-fluency`. **Depends on:** PR 10.
- **Goal.** [D25](#d25-the-fluency-run-on-the-screen); the feature `fluency`.
- **Changes:** `pages/learn/model/session.ts`, `lib/constants.ts`, the screen and `KanaTask` (the run, as the export draws it); `shared/i18n`; `e2e/fluency.spec.ts`.
- **Tests:** the run's kana are the plan's; a keystroke renders nothing and the end at most once; one `fluency` event per kana at one moment, with `misses`, `hint` and `wrong`; a wrong kana goes to the round; no timer or number on screen; e2e: a seeded log with 8 accurate learned kana gives a run at the 15th task, typed to its end.
- **Acceptance:** 7, 8.
- **Docs:** S14; `docs/architecture/pages.md`.
- **Preview URL:** with 8 accurate learned kana, the 15th task of a session is a run of the slowest of them, with no timer or count; a wrong kana in it comes back in the round.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; budgets within D29; after the merge, with PR 12 merged, the maintainer does M8.
- **Size:** about 800 lines.

### PR 13 — Close the phase

- **Branch:** `p9-13-close`. **Depends on:** every other pull request, M8.
- **Does:**
  - the leftovers audit, with its command and result in the description: `git grep -n -E "N5–N4 by reading|no content is shipped before P9|before P9|decision 152|none exists before P9|places of"` over `apps`, `packages`, `scripts`, `docs/spec`, `docs/architecture`, `docs/design/source`, each hit removed or explained (research, ADRs and the archive are history);
  - the export against the code: each kind of task, the round, the feedback, the report dialog, the stroke order and `/about` match their previews in the design artifact (a list in the description);
  - `pnpm run build && pnpm run budget`, and the CI figures of the latency, `model-cost` and `home-cost` tests;
  - `pnpm --filter @nekotype/sim run p9` on the merged code;
  - `docs/research/2026-11-NN-p9-acceptance.md` (the day of the check): a row per acceptance item with its line, its measure and its proof, and its row in `docs/README.md`.
- **Docs:** S15; `README.md` and `docs/architecture/` reread against the code; `docs/adr/README.md` has ADRs 119–125; this file moved to `docs/archive/p9-plan.md` with a note on top, and the link of P9 in `phases.md` pointed there; its row in `docs/README.md` removed.
- **Done when:** every row of the table below names a passing test or check in the description.
- **Size:** about 400 lines, documents.

### Acceptance items and pull requests

The items of the P9 acceptance in [phases.md](docs/spec/phases.md), in its order.

| #   | Acceptance item                                                                                                                                                                  | PR                        | Proved by                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | The design comes first, draws every P9 task in full and matches the code; key parity; every task works from the keyboard and is named for screen readers                         | D, 6, 7, 8, 10–13         | ADR 119 and the export; DOM tests by role and name; the parity test; the check of PR 13       |
| 2   | The word chunks: the rule, at most 40 KB gzip each, by dynamic import only; the maintainer read a sample                                                                         | 1, 7                      | the build report, `audit-words.md` and M2; `check-budget.mjs`                                 |
| 3   | Format 4: its events, format-3 pages read, `400` for a batch of format 3, a database of schema 7 reset                                                                           | 2                         | `log-codec.test.ts`, the API's sync tests, `database.test.ts`                                 |
| 4   | Every grade of ADR 117 and ADR 118, point 5, has a test; the rule errors are golden tests; two devices converge with words, rules and runs                                       | 3, 4                      | `grade.test.ts`, `verdict.test.ts`, the engine's golden tests, `fold.properties.test.ts`      |
| 5   | The session plan has a test for each rule of ADR 118                                                                                                                             | 5                         | `session.test.ts` of the model                                                                |
| 6   | The simulator runs the production plan and meets the lines of D19                                                                                                                | 5, 13                     | `pnpm --filter @nekotype/sim run p9` in PR 5 and in the acceptance note                       |
| 7   | A keystroke of a typed task renders nothing and its answer at most once; the latency test holds with word keystrokes; the fold, the forecast and the home's line hold with words | 4, 6, 7, 10, 11, every PR | `session-screen.test.tsx`; `latency.spec.ts`, `model-cost.spec.ts`, `home-cost.spec.ts` in CI |
| 8   | An e2e plays a session with a word, its meaning and the round, and one with a fluency run                                                                                        | 6, 7, 11                  | `learn-session.spec.ts`, `learn-words.spec.ts`, `fluency.spec.ts`                             |
| 9   | The report dialog on a word task sends with Turnstile, loads its script only when opened, and is disabled offline                                                                | 8                         | the dialog's DOM tests; `e2e/sync/report.spec.ts`                                             |
| 10  | Every learnable kana's details show its stroke order; KanjiVG, JMdict and EDRDG are credited on `/about`, KanjiVG in `NOTICE.md`                                                 | 7, 9, 12                  | the stroke tests; the details' DOM test; the `/about` test                                    |
| 11  | Every budget holds, with the lines of this plan                                                                                                                                  | every PR                  | `check-budget.mjs`; the figures of each pull request                                          |
| 12  | The spec describes P9                                                                                                                                                            | 1–12, 13                  | S1–S15; the audit of PR 13                                                                    |

## 8. Instructions for executor agents

One executor takes one pull request of section 7.

1. **Read first:** `AGENTS.md`; in this file sections 1, 8 and 9, your card in section 7, the decisions it names in section 3 and the ones they link; for a pull request with screens, section 4 and the export in `docs/design/source/`; the ADRs your decisions cite (116–118 for the model); the spec sections your card names. Check the Status table: every pull request yours depends on is merged and every manual step it waits for is marked done. If not, stop and tell the maintainer what is missing.
2. **Make no decision this plan does not hold.** Types, names, files, keys and constants of section 3 are copied as written. How a screen looks is the export's: build what it draws, with its names and strings. What the plan and the export leave open you do not fill by taste: ask the maintainer (in Russian) and wait.
3. **Deviations.** The code wins where it and the plan disagree. When a contract cannot be built as written (an API that does not exist or behaves otherwise, a name that clashes, a measured cost over a line, a rule that contradicts another one of the spec):
   - build the smallest change that keeps the decision's intent;
   - write it in the pull request's description under "Deviations from the plan", with the reason and what you checked;
   - change this plan in the same pull request: the decision's text, and any later card it affects.

   **Stop and ask instead** when the deviation would change a rule or a constant of the model (anything the simulator measures), the log or the sync format, behaviour the spec defines or the export draws, a budget line, or another pull request's scope.

4. **Rules of P9:**
   - a. The design comes first: no code pull request before PR D is merged, and no visual decision outside the export.
   - b. Words come from the selected track only, and a word's meaning is never shown before its answer.
   - c. The model's rules and constants are those of section 3. A change to `nextTask`, to the fold's rules or to a constant beyond section 3 stops the pull request; it needs a run of `pnpm --filter @nekotype/sim run p7` (and `p9` from PR 5) on the production model, an ADR, and the maintainer's consent.
   - d. `packages/sim` runs the production session plan, never a copy of its rules; the research options stay outside the production path.
   - e. Nothing new on the hot path: a key handler pushes a key (`TypedKey`, with `errorTarget` and `ruleError`) and updates the DOM through the controller; no plan, verdict, fold, `wrongKana`, `tokenAnswers` or IndexedDB access in it; recording is deferred; 0 renders per keystroke, at most 1 on the answer.
   - f. The raw keystroke log is never persisted: an event holds an outcome, and `misses` is a count.
   - g. Content comes from the pipeline: no generated chunk is edited by hand. The exclusion list, the origins table and the pair differences are read by the maintainer before their merge (M2, M7, M6).
   - h. A kind reaches the screen only through `SESSION_FEATURES`, in the pull request that builds it.
5. **Stay in scope.** Build what your card lists. Anything else you had to touch is named in the pull request description.
6. **Follow `AGENTS.md`:** the code rules (no `any`, no assertions, strings through i18n with `en` and `ru` in parity, injected time and randomness), the layer rules, the hot-path and budget rules. Never bypass a hook.
7. **Budgets.** Run `pnpm run build && pnpm run budget` before and after and write the figures of [D29](#d29-budgets) in the description. Above a line: stop and ask.
8. **Tests.** Write the tests your card lists and name, for each acceptance item you close, the test that proves it. Run the e2e files you touched on Chromium (`pnpm exec playwright test e2e/<file>.spec.ts --project=chromium`), `pnpm run e2e:sync` when a sync e2e changed, and `pnpm run e2e:latency` when `pages/learn`, `entities/learn/model` or `packages/model` changed (CI is the gate). Report results as they are.
9. **Documents** change in the same pull request: the spec items of [section 3.10](#310-spec-changes), the ADR named, `README.md` and `docs/architecture/` when the code they describe changed. A new ADR takes the next free number and a row in `docs/adr/README.md`.
10. **Finish:** when the work is done and `pnpm run verify:quick` passes, commit with a Conventional Commits message, push the branch (the pre-push hook runs the checks) and open the pull request against `main`. Its description lists: what changed, why, the deviations from the plan, anything outside the scope, what to check on the preview URL (from your card), the acceptance items closed with their tests, and the budget figures before and after. No AI attribution in commits or in the pull request. Never merge: the maintainer does.
11. **Mark the plan:** after `gh pr create`, set your row of the Status table to `done` with the pull request number, in a second commit on the same branch (`docs: mark P9 PR n done`).
12. **Communication:** with the maintainer in Russian; code, comments, commits and documents in English.

## 9. Risks

| Risk                                              | How it shows                                                                        | What to do                                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The design session takes long                     | No code pull request can start                                                      | ADR 116 puts the design first. It runs in four rounds that can be reviewed on different days (ADR 106); PRs 1–5 and 9 are ready to start the day PR D is merged                 |
| The export needs data section 3 does not give     | A preview shows something the plan does not compute                                 | Section 4's constraint: the session stops and asks before the export; PR D adds the contract with the maintainer's consent                                                      |
| The port of the selection differs from the script | Counts other than 1,077 and 828                                                     | Compare the readings by script, find the tag the parser reads otherwise, fix the port. A real difference of rule goes to the maintainer                                         |
| The rule lets unfit words through                 | The maintainer finds them in the sample                                             | The exclusion list (M2). A whole class of them is a change of the rule, written into content.md with the ADR of PR 1                                                            |
| KanjiVG lacks a character                         | The build of PR 9 fails on a kana (a small kana, a kana with a dakuten)             | Compose it from KanjiVG parts (the base and the mark) and record it as a deviation; a character that cannot be composed goes to the maintainer                                  |
| A content chunk passes 40 KB gzip                 | The figures of PR 1 or PR 9                                                         | Words: split a script's chunk by the first kana's row. Strokes: one decimal is already the rule; then a chunk per block of the path. Either is a deviation recorded in the plan |
| The fold slows with words                         | `model-cost.spec.ts` over 100 ms on the log with words (about 1.4 times the events) | Profile first: D9 keeps a word one task, and the word's events skip `noteTask`. Then stop and ask; the P7 options (a Worker, statistics folded apart) stand                     |
| The home misses its 300 ms                        | `home-cost.spec.ts` over 300 ms                                                     | The P8 plan's order: profile, split the forecast's plays into callbacks, a Worker only by an ADR                                                                                |
| The simulator misses a line                       | A number of D19 outside its line in PR 5                                            | Report the tables and the suspected cause (the mix, the run, the round); the maintainer decides; nothing is tuned                                                               |
| The forecast drifts with words                    | Its median error over 1 session in PR 5                                             | Stop and ask. The fix is to play the session plan with a word list in the forecast (D18), which needs the words on the home                                                     |
| A rule error is charged wrongly                   | A golden row fails, or a learner sees a kana sent back for っ                       | The rows of D5 are the contract; a spelling the rows miss (`ltu` forms, `cch`) gets a row first, then the fix                                                                   |
| Timing by token is off                            | A word's first kana always slow                                                     | Expected: it carries the time to start reading, which is why `word` has a pace of its own (ADR 117). `committedTimings` at the end of a word gives every token                  |
| The session runtime passes 20 KB                  | The figures of PRs 7, 10 or 11                                                      | Stop and ask; the run and the report dialog are the first to become chunks of their own                                                                                         |
| The schema reset loses unsent progress            | After PR 2 the account misses a device's last session                               | M4. Before the release nobody else uses production (ADR 061)                                                                                                                    |
| A stale tab of format 3                           | It gets `400` and stops syncing                                                     | A28 as designed: a reload loads the new client, whose schema reset clears its outbox                                                                                            |
| Turnstile in tests                                | The widget cannot run in CI                                                         | A fake loader in DOM tests and a stub script in the e2e; the real widget is checked by the maintainer in M8                                                                     |
| The report dialog steals the session's focus      | After closing, keys go nowhere                                                      | D26: closing gives the focus back to the session's input; a DOM test and the e2e check it                                                                                       |
| Interleaving still feels monotonous               | The maintainer's review in M8                                                       | The mix follows the model (ADR 118, point 7). A change of cadence or of the mix is a constant or a rule: a sim run and an ADR                                                   |
| A pull request outgrows its session               | Well past the size of its card                                                      | Propose a split to the maintainer instead of cutting scope                                                                                                                      |
