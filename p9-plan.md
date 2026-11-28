# P9 plan: learning methods and words

Working file of phase P9 ([phases.md](docs/spec/phases.md), item 10). It tells the executor of each pull request what to build, in which order, and which decisions are already made. It is not part of `docs/`: the last pull request of the phase moves it to `docs/archive/`.

- Written on 2026-11-27 against `main` at 8acf510 (PR 249 merged: part 3 of the P9 research and [ADR 118](docs/adr/118-the-p9-planner.md)). The research decided the scope, the grades and the planner in [ADR 116](docs/adr/116-words-written-in-kana-and-varied-tasks-in-p9.md), [ADR 117](docs/adr/117-grades-of-the-p9-task-types.md) and ADR 118; the maintainer answered this plan's four questions on the same day ([section 5](#5-answered-questions)).
- Changed on 2026-11-27, before the merge: the pull requests after PR 9 numbered in the order they run (10 the stroke order, 11 the choice tasks, 12 the fluency run).
- Changed on 2026-11-28 by PR D, against the design export (decisions 159–177, [ADR 119](docs/adr/119-the-p9-design.md)): the decisions in the last column of 4.2; D21, D23–D27 as the export draws them; with the maintainer's consent the data gain the part of the origin kanji a katakana kept (D2) and `roundKana` and `seen` of the session plan (D12); the cards of PRs 5, 6, 7, 8, 9, 10, 11 and 12 (numbered as before the review below).
- Changed on 2026-11-28, after PR D was merged, by a review of the plan against `main` at b95e250: the phase cut into 21 pull requests of at most about 900 lines, with the components apart from the session and the session's code split by mechanic, so the critical path is 7 pull requests instead of 10 ([section 7](#7-pull-requests)); the forecast with words measured before any code ([D18](#d18-the-forecast-and-the-outline)); a visual audit of the origin kanji (D2, M7); the design reference's names kept in the code ([D31](#d31-the-design-reference-in-the-code)); the session's chunks and an allowance per pull request decided in advance ([D29](#d29-budgets)); a synthetic log with the load of a P9 session (D10); the maintainer's answers Q5–Q8 ([section 5](#5-answered-questions)). The pull requests after PR D are numbered anew, in the order they can start.
- Where this plan and `docs/spec/` disagree, the spec wins until the pull request named here changes the spec. Every such change is listed in [section 3.11](#311-spec-changes) with its pull request.
- **Two kinds of content.** Section 3 holds the data, the rules and the computations as final contracts: types, names, files, keys and constants. An executor copies them and does not invent names. Everything that depends on how a screen looks is a brief for the design session ([section 4](#4-design-brief)): proposals, not decisions. The design export decides, and its decision numbers fill the brief's last column.
- **The screens follow the design export.** No code pull request started before PR D was merged (ADR 116, point 7). PR D (#251) rewrote the cards of the screens against the export; the review of 2026-11-28 cut them into the cards of section 7, which keep their layouts and strings.
- **Decisions are final, and the code may force a deviation.** An executor builds what this plan says and decides nothing on its own. Where the code makes a contract impossible or clearly worse, it deviates by the rule of [section 8](#8-instructions-for-executor-agents), item 3, and records the deviation here and in its pull request.
- Sections: [status](#status), [goal and scope](#1-goal-and-scope), [what was checked](#2-what-was-checked), [decisions](#3-decisions), [design brief](#4-design-brief), [answered questions](#5-answered-questions), [manual steps](#6-maintainers-manual-steps), [pull requests](#7-pull-requests), [executor instructions](#8-instructions-for-executor-agents), [risks](#9-risks).

## Status

The executor of a pull request fills its row ([section 8](#8-instructions-for-executor-agents), item 11). Every row goes to `main`: P9 has no integration branch ([D30](#d30-no-integration-branch)).

| PR  | Branch                 | Status | Pull request |
| --- | ---------------------- | ------ | ------------ |
| D   | `docs/p9-design`       | done   | #251         |
| 1   | `p9-01-engine`         | done   | #253         |
| 2   | `p9-02-log-format-4`   | —      | —            |
| 3   | `p9-03-session-lazy`   | —      | —            |
| 4   | `p9-04-kanjivg`        | —      | —            |
| 5   | `p9-05-words-content`  | —      | —            |
| 6   | `p9-06-grades`         | —      | —            |
| 7   | `p9-07-task-frame`     | —      | —            |
| 8   | `p9-08-stages`         | —      | —            |
| 9   | `p9-09-report-dialog`  | —      | —            |
| 10  | `p9-10-pair-lines`     | —      | —            |
| 11  | `p9-11-stroke-order`   | —      | —            |
| 12  | `p9-12-session-plan`   | —      | —            |
| 13  | `p9-13-words-client`   | —      | —            |
| 14  | `p9-14-mix-run`        | —      | —            |
| 15  | `p9-15-session-screen` | —      | —            |
| 16  | `p9-16-sim`            | —      | —            |
| 17  | `p9-17-word-tasks`     | —      | —            |
| 18  | `p9-18-choice-tasks`   | —      | —            |
| 19  | `p9-19-build-transfer` | —      | —            |
| 20  | `p9-20-fluency`        | —      | —            |
| 21  | `p9-21-close`          | —      | —            |

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
- the home, Progress and their insights, but for one part of the outline: once the track has had a word, the outline names the session's words (Q6); the forecast still plays the kana planner alone ([D18](#d18-the-forecast-and-the-outline));
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

Checked on 2026-11-28 against `main` at b95e250 (PR D merged), by the review of the plan.

| Item                     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The forecast with words  | `packages/sim` with the options of part 3 (`createProductionPolicy('hiragana', { words: { every: 5, minPool: 25, recent: 30, closing: true, mode: 'recalls', of: 'introduced' }, slips: 'hard', endRound: 5 })`, `slip` 0.03), 50 beginners over 30 days, the forecast of the next row made at the first session of each day (`forward: 1`, as P7's table). Without words: median error 1 session, bias 0, within ±1 session 76% of the forecasts shown. With words: the raw median is biased by −1 session (a word takes one task in six), and the history's correction brings the forecast shown to a median error of 1 session, bias 0, within ±1 in 79%. The line of D19 holds on hiragana; PR 16 measures the production plan on both tracks |
| The open page of the log | `appendEvents` reads `own:open` with `decodePage(…) ?? []` (`entities/learn/model/log.ts`): a tab of older code that cannot decode a page of format 4 takes it as empty and writes over it. Format 4 therefore keeps the schema reset of D3, and M4 guards it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Chunks                   | `vite.config.ts` puts all of `packages/model/src` into the chunk `model` (8.44 KB), which the learn store loads for the home; the session plan would grow it for a screen that does not use it. The learn store (`entities/learn`) is in the initial chunk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Budget headroom          | `pnpm run build && pnpm run budget`: initial JS 30.72 KB of the line 31.0 (0.28 KB left); initial CSS 7.75 of 8.0; session runtime 10.42 of 20.0; model 8.44 of 12.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| The design reference     | `KanaTask` in `bundle.js` is static markup plus `createTaskController`, the split of `shared/ui/kana-task.tsx` and `task-controller.ts`, with the same controller methods. `KanaWord` draws its caret and buffer from the props `cur` and `buffer`, `KanaParts` from `typing` and `buffer`: ported as they are, each keystroke would render. `index.d.ts` names the stroke data `StrokeGlyph { s, n?, small?, kept? }` and the pen `PEN { speed, min, lift }`                                                                                                                                                                                                                                                                                     |
| Word lengths             | The committed N5–N4 chunks: 3 (2–4) tokens a hiragana word and 4 (2–6) a katakana word (part 1, table 1); the brief draws words of up to about 10 kana. `syntheticLog({ words: true })` as D10 had it gave words of 3 kana, with no rules and no runs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Design export            | Decisions 159–177 (ADR 119); new components `KanaWord`, `KanaParts`, `Strokes`, `StrokeOrder`, `RadioGroup`, `Textarea`. The last ADR is 119                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

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
- **The sample.** The build writes `packages/content/audit-words.md`: 100 words of each script in the order of `sha256("audit:" + id)`, each with its reading, meaning and JMdict entry number, then every word of the exclusion list with its reason. The maintainer reads it before PR 5 is merged (M2).
- **Glyphs:** `glyphs.txt` and the Noto subset follow the content ([ADR 071](docs/adr/071-glyph-set-from-generated-content.md)); the font stays within 45 KB.

#### D2. Stroke data and the origin kanji from KanjiVG

KanjiVG is the source of the stroke order that ADR 099 left to P9. It holds each stroke as a centre line in writing order, and the same files draw the kanji a pair of kana comes from (Q3), so no font grows.

- **Source:** the latest release of `KanjiVG/kanjivg` on GitHub on the day of PR 4, its archive of the main SVG files (one file per character, named by its code point). It is pinned in `packages/content/sources.json` (URL, sha256, size, date, licence `CC BY-SA 3.0 (Ulrich Apel, KanjiVG)`) and mirrored as an asset of a new release `content-sources-YYYY-MM-DD` ([ADR 068](docs/adr/068-content-sources-mirrored-as-release-assets.md); M3).
- **Glyphs:** every character of every learnable kana of both tracks (each of the two characters of a yōon or an extended kana; a kana with a dakuten or handakuten as its own character), and the origin kanji of the table below. A character with no file fails the build.
- **Chunks** in `apps/web/src/entities/prompt/content/`: `strokes-hiragana.json` and `strokes-katakana.json` keyed by character, `origins.json` keyed by kanji, each at most 40 KB gzip:

  ```ts
  /** `StrokeGlyph` of the design reference (`index.d.ts`), with `readonly`. */
  type StrokeGlyph = {
    /** The path data of each stroke in writing order, in KanjiVG's 109 × 109 box, one decimal. */
    readonly s: readonly string[];
    /** The stroke chunks only: where each stroke's number stands (KanjiVG's stroke numbers), one decimal. An origin kanji has none: its numbers are never drawn. */
    readonly n?: readonly (readonly [x: number, y: number])[];
    /** The stroke chunks only, written when true: a small kana (ぁ ぃ ぅ ぇ ぉ ゃ ゅ ょ っ ゎ and their katakana), which the details draw at 70% from the bottom left (decision 174). */
    readonly small?: boolean;
    /** `origins.json` only: the indexes of the strokes of the part the katakana kept (decision 169 draws them in eye). */
    readonly kept?: readonly number[];
  };
  type StrokeChunk = Readonly<Record<string, StrokeGlyph>>;
  ```

  These are the reference's names and shapes, so `Strokes` and `StrokeOrder` take the chunks as they are ([D31](#d31-the-design-reference-in-the-code)).

- **The origins table** `packages/engine/src/data/origins.ts`: `kanaOrigins: Readonly<Record<string, { readonly kanji: string; readonly part: string | readonly number[] }>>`, hiragana → its kanji and the part of it the katakana kept, for the basic kana whose hiragana and katakana come from the same kanji, and `originOf(kana: string): string | null` (the kanji) for either script. `part` is either a component that KanjiVG names (`kvg:element` of a group of the kanji's file: 力 of 加 for か / カ; the kanji itself when the katakana kept all of it), or, when the strokes the katakana kept are no group of the file (ク of 久, ノ of 乃, ナ of 奈), their 0-based indexes in writing order (ク: `[0, 1]`). A name is the rule: indexes stand only where the kanji's file has no group for the part, and each such entry carries a comment that names its strokes in words (`// ク: ノ and ㇇, the first two strokes of 久`). A name that is no group of the file, or an index outside its strokes, fails the build. The kanji come from the tables of origins (字源) of the Japanese Wikipedia articles 平仮名 and 片仮名, cited with the date in the file; the parts are written by the executor of PR 4 from the shapes, since the tables do not name them, and the maintainer reads both (M7). A pair whose two scripts come from different kanji is left out.
- **The visual audit.** A check that an index lies within its strokes cannot tell a wrong stroke from a right one, and nobody can read `[0, 1]` against a shape. So the build writes `packages/content/audit-origins.svg` (generated, committed): one cell per entry of `kanaOrigins`, in the table's order, with the origin kanji drawn from its strokes, the `kept` strokes in a dark ink and the rest in light grey, each stroke numbered by its 0-based index; beside it the katakana drawn from its own KanjiVG strokes, and the hiragana; under them the kanji, the part (a name or the indexes) and two stroke counts, the kept part's and the katakana's, marked `≠` when they differ (a katakana may simplify its part, so `≠` asks for a second look and fails nothing). GitHub shows the file as an image in the pull request. The executor renders it with the repository's Playwright and looks at every cell before the pull request is opened ([PR 4](#pr-4--kanjivg-data)); the maintainer reads the image (M7).
- **Credit:** CC BY-SA 3.0 applies to the converted data, shipped as these separate files. `/about` credits KanjiVG from the pull request that first shows its data (PR 11, [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen)); `NOTICE.md` lists it under "Third-party data" and "Mirrored content sources" in PR 4.

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

- **`readingTokens`** (`packages/engine/src/data/reading.ts`, exported from the index), built in PR 1 with the rule errors, because the pipeline (PR 5) and the model (PR 12) read it:

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
- **`Engine.ruleError(m, s, ch): boolean`** for a key `ch` that `step` rejected in `s`, about the token `errorTarget(m, s)`. It is true when that token is a standalone `sokuon` or a `choonpu`, or a merged っX token for which, in an active position on it or waiting for its first key (changed in PR 1: a kana that cannot be doubled, as ナ in ッナ, has its first letter rejected before any position stands on the token; row `ッナ`), the letters of the token typed so far plus `ch` form a non-empty prefix of a spelling of X in the strictness: the learner typed X without the doubling (ADR 117, point 3, with a prefix in place of a whole spelling, because the key is rejected before the spelling ends).
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
  | ッナ     | `n`       | `n` at the start | the rule (ッ) |
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
- **`syntheticLog({ answers, seed, words })`.** With `words: true` a session of the log has the shapes of a P9 session, so the measurements of [D29](#d29-budgets) fold what a learner's log will hold, all drawn with the seeded `Rng`:
  - **words:** after every 5 kana tasks, a word task of `L` introduced kana of the selected track, a pseudo-word whose reading is their characters (`w`); `L` is 2–4 in 60% of the words, 5–7 in 30% and 8–10 in 10%, longer than the N5–N4 chunks (section 2) so the tail is measured. Each kana is an event of task `word`, answered as the log answers a recall of that kana, all at the task's `at`;
  - **rules:** a rule token in every 4th katakana word and every 20th hiragana word (part 1: 60 of 108 katakana words and 53 of 1,167 hiragana words need one), placed before a kana (っ) or after it (ー); an `intro` of the rule before its first word, then its `word` event with the rule key, not `ok` in 1 of 10;
  - **runs:** at the 15th task of a session, once 12 kana of the track are learned, a run of their 12 `fluency` events at one `at`;
  - **rounds:** after the 30th task, a `recall` of each kana answered wrong in the session, at most 5;
  - **slips:** 1 recall in 30 is a slip (`misses` 1, `ok` false, in time).

  Without `words`, the log is byte for byte as today. `model-cost.spec.ts` and `home-cost.spec.ts` use `words: true` from PR 6; the 40,000 answers count each event of a word, a rule and a run. PR 5's description gives the real histogram of word lengths; when its tail is longer than this one's, PR 14 widens `L` to it and says so (a fixture of the measurements, not a rule of the model).

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
  /** The round's kana in their order once it has started; null before (the screen of the round, decision 162). */
  readonly roundKana: readonly LearnKanaKey[] | null;
  /** Tasks of the round given so far. */
  readonly roundCount: number;
  /** The kana of this session's tasks so far, each once, in the order first met (rule 5 of D13; the screen of the closing word, decision 165). */
  readonly seen: readonly LearnKanaKey[];
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

`WORDS_RECENT` comes with PR 6, which keeps the recent words in the state ([D9](#d9-one-task-per-moment-and-the-recent-words)); `WORD_EVERY`, `WORDS_START`, `ROUND_MAX`, `RULE_ERRORS` and `RULE_WORDS` with PR 12; `FLUENCY_AT`, `FLUENCY_MIN`, `FLUENCY_MAX`, `CONTRAST_OPTIONS` and `MISMATCH_MAX_KANA` with PR 14. `MISSES_MAX` = 9 and `WORD_TEXT_MAX` = 32 are bounds of the codec in `packages/shared` ([D3](#d3-events-of-format-4)).

#### D18. The forecast and the outline

`forecastRow` keeps playing `nextTask` alone, without words, runs, the mix or the round. `outlineSession` plays the word slots once the track has had a word.

- **The forecast, measured before the code.** The home does not load the words. Part 3 measured the same pace per day with and without them (the 104 kana on day 13 both), and the review of 2026-11-28 measured the forecast itself ([section 2](#2-what-was-checked)): with the words, the closing word, the round and the 3% slips of part 3, the raw forecast of the next row is biased by −1 session, and the history's correction brings the forecast shown to a median error of 1 session with no bias, within ±1 session in 79% of the forecasts (76% without words). PR 16 measures it again on the production plan, on both tracks ([D19](#d19-the-simulator-on-the-production-plan)).
- **If PR 16 misses the line** (a median error over 1 session), the remedy is decided here: the forecast plays the word slots as the outline does (below), PR 16 measures again and records the change as a deviation. Only a miss after that stops the pull request.
- **The outline names the words** (Q6). Once `state.learner.words` holds a word of the track — a word whose first character is of the track's script (hiragana U+3041–U+3096, katakana U+30A1–U+30FA) — the outline plays a word slot after every `WORD_EVERY` planner tasks, as the session does ([D13](#d13-the-order-of-a-session)). A slot counts toward `SESSION_TASKS` and grades nothing: the play knows no words. `Outline` gains `words: number`, and the line reads `about 30 tasks: 5 reviews, 2 new kana, 5 words` / `около 30 заданий: 5 повторений, 2 новые каны, 5 слов`.
  - The words' part is the plural key `home.outline.words` of the lazy `home` part ([D28](#d28-strings-and-styles)), so the initial JS gains no string. The part loads with the home's panels, in parallel with the model; until it has loaded, the line leaves the words out.
  - Before the track's first word, and on the other track, the outline is as today. Rules, the run and the round are not named: it is an outline, not a promise ([learning.md](docs/spec/learning.md)).

#### D19. The simulator on the production plan

- `createProductionPolicy` gains the option `plan: true`: each session is `createSessionPlan({ track, words, rng, features: all })`, with `words` the readable entries of the track's committed chunk (`apps/web/src/entities/prompt/content/words-<track>.json` after PR 5, read with `fs` and `wordEntry`; no import of `apps/web` code). Its fold keeps statistics for the run. The adapter converts the plan's tasks to the harness's tasks and the answers to the events of [D4](#d4-what-each-task-logs), and holds no rule of the plan.
- **The harness answers the new kinds:** contrast, transfer and find the error as a recognition of their kana; build as a recall; hiragana or katakana? always right; a word's kana by `Learner.read`; a run's kana as recalls; the round as recalls; a rule introduction as nothing, and a rule token always right (the reference learner has no rules).
- **Slips:** `ReferenceParams.slip` = 0.03 in the acceptance run (part 3, table 5).
- **Research options** (`every`, `carrier`, `recheck`, `minPool`, `recent`, `closing`, `endRound`, `slips`) stay outside the production path, so the tables of parts 1–3 still reproduce.
- **`src/p9.ts`** (`pnpm --filter @nekotype/sim run p9`), 50 beginners over 60 days, on hiragana and on both tracks with the katakana suggestion followed: the P7 line without words against the production plan, with the columns of part 3's table 5; the forecast's table of section 2 (median error, bias, within ±1, raw and shown) for the next row over 30 days; then the slow learners of P7 part 3 on the production plan.
- **Lines** (P9 acceptance): the beginner reads the 46 basic hiragana by day 8 (median), with review retention of at least 90% and at most 10 minutes a day over days 1–14; each slow learner within 2 points of its P7 value; the forecast off by at most 1 session (median). A number outside its line stops the pull request, but for the forecast, whose remedy D18 decides; nothing is tuned to pass.

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

- **The slice** comes with PR 13 (the word functions and `loadContentVersion`); PR 11 adds `loadStrokes` and PR 19 `loadOrigins`. Whichever of PRs 11 and 13 merges first creates `index.ts`.
- **Loading** (PR 15). The session loads the word chunk of `learn.track` with its runtime (`Promise.all`), and the runtime reads the items with `wordEntry` once, outside any key handler (in the loader, `wordEntry` would pull `session-plan` into the first load); an entry that is null is dropped. A chunk that fails to load gives a session without words (no word, closing word, rule introduction or find the error), never a blocked start.
- **Prefetch** (PR 13). On idle after the store is ready, with the session runtime (`app/prefetch.ts`), when the selected track has an introduced kana.
- **`check-budget.mjs`** (PR 13): content chunks may be in the build from P9. A content chunk is never the initial chunk, nor a static import of it or of a route chunk (the checks of `SYNC_ENTRY`), and is at most 40 KB gzip.

#### D21. The session

- **`createLearnSession`** plans with `createSessionPlan`. Its deps gain `words: readonly WordEntry[]` and `items: ReadonlyMap<string, WordItem>` (by text) of the selected track, and `features: ReadonlySet<PlanFeature>`. The features come from `SESSION_FEATURES` in `pages/learn/lib/constants.ts`, which each pull request extends with what it builds: PR 15 `round`; PR 17 `word`, `closing`, `rule`; PR 18 `contrast`, `script`, `mismatch`; PR 19 `transfer`, `build`; PR 20 `fluency`.
- **`TaskView`** mirrors `SessionTask` with what the screen shows: the kana, the romaji, the options, and a word's meaning once it is answered. The export names the views.
- **The session's code by mechanic** (PR 15). `pages/learn/model/session.ts` is split along the three ways a task is answered, so the pull requests after PR 15 add a kind mostly in files of their own and PRs 17, 18 and 19 can run side by side:
  - `session.ts` keeps the core: the plan, the phases, the held answer, the deferred recording, the ticks, the round and its screen, the summary;
  - `model/typed.ts`: a task typed as one kana (the introductions, recall, build);
  - `model/choice.ts`: the choices (recognition, contrast, transfer, hiragana or katakana?, find the error);
  - `model/stream.ts` (PR 17): a task typed as a stream of tokens (a word, a rule's example, a run).

  PR 15 writes the functions between the core and a mechanic into `docs/architecture/pages.md`. A later pull request adds its kind to its mechanic's file, its view to `TaskView` and its feature to `SESSION_FEATURES`, and changes the core only where its card says.

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
  - sets the feedback of [D23](#d23-feedback-that-teaches).
- **Ticks:** one per task of the session (`total` = `SESSION_TASKS`); the round adds `roundSize` ticks after a gap when it starts (decision 162).
- **Two screens that are not tasks** (decisions 162, 165): before the round's first task, the screen of the round with `plan.roundKana` (PR 15); before the closing word, its screen with `plan.seen` (PR 17). Each waits for `Enter` or `start`, logs nothing and adds no tick.
- **A held answer** (decision 160): a task with a `wrong` verdict, a wrong choice, a word once answered (its meaning) and the end of a run wait for `Enter`, `Space`, a click or `next`; keys before that do nothing. A right answer and a slip hold `ANSWER_PAUSE_MS` as today.
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
- **The controller of a stream** (`shared/ui/task-controller.ts`, PR 8). The reference draws `KanaWord`'s caret and buffer from its props ([D31](#d31-the-design-reference-in-the-code)); in the code `KanaWord` renders them once, under token 0, and the controller moves them:

  ```ts
  /** A word, a rule's example or a run: the caret and the buffer stand under token `index`, and the tokens before it are typed (`is-typed`). */
  readonly setToken: (index: number) => void;
  ```

  `setBuffer` writes the buffer, `reject` flashes the caret, and `type(n)` marks the ghost letters of a rule's example, as for an introduction. The marks of an answered task (`wrong`, `rule`) come through props, in its one render. `KanaParts` (a build) has its caret before the first kana in its markup; the controller writes only its buffer.

- **Accepted keys** go to their token by `committedTimings(matcher, state)`: each token's first and last accepted key.
- **A kana token:**
  - `misses` = its rejected keys that are not rule errors;
  - `ok` = none of those and no reveal; `hint` = a reveal on it;
  - `wrong`, for its first such key: `typed` = the letters of the token typed before that key plus the key; `wrong` = `wrongKana(track, strictness, typed)`, or, when that is null on a merged っX, `wrongKana` of `typed` without its doubling (a leading `xtu`, `ltu`, `xtsu` or `ltsu`, or a first letter that the second repeats, `tch` and `cch` included). `ta` on って gives た; `kko` on っか gives こ.
- **A rule part** (a merged っX's doubling, a standalone っ, a ー) gives one answer with its rule key: `misses` = its rule errors (on a standalone っ or ー, every rejected key), `ok` = none and no reveal, `hint` false, `wrong` null, no keystrokes.
- **A reveal** shows the token's romaji and counts on what the token holds: a kana's `hint`; on a merged っX both X's `hint` and a rule error; on a standalone っ or ー a rule error. The token must still be typed in full.

#### D23. Feedback that teaches

After a task with a `wrong` verdict the task waits for `Enter` (D21) and shows (Q2; decisions 160, 164, 171, 172; `KanaTask` `compare`, `feedback`, `promise`):

- **The learner's answer next to the right one.**
  - A typed kana whose `wrong` names a kana: in the stage, the right kana in its place with its romaji under it, the learner's kana on its left, smaller, in `miss`, with `you typed` / `вы ввели` over it and its romaji under it.
  - A typed kana with no `wrong` (a reveal, several keys, a slow recovery): the right kana and its romaji.
  - A choice: the options keep their marks (`wrong`, `reveal`).
  - A word: first its first wrong kana, as a typed kana, with the caption `word · <the word>`; `Enter`; then the word with every kana of a `wrong` verdict in `miss` (`marks`, decision 164), its meaning, and the promise naming each of them the round takes (Q5). A rule error: the word with the rule's mark in `miss` and the rule's line, no pair and no promise.
  - A missed find-the-error: the odd card shows the romaji it wore struck and its own; the line `し was shown as chi; it is shi` / `у し было chi, а это shi`.
  - A wrong hiragana-or-katakana: `リ is katakana; its hiragana is り` / `リ — катакана; в хирагане это り`.
  - A wrong transfer: the options keep their marks, and the line `タ is ta · か ka → カ` / `タ — это ta · か ka → カ` (the chosen katakana, then the prompt and the right one).
  - For a screen reader the pair is also a sentence in the status line (`me is め · this is ぬ nu` / `me — это め · а здесь ぬ nu`; after a reveal `this is ぬ nu` / `здесь ぬ nu`).
- **The difference of a pair:** when the two kana are a pair of `similarPairs`, one line under the card on how they differ. The keys are `session.pair.<h|k>.<a>.<b>`, with `a` and `b` the romaji of the pair in the table's order (`session.pair.h.nu.me`, `session.pair.k.shi.tsu`). The executor of PR 10 drafts the 47 lines in English and Russian; the maintainer reads them before its merge (M6). Other pairs get no line, and until PR 10 is merged no pair has one: the feedback of PR 15 shows a line only when its key exists.
- **The promise** names the kana of the task that the round will take, in the order they were answered: `ぬ comes back at the end of the session` / `ぬ вернётся в конце сессии`, and for more than one, in a word or a run (Q5), `ぬ, め come back at the end of the session` / `ぬ, め вернутся в конце сессии` — the plural key `session.promise` by the number of kana, the kana joined with `, `. A kana is named while it is among the first `ROUND_MAX` wrong kana of the session; with none named (the round full, or in the round), no promise. Below 640px it stands in the key line, left of `next`.
- **A slip:** nothing — the caret flashed, the kana stays `fur`, the tick stays right.

#### D24. Choice and build tasks

- **Contrast:** the prompt is `displayRomaji(K)`; the options are the plan's, shuffled with the session's `rng`; keys 1–4; as many columns as options, larger kana (decision 168).
- **Transfer:** the prompt is the hiragana `from` (`promptKana`); the options are `recognitionOptions` for the katakana K, as for a recognition; keys 1–4.
- **Build:** the prompt is the parts (が: か and ゛, from the kana's canonical decomposition; きゃ: き and ゃ, its two characters) with `+` between them; the romaji is typed as in a recall, against the matcher of K; once answered `→` and K and its reading appear (decision 170). A right build holds `ANSWER_PAUSE_MS` and moves on, as a recall: the learner has just typed the reading and saw the kana in its introduction. A wrong one waits for `Enter` (D21) with `→` K, its reading and the comparison of D23 on screen.
- **Hiragana or katakana?:** the kana K (`promptKana`); two word options (`OptionCard text`), `hiragana` and `katakana`, keys 1 and 2; `ok` when the chosen script is K's.
- **Find the error:** the word's kana as `OptionCard`s, each with `displayRomaji` under it (`sub`), the one at `index` under `displayRomaji(alt)`; the learner picks a kana by its number (1–9) or a click; `ok` when the pick is `index`.
- **Introductions:**
  - build: `か + ゛ → が` (`KanaParts`), the caption `new kana`;
  - transfer: the origin kanji drawn from `origins.json` when `originOf` has one, `from 加` / `из 加` under it, `→`, the hiragana, the katakana (`KanaParts`, `Strokes`); the caption `new katakana` / `новая катакана` ([D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen)).

  Both are typed once with the shown romaji, as an introduction is today, and log an `intro`.

#### D25. The fluency run on the screen

- The run's kana are the prompts of one stream (`compile` of the kana, one prompt each); a reveal shows the current kana's romaji.
- No timer, count, speed or score is shown (ADR 093); the run ends when its last kana is typed, then shows `done` / `готово` under the card and waits for `Enter`; with a wrong kana, the pair of the first one as a line (`you typed ぬ nu · here め me` / `вы ввели ぬ nu · здесь め me`), its difference and the promise, which names every wrong kana of the run the round takes (decision 173, D23).
- It is recorded at the end with `recordTokens({ task: 'fluency', w: null, … })`: one `fluency` event per kana, each kana being in the run once.
- A keystroke renders nothing; the end of the run renders at most once.

#### D26. The report dialog

- Restored from commit 753df9f (`git show 753df9f:apps/web/src/pages/trainer/…`) by PR 9, apart from the session: the dialog into `pages/learn/ui/report/`, a lazy chunk of its own, and `lib/turnstile.ts` into `pages/learn/lib/turnstile.ts`. PR 17 opens it from a word task. It is laid out as decision 167 draws it: the word and its meaning under the title, the reasons as a `RadioGroup` with **none chosen in advance** (the restored `Select` with its default goes), a `Textarea`, the Turnstile slot, the reserved notice in the actions row. `send` is enabled once a reason is chosen and the check has passed.
- It opens from `report a problem` / `сообщить об ошибке` at the end of a word task's key line after the answer, never while the word is typed. The session waits while it is open; closing it gives the focus back to the session's input.
- The request of [backend.md](docs/spec/backend.md): `itemId` the word's `id`, `contentVersion` from the manifest ([D20](#d20-words-in-the-app)), `reason` (`wrong_reading`, `wrong_translation`, `other`), an optional `comment`, and the Turnstile token. Turnstile's script loads only when the dialog opens; the site key is chosen by host (ADR 092); the action is disabled offline (`useOnline`).
- Its strings are in the `session` part ([D28](#d28-strings-and-styles)).

#### D27. Stroke order and the origin kanji on the screen

- **The kana details** (`features/kana-details`) load the stroke chunk of the kana's track (`loadStrokes`) when the dialog opens and draw each glyph of the kana (a yōon, two) as SVG paths in writing order with their numbers (`StrokeOrder`, decision 174): a 112px box (88px below 640px), a glyph with `small` (D2) at 70% from the bottom left. The strokes draw one after another when the dialog opens at one pen speed — a stroke takes its length (`getTotalLength`) / `PEN.speed` (0.16 units per ms), at least `PEN.min` (260ms), with `PEN.lift` (140ms) between strokes (`PEN` of the reference, exported by `shared/ui/strokes.tsx`), the current one in `eye` — and `replay` / `ещё раз` (`secondary`, `sm`, the `reset` icon) draws them again. Under `prefers-reduced-motion` every stroke is there at once. While the chunk loads, and after a failure, the place keeps its size and `replay` is disabled.
- **The origin kanji.** The session loads `origins.json` with its runtime when `learn.track` is katakana. A transfer introduction draws the kanji from it once when it appears, with the same pen, its `kept` strokes in `eye` and the rest `fur-dim`, 88px (56px below 640px) (`Strokes`, decision 169); without the chunk it shows the pair alone.
- PR 11 adds the KanjiVG credit to `/about`, so the data is credited from the first pull request that shows it; PR 19, which shows the origins, comes after it.

#### D28. Strings and styles

- **Strings** (PR 3). A dictionary part `session` (en and ru, key parity) is loaded with the session runtime (`loadSessionRuntime` waits for it). It holds every new string of the session: the task types, the notices, the 47 pair differences, the round, the run, the rule introductions and the report dialog. The `learn.session.*` strings of the English core stay. The `details` part gains the stroke order's strings, `about` the sources section, and `home` the words of the outline (`home.outline.words`, PR 14, [D18](#d18-the-forecast-and-the-outline)).
- **Styles** (PR 3). The styles of the session's tasks move from `app/styles/index.css` to a stylesheet that the session runtime imports, so they leave the initial CSS. `nk-caret`, which the home's path draws, stays. The pull requests after PR 3 add the session's styles to that stylesheet, copied from the reference ([D31](#d31-the-design-reference-in-the-code)).

### 3.7 Budgets and measurements

#### D29. Budgets

- **Lines** after every pull request into `main`:
  - initial JS ≤ 31.5 KB gzip (Q9; was 31.0) and initial CSS ≤ 8.0 KB gzip;
  - the session runtime chunk ≤ 20.0 KB gzip, the chunks `session-plan` and `session-stream` ≤ 5.0 KB gzip each, and the model chunk ≤ 12.0 KB gzip;
  - each word, stroke and origin chunk ≤ 40 KB gzip (the content budget of [quality.md](docs/spec/quality.md)).

  Above a line: stop and ask. Reason: P11 and P12 still need the initial chunk (the first visit and the words on `/`), 3.5 KB below the limit of 35.

- **Session code stays out of the first load.** Code that only a session runs lives in the session runtime, its two chunks below or the model chunk, never in `entities/learn`, `pages/learn/session-loader.ts` or `app/` beyond a type, a dynamic import and the call that forwards. The learn store keeps what needs its own state — `recordTokens` turns the tokens it is handed into events with K and the verdicts ([D21](#d21-the-session)) — while building the tokens (`tokenAnswers`), the views and the feedback stay in the session's chunks. This is the first thing to check when a pull request comes near its allowance below.
- **The session's chunks** are decided here, not by the pull request that would pass a line:
  - `session-plan`: `packages/model/src/session.ts` and `words.ts`, a named chunk of `vite.config.ts` placed before `model` (PR 15). Only the session plans; the `model` chunk, which the home loads, keeps the fold, the forecast and the outline;
  - `session-stream`: `pages/learn/model/stream.ts`, `pages/learn/lib/typed-answer.ts` and `shared/ui/kana-word.tsx`, a named chunk (PR 17);
  - both are static imports of the session runtime, so they load with it, in parallel, and the session never waits for them between tasks. `check-budget.mjs` finds each by name, as it finds `model`, and fails a build in which it is missing or part of the first load: PR 15 adds the check of `session-plan`, PR 17 that of `session-stream`;
  - the report dialog (PR 9) is a chunk of its own by the dynamic import of PR 17, and the strokes (`shared/ui/strokes.tsx`), which the details dialog and a transfer share, a chunk shared by the two.
- **Allowances.** What each pull request is expected to add, in KB gzip; a pull request not in the table adds nothing that the first load or a session loads. Its description gives each figure against its allowance, and a figure over its allowance by more than half of it says why.

  | PR        | Initial JS | Initial CSS | Session runtime | `session-plan` | `session-stream` | Model     |
  | --------- | ---------- | ----------- | --------------- | -------------- | ---------------- | --------- |
  | today     | 30.72      | 7.75        | 10.42           | —              | —                | 8.44      |
  | 2         | +0.10      | —           | +0.05           | —              | —                | +0.05     |
  | 3         | +0.02      | −1.0        | +0.05           | —              | —                | —         |
  | 6         | +0.10      | —           | —               | —              | —                | +0.8      |
  | 7         | —          | —           | +1.5            | —              | —                | —         |
  | 13        | +0.05      | —           | —               | —              | —                | —         |
  | 14        | +0.03      | —           | —               | —              | —                | +0.1      |
  | 15        | +0.03      | —           | +1.5            | 3.0, new       | —                | —         |
  | 17        | —          | —           | +0.5            | —              | 3.0, new         | —         |
  | 18        | —          | —           | +1.5            | —              | —                | —         |
  | 19        | +0.02      | —           | +1.0            | —              | —                | —         |
  | 20        | —          | —           | —               | —              | +0.5             | —         |
  | End of P9 | about 31.1 | about 6.8   | about 16.5      | about 3.0      | about 3.5        | about 9.4 |

- Every pull request writes in its description the initial JS and CSS, the session runtime, `session-plan`, `session-stream` and model chunks, before and after.
- The limits of [quality.md](docs/spec/quality.md) are not raised.
- **Measurements.** The latency gate samples word keystrokes too: PR 17 seeds its log so that words open, with a word of at least 8 kana among the samples, and PR 20 adds a run's keystrokes. `model-cost.spec.ts` and `home-cost.spec.ts` measure a log with words, rules, runs, rounds and slips from PR 6 ([D10](#d10-the-pace-of-a-word-and-the-synthetic-log)).

### 3.8 How it reaches production

#### D30. No integration branch

Every pull request goes to `main`. Reasons:

- PRs 1–6, 8–10, 12, 13 and 16 change no screen. PR 2 makes the session log the rejected keys and the reveal; PR 6 makes a slip "hard"; PR 3 moves styles without changing them. Production keeps working.
- The components come before the session uses them (PRs 7–11), and the screens turn their features on one at a time ([D21](#d21-the-session)); between two pull requests a session shows the kinds built so far. PR 7 shows the current kinds in the new frame before PR 15 changes how a session runs.
- The one reset, schema 8, is PR 2, a draft until M4 is ticked.
- Before P14 only the maintainer uses production (ADR 061).

### 3.9 The design reference in the code

#### D31. The design reference in the code

The export is a React reference; the code is Preact with a controller on the hot path. This is how an executor carries one into the other without choosing anything.

- **What the reference is.** `docs/design/source/components/bundle.js` (React 18, `h`), `bundle.css` and `index.d.ts`. Its `KanaTask` is static markup plus `createTaskController`, the split of `shared/ui/kana-task.tsx` and `task-controller.ts`: props render once per task, and the controller writes classes, text and transforms on a keystroke, with the same methods.
- **The rules of the port:**
  1. **Styles.** The rules of `bundle.css` for the classes a pull request builds are copied as they are into the session's stylesheet or the component's own, token variables included; no value is retyped from a picture.
  2. **Markup.** Each element, class, `role`, `aria-*` and `lang` of the reference's component stays; `h(…)` becomes JSX, `React.ReactNode` becomes `ComponentChildren`.
  3. **Names.** A prop, type or constant that `index.d.ts` declares keeps its name and shape in the code, with `readonly`. A name the reference lacks comes from section 3. Strings come from the dictionary parts, never from the reference's literals.
  4. **The hot path.** A prop of the reference that changes while a task is typed is written by the controller in the code (the table below), never by a render.
  5. **Parity.** Before a screen's pull request is opened, its executor renders each state its card lists twice: the reference (a local page with `tokens.json` as CSS variables, `bundle.css`, React 18 and `bundle.js`, as step 5 of the [design workflow](docs/design/workflow.md) builds it) and the code (`pnpm run dev`, the state reached through a seeded log or a test fixture), at 1120 px and at 360 px (360 × 280 above the keyboard for a state of a session). It looks at each pair and lists in the description every state checked and every difference left, with its reason. The images stay in the executor's scratchpad.
- **Where the code differs from the reference:**

  | Reference                           | Code                                                                                                                                             | Why                         |
  | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
  | `KanaWord` `cur`, `buffer`          | `setToken(index)` and `setBuffer(text)` of the controller ([D22](#d22-typed-answers-by-token))                                                   | a keystroke renders nothing |
  | `KanaParts` `typing`, `buffer`      | the caret in the markup, the buffer by `setBuffer`                                                                                               | the same                    |
  | `TaskController`                    | the code's `TaskController`: the same methods, and `setToken`                                                                                    | the stream                  |
  | `KanaTask` `labels`, `optionsLabel` | the code's `TaskLabels`: the reference's keys, `esc`, and `options` for `optionsLabel`                                                           | the code's names since P6   |
  | `StrokeGlyph`, `PEN`                | the same names and shapes ([D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg), [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen)) | —                           |

  An executor who finds another difference adds its row in the pull request, as a deviation ([section 8](#8-instructions-for-executor-agents), item 3).

### 3.10 Documents and decision records

- **ADRs.** Each takes the next free number when its pull request is opened (the last is 119). PRs 2, 3 and 4 open in one wave in any order, so the numbers are not fixed here; a document names another pull request's ADR by number once that ADR exists.
  - **119** in PR D: the P9 design export (the session screen, every task type, the round, the stroke order, the report dialog), and what it changes in the code or the spec;
  - in **PR 2**: the log and sync format 4 (`misses`, `w`, `mismatch`, `script`, the rule keys, `hint` as a reveal, the shortest encoding, format-3 pages still read, schema 8 and why it stays a reset);
  - in **PR 3**: the session's lazy parts (the `session` part, the lazy stylesheet, the chunks `session-plan` and `session-stream`, session code out of the first load) and the initial JS line of P9 at 31.5 KB (Q9);
  - in **PR 4**: the stroke data and the origin kanji from KanjiVG (the choice ADR 099 left to P9), the origins table in the engine and its visual audit;
  - in **PR 5**: words written in kana in the pipeline (the port, the learnable filter, the exclusion list as part of the pipeline, the order by reading; the JLPT lists no longer select words);
  - in **PR 6**: the fold of P9 (verdicts and what they drive, a slip as a correct recall with a hint, contrast's confusion with the option chosen, one task per moment, the recent words, the rules' state, the `word` pace, the synthetic log with words);
  - in **PR 12**: the session plan in the model (the features, words of the selected track only as in Q1, the order of a session, the precedence of the mix, the contrast set without shared spellings, find the error on words of at most 9 kana, the run's kana as in Q4, the promise that names each kana the round takes as in Q5, the forecast on the kana planner and the outline that names the words as in Q6). It amends ADR 118, point 7, for the run.
- PRs 1, 7–11 and 13–21 need no ADR: the engine's change is ADR 117's, and the screens follow the export and this plan. One that decides something new takes the next number.
- **A-items** in [decisions.md](docs/spec/decisions.md): PR 6 adds A53 (a word is one recall per kana; a slip is "hard"; a rule error grades no kana; ADRs 117, 118 and the ADR of PR 6); PR 12 adds A54 (the session: a word after every 5 kana tasks of the selected track, the closing word, the round, the mix; ADR 118 and the ADR of PR 12). A47 gets "Amended by A53, A54".
- `docs/architecture/` changes with the code: `model.md` (PRs 6, 12, 14), `sync.md` and `entities.md` (PR 2), `entities.md` (PR 13: `entities/prompt`), `pages.md` (PRs 3, 7, 8, 9, 11, 15, 17–20), `quality-gates.md` (PR 13: content chunks and the session's chunks; PR 17: the latency gate with word keystrokes).
- `README.md`: how a session looks (PRs 7, 15, 17), the shipped content and its credits (PRs 11, 17).
- `docs/README.md` has a row for this plan (#250); PR 21 removes it.
- `AGENTS.md` does not change.

### 3.11 Spec changes

| #   | Change                                                                                                                                                                                   | Spec file                                   | In PR    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------- |
| S1  | P9 specified in full: its acceptance; the maintainer's answers of the review (Q5, Q6)                                                                                                    | `phases.md`                                 | the plan |
| S2  | "Words": the rule of D1 in place of steps 2–3 for words, the learnable filter, the exclusion list, the order by reading; the JLPT lists for phrases only                                 | `content.md`                                | 5        |
| S3  | Events of format 4 (D3, D4); schema 8 in "Schema changes"; the data model's events                                                                                                       | `storage-sync.md`, `metrics.md`             | 2        |
| S4  | Sync format 4; `400` for another `v`                                                                                                                                                     | `backend.md`                                | 2        |
| S5  | `readingTokens`; rule errors and their golden rows                                                                                                                                       | `engine.md`                                 | 1        |
| S6  | Memory and grades: a slip, a word as recalls per kana, the rules, the pace `word`; accuracy by verdict; A53                                                                              | `learning.md`, `metrics.md`, `decisions.md` | 6        |
| S7  | The learning session: the plan (cadence, start, recent words, closing word, round, the mix, the rules, the run) and its constants; A54 (PR 12); the outline's words (PR 14)              | `learning.md`, `decisions.md`               | 12, 14   |
| S8  | The `session` part, the lazy styles and the session's chunks (PR 3); the session screen: the frame, feedback that teaches, the round, the ticks, the summary's errors by verdict (PR 15) | `learning.md`, `frontend.md`                | 3, 15    |
| S9  | The content shipped lazily and its budget row (PR 13); word tasks: the meaning after the answer, the closing word, the rule introductions, JMdict on `/about` (PR 17)                    | `learning.md`, `content.md`, `quality.md`   | 13, 17   |
| S10 | The report action and dialog on word tasks                                                                                                                                               | `content.md`, `frontend.md`                 | 17       |
| S11 | KanjiVG: the source, the chunks, the credit                                                                                                                                              | `content.md`                                | 4        |
| S12 | The stroke order in the kana details; KanjiVG on `/about`                                                                                                                                | `metrics.md`, `content.md`                  | 11       |
| S13 | Contrast, hiragana or katakana? and find the error (PR 18); build and transfer (PR 19) on the screen                                                                                     | `learning.md`                               | 18, 19   |
| S14 | The fluency run on the screen; its keys on the hot path                                                                                                                                  | `learning.md`, `frontend.md`                | 20       |
| S15 | The "Closed" line of P9; the "End of P9" budget column                                                                                                                                   | `phases.md`, `quality.md`                   | 21       |

## 4. Design brief

The design session (M1) is drawn in a workbench artifact `Nekotype · P9 design`, moved into the design-system artifact and exported by PR D ([design workflow](docs/design/workflow.md), [ADR 106](docs/adr/106-design-sessions-in-a-workbench-artifact.md)). This section is its brief: what each screen shows, every state it has, and proposals. **The proposals are not decisions:** the session may draw something else, and the export decides. The export's decisions (159–177, [ADR 119](docs/adr/119-the-p9-design.md)) fill the last column of 4.2; the phone with its keyboard is 161, the totals 177.

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
| a   | The session as a whole  | One frame for every kind: the session line and ticks on top, a caption naming the kind over the prompt (`new kana`, `word`, `which one?`, `find the error`, `hiragana or katakana?`, `run`, `rule`), the prompt, the answer area, the notice line, the hint line. The kind is felt through the caption and the form of the prompt | 159      |
| b   | Between tasks           | The answer is held (`ANSWER_PAUSE_MS`) and the next task replaces it in place, with a short fade of a motion token and none under reduced motion. A result to read (a meaning, a wrong choice) waits for Enter, Space or a click                                                                                                  | 159, 160 |
| c   | Session line and ticks  | Decision 149 kept: a word or a run is one tick. The round's ticks follow after a gap under `round`, and the line reads `round · 1 of 3`                                                                                                                                                                                           | 149, 162 |
| d   | Feedback after an error | In the notice line, two kana side by side with their romaji, the learner's answer and the right one (`ツ tsu · シ shi`); under it the pair's difference; then `it comes back at the end of the session`. A choice keeps its marks as today                                                                                        | 160      |
| e   | A slip                  | No notice; the tick stays right; the rejected key flashes as today                                                                                                                                                                                                                                                                | 160      |
| f   | The round               | Its first task's notice says `3 kana you missed, once more`; its tasks are recalls in the frame of a                                                                                                                                                                                                                              | 162      |
| g   | A word                  | The word large in the place of the kana, sized for up to about 10 kana; the caret under the current kana; the romaji under each kana as it is typed; each kana takes its state when done; a merged っX reads as one; Esc shows the current kana's romaji                                                                          | 163      |
| h   | The meaning             | Once the word is done, its English meaning under it, `report a problem` / `сообщить об ошибке` as a text button, and `Kbd enter` to go on                                                                                                                                                                                         | 163, 167 |
| i   | The closing word        | A word task with the caption `a word of today's kana` / `слово из сегодняшних кан`                                                                                                                                                                                                                                                | 165      |
| j   | Rule introductions      | As a kana introduction: the mark large (`っ`, `ー`), one line (`っ doubles the next consonant: きって → kitte`), the example with its ghost romaji; shown again with `once more`                                                                                                                                                  | 166      |
| k   | Contrast                | As a recognition, with 2–4 options of similar shapes; after an error the pair large side by side with the difference                                                                                                                                                                                                              | 168      |
| l   | Transfer and its origin | The introduction: the origin kanji in strokes, then the hiragana and the katakana (`加 → か · カ`), or the pair alone; the task: the hiragana as the prompt and 4 katakana options                                                                                                                                                | 169      |
| m   | Build                   | The introduction: the parts and the result (`か + ゛ → が`); the task: the parts as the prompt, the romaji typed as in a recall                                                                                                                                                                                                   | 170      |
| n   | Find the error          | The word with the romaji under each kana, the kana numbered; a number key or a click picks; after the answer the odd kana is marked with both romaji                                                                                                                                                                              | 171      |
| o   | Hiragana or katakana?   | The kana large; two options numbered 1 and 2                                                                                                                                                                                                                                                                                      | 172      |
| p   | The fluency run         | The kana in one line (wrapping on a phone), the caret moving through them, each kana taking its state as typed; no timer, count or speed; at the end `done` and Enter                                                                                                                                                             | 173      |
| q   | The report dialog       | The shared `Dialog`: the word and its meaning, the reason (a `Segmented` of three, or what the export chooses), an optional comment, the Turnstile widget, `send`; the states of decisions 114–117 and 127                                                                                                                        | 167      |
| r   | Stroke order            | In the place of decision 152 in the details: each glyph with its strokes numbered in order; `play` draws them one by one, and under reduced motion every stroke is shown with its number; a yōon shows both glyphs                                                                                                                | 174      |
| s   | `/about`                | "Sources and licences" before the terms: JMdict and EDRDG for the words, KanjiVG for the stroke order and the origin kanji                                                                                                                                                                                                        | 175      |
| t   | The summary             | Decision 148 kept; `confused` without slips; optionally the kana the round brought back right                                                                                                                                                                                                                                     | 176      |

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

**Answer (2026-11-27):** both. The answer and the right kana side by side, and a line for each of the 47 pairs of the similar table in en and ru, drafted in PR 10 (PR 6 before the review of 2026-11-28) and read by the maintainer before its merge ([D23](#d23-feedback-that-teaches), M6).

### Q3. The origin kanji in a transfer

**Question.** ADR 099 introduces a katakana next to its hiragana "with their shared origin where there is one" (か and カ from 加), and the fonts hold no kanji. Draw the origin kanji, or show the pair alone?

**Answer (2026-11-27):** draw it in strokes from KanjiVG, for the pairs that share it ([D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg), [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen), M7).

### Q4. Which kana are slow for a fluency run

**Question.** ADR 118 gives a run when "at least 8 learned kana are accurate and slower than their pace". Kana slower than the line between good and hard are seldom eight. Take the slowest of the accurate kana, or keep the literal rule?

**Answer (2026-11-27):** the slowest of the accurate kana: a run when at least 8 learned kana have an accuracy of at least 0.8, made of the 12 slowest of them by median time ([D16](#d16-the-fluency-run)).

### Q5. A word with several wrong kana

**Question** (the review of 2026-11-28). After an error in a word the screen compares its first wrong kana, then shows the word with that kana marked; the round takes every wrong kana of the word. How does the learner learn why the second one comes back?

**Answer (2026-11-28):** the first step stays as decision 164 draws it; the second marks every kana of the word with a `wrong` verdict in `miss`, and the promise names each kana the round takes: `ぬ, め come back at the end of the session` / `ぬ, め вернутся в конце сессии`. The same holds for a run ([D23](#d23-feedback-that-teaches), [D25](#d25-the-fluency-run-on-the-screen)).

### Q6. The outline with words

**Question.** The home's outline (`about 30 tasks: 6 reviews, 2 new kana`) plays the kana planner alone, while a session with words holds 25 kana tasks and 5 words. Name the words, keep honest kana counts without naming them, or leave the outline to P12?

**Answer (2026-11-28):** name them. The outline plays the word slots once `learner.words` holds a word of the current track, found by its script, and the new string goes into the lazy `home` part so the initial JS gains none ([D18](#d18-the-forecast-and-the-outline)). The forecast stays on the kana planner: the review measured its error with words to be what it is without them.

### Q7. The schema reset

**Question.** The reset to schema 8 in PR 2 deletes the events a device has not sent. Keeping schema 7 is unsafe (a tab of older code writes over a page it cannot decode). Guard the reset with code that sends the old outbox first, or with the merge procedure?

**Answer (2026-11-28):** with the procedure, no code. PR 2 is a draft until the maintainer has ticked `synced` on every device in its description (M4); only the maintainer marks it ready and merges it ([PR 2](#pr-2--log-format-4)).

### Q8. How many pull requests

**Question.** Cut the phase into about 21 pull requests of at most about 900 lines, the components apart from the session, or into about 16 of up to 1,200 lines, each component with its integration?

**Answer (2026-11-28):** about 21 of at most about 900 lines ([section 7](#7-pull-requests)).

### Q9. The initial JS line

**Question.** The initial JS is 30.72 KB against the plan's line of 31.0 KB, and P9 is expected to add about 0.3 KB to it (the codec of format 4, `recordTokens`, the prefetch of words, the outline's words, the loading of words and origins). Raise the line, or keep it and stop if the moves of session code do not suffice?

**Answer (2026-11-28):** the line is 31.5 KB, and session code stays out of the first load by a rule decided in advance ([D29](#d29-budgets)).

## 6. Maintainer's manual steps

A step is written "done" with its date under the card it names in [section 7](#7-pull-requests). Each step blocks only the pull request it names (the "Depends on" column of section 7), and none blocks a pull request of the critical path for longer than the step itself takes.

### M1. The design session — before PR D

Done on 2026-11-28 (#251).

An agent runs the session by the [design workflow](docs/design/workflow.md) in a workbench artifact `Nekotype · P9 design`, by [section 4](#4-design-brief), in the four rounds of 4.3. Each round starts with the agent's questions (at most four) or, when the maintainer asks for it, with the variants the agent recommends; the maintainer's remarks come in the chat. After the last round the agent moves the approved variants into the design-system artifact as decisions from 159.

Check after approval: `decisions.md` has the new decisions after 158; every kind of `SessionTask` has a preview in each of its states; no P9 state is a dashed place any more. The workbench is deleted after PR D is merged, with the maintainer's confirmation.

### M2. The word sample — before PR 5 is merged

The maintainer reads `packages/content/audit-words.md` of PR 5 and names each word to leave out, with its reason. The executor adds them to `word-exclusions.json`, builds again and updates the sample, until the maintainer approves. PR 5 is on no critical path: the pull requests that wait for it (16 and 17) come three waves later.

### M3. KanjiVG mirrored — before PR 4

The executor of PR 4 downloads the archive of [D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg), checks that it holds the kana, and gives the maintainer its sha256 and the release notes (the source, the licence CC BY-SA 3.0, the attribution). The maintainer creates the release `content-sources-YYYY-MM-DD` with the archive as its asset ([ADR 068](docs/adr/068-content-sources-mirrored-as-release-assets.md)), or tells the executor in the chat to create it with `gh release create`.

### M4. Sync before PR 2 is merged

PR 2 raises `SCHEMA_VERSION` to 8, and the reset deletes what a device has not sent. PR 2 is a draft, and its description starts with this step as a checklist, one line per device on which the maintainer is signed in (Q7):

1. On each device: open `/settings` online, wait for `synced`, tick its line.
2. Once every line is ticked: mark the pull request ready and merge it. The executor never marks it ready.

### M5. Production check of PR 2

After PR 2 is deployed:

1. On `https://nekotype.pages.dev` the application starts as a guest with default settings (the reset).
2. Sign in: the log of format 3 comes back by the pull; the home and `/progress` show the account's progress.
3. A session ends with `synced` in `/settings`.

### M6. The pair differences — before PR 10 is merged

The maintainer reads the 47 lines of [D23](#d23-feedback-that-teaches) in English and Russian, which PR 10 lists in a table, and approves or corrects them. Nothing waits for PR 10: until it is merged the feedback simply has no difference line.

### M7. The origins table — before PR 4 is merged

The maintainer looks at `packages/content/audit-origins.svg` in PR 4 ([D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg), "The visual audit"): in each cell the strokes drawn dark are the part the katakana kept, beside the katakana itself, with the kanji's source. The maintainer names each cell to correct, starting with those marked `≠` and those the executor doubts; the executor corrects the table and builds the image again, until the maintainer approves.

### M8. Production checks of the screens — after each screen is deployed

After each of PRs 7, 11, 15, 17, 18, 19 and 20 is deployed, the maintainer goes through the "On production" list of its card on a desktop and on a phone, a few minutes each. A check waits when its condition has not arisen on the maintainer's progress (a confused pair for a contrast, 8 accurate learned kana for a run), and is done when it arises. No check blocks the next pull request: a problem found goes to a fix pull request. Before PR 21: one whole session on the phone with its keyboard open.

## 7. Pull requests

**How the phase is cut** (the review of 2026-11-28, [Q8](#q8-how-many-pull-requests)). Twenty-one pull requests of at most about 900 changed lines with tests: a size one executor session holds without losing the hot path or an edge state. Three rules make the cut:

- **Components apart from the session.** The task frame, the word and parts stages, the report dialog, the strokes and the 47 pair lines are pull requests of their own (7–11), built and tested through their props against the export before a session uses them. An integration pull request then wires a finished component, and its review reads the session's change alone.
- **The session by mechanic** ([D21](#d21-the-session)). PR 15 splits the session's code into its core and the three ways a task is answered (typed, a stream, a choice), so PRs 17, 18 and 19 change mostly files of their own and may run side by side.
- **Gates that block only what they guard.** M2 blocks PR 5 and M7 blocks PR 4, neither on the critical path; M6 blocks only PR 10, which nothing waits for; M8 is a short check after each screen is deployed, not a gate ([section 6](#6-maintainers-manual-steps)).

The critical path is PRs 2 → 6 → 12 → 15 → 17 → 20 → 21: seven pull requests, against ten before the review.

**The screens follow the export.** The cards of PRs 7–11 and 15–20 keep what PR D wrote against the design export (decisions 159–177, ADR 119): the export's components, layout and strings in en and ru. The reference is `docs/design/source/` (`components/KanaTask`, `KanaWord`, `StrokeOrder`, `RadioGroup`, `OptionCard`, `README.md` "Learning session"); its `bundle.js` and `bundle.css` are rewritten in Preact by the rules of [D31](#d31-the-design-reference-in-the-code), which also lists each name in which the code differs from the reference. Cards 1–6, 12–14 and 16 do not depend on the export.

**Common to all.** The branch is cut from fresh `main`; a pull request starts once every pull request it depends on is merged and every manual step it waits for is done; the acceptance items are those of [phases.md](docs/spec/phases.md), numbered in the [table at the end](#acceptance-items-and-pull-requests); sizes are changed lines with tests. Two pull requests of one wave may change the same file (the `session` part, `SESSION_FEATURES`, `docs/architecture/`, the Status table of this plan): the second to merge rebases on `main` and keeps both sides. Sign-in is hidden on previews: what needs a signed-in session is checked locally (`pnpm run dev` with `pnpm run dev:api`) and, after the merge, by the maintainer on production. A screen card's "On production" list is its part of M8.

| PR  | Title                                                  | Depends on                   | Wave |
| --- | ------------------------------------------------------ | ---------------------------- | ---- |
| 1   | Reading tokens and rule errors in the engine           | —                            | 1    |
| 2   | Log format 4                                           | — ; M4 before the merge      | 1    |
| 3   | The session's strings and styles out of the first load | —                            | 1    |
| 4   | KanjiVG data                                           | M3; M7 before the merge      | 1    |
| 5   | Words written in kana                                  | 1; M2 before the merge       | 2    |
| 6   | The grades of P9                                       | 2                            | 2    |
| 7   | The task frame                                         | 3                            | 2    |
| 8   | The word and parts stages                              | 7                            | 3    |
| 9   | The report dialog                                      | 3                            | 2    |
| 10  | The pair differences                                   | 3; M6 before the merge       | 2    |
| 11  | Stroke order in the kana details                       | 4                            | 2    |
| 12  | The session plan                                       | 1, 6                         | 3    |
| 13  | Words in the client                                    | 1, 6                         | 3    |
| 14  | The mix, the run and the outline                       | 12                           | 4    |
| 15  | The session on the plan                                | 7, 12, 13                    | 4    |
| 16  | The simulator on the production plan                   | 5, 14                        | 5    |
| 17  | Word tasks                                             | 5, 8, 9, 15                  | 5    |
| 18  | Choice tasks                                           | 14, 15                       | 5    |
| 19  | Build and transfer                                     | 4, 8, 11, 14, 15             | 5    |
| 20  | The fluency run                                        | 14, 17                       | 6    |
| 21  | Close the phase                                        | every other pull request; M8 | 7    |

A wave is the earliest a pull request can start if every pull request takes one step; the pull requests of one wave may run in parallel.

### PR D — Design export

Done: #251, merged on 2026-11-28.

- **Branch:** `docs/p9-design`. **Depends on:** M1 (approved by the maintainer).
- **Goal.** The approved design exported from the artifact into `docs/design/source/` (never edited there by hand), and this plan brought in line with it.
- **Docs:** `docs/design/source/` (`README.md` "Learning session" and every section the session changes, `decisions.md` from 159, `tokens.json`, the component guidelines, `bundle.js`, `bundle.css`, `index.d.ts`, new or removed component folders); `docs/design/README.md` (the decisions it holds); ADR 119; the token CSS and `tokens.test.ts` only if tokens change; in this plan: the decision numbers in the last column of 4.2, the cards of the screens rewritten against the export (layout, components and strings in en and ru), and section 3 amended where the export needs data it did not give, with the maintainer's consent.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm run docs:check` passes; every row of 4.2 names a decision; the rewritten cards name the export's components and strings; the maintainer approved them; the workbench is deleted after the merge.
- **Size:** documents only.

### PR 1 — Reading tokens and rule errors in the engine

- **Branch:** `p9-01-engine`. **Depends on:** nothing.
- **Goal.** [D5](#d5-reading-tokens-and-rule-errors): `readingTokens`, which the pipeline (PR 5) and the model (PR 12) read, and `Token.sokuon` and `Engine.ruleError`.
- **Creates:** `packages/engine/src/data/reading.ts` and its test.
- **Changes:** `packages/engine/src/index.ts` (`readingTokens`, `ReadingToken`); `src/matcher/` (`types.ts`, `compile.ts`, `observe.ts` or a module of its own, `engine.ts`); the golden table; `apps/web/src/pages/learn/lib/prompt/engine.ts` and `index.ts` (`ruleError`).
- **Tests:** `readingTokens` (a yōon, an extended katakana, a merged and a standalone っ, ー, a small kana alone, ゐ, ヶ, an empty string); every golden row of D5 in both strictness modes; a property: on a prompt without っ or ー, `ruleError` is false for every rejected key; coverage ≥ 95%.
- **Acceptance:** 4 (the rule errors).
- **Docs:** S5 (`readingTokens`, the API, "Rule errors", the golden rows).
- **Preview URL:** nothing changes.
- **Done when:** `pnpm --filter @nekotype/engine test` passes with its thresholds; `verify:quick` passes.
- **Size:** about 600 lines.

### PR 2 — Log format 4

- **Branch:** `p9-02-log-format-4`. **Depends on:** nothing; M4 before the merge.
- **Goal.** [D3](#d3-events-of-format-4) and, for the tasks that exist, [D4](#d4-what-each-task-logs): a recall logs its rejected keys and the reveal.
- **A draft until M4** ([Q7](#q7-the-schema-reset)). The executor opens it with `gh pr create --draft`; the description starts with M4 as a checklist, one line per device on which the maintainer is signed in, and the executor never marks it ready. The maintainer ticks each device once it shows `synced`, marks the pull request ready and merges it.
- **Changes:** `packages/shared` (`types.ts`, `log-codec.ts`, `sync-format.ts`, `runtime.ts`); `apps/api` (`routes/sync.ts` and its tests); `apps/web/src/shared/lib/idb/schema.ts` (8; the comment names format 4); `entities/learn` (`AnswerInput.misses`, the store writes `misses` and `w: null`); `pages/learn/model/session.ts` (a recall counts its rejected keys up to 9 and sets `hint` on Esc and on "show the romaji"); every producer of events (`packages/model/src/testing/`, `syntheticLog`, the simulator's adapters: `misses` 0 and `w` null); the fold ignores an `intro` of a rule until PR 6 (it is not an item).
- **Tests:** the codec round-trips the three forms; a page of format 3 decodes with `misses` 0 and `w` null and encodes back to the same bytes; the bounds (`misses` 10, `w` of 33 characters, a rule key with a task other than `word`, an `intro` of a rule); `POST /api/sync` answers `400` to `v` 3 and serves a row of format 3 to a pull; a database of schema 7 is reset; a recall with two wrong keys logs `misses` 2, with Esc `hint` true.
- **Acceptance:** 3.
- **Docs:** the ADR of the log and sync format 4 ([3.10](#310-documents-and-decision-records)); S3, S4; `docs/architecture/` (`sync.md`, `entities.md`).
- **Preview URL:** the application starts with empty data (schema 8) and behaves as before.
- **Done when:** `verify:quick` passes; CI is green with the sync e2e (`pnpm run e2e:sync`); M4 is ticked; after the merge the maintainer does M5.
- **Size:** about 700 lines.

### PR 3 — The session's strings and styles out of the first load

- **Branch:** `p9-03-session-lazy`. **Depends on:** nothing.
- **Goal.** [D28](#d28-strings-and-styles): the dictionary part `session` and the session's stylesheet, so the pull requests after it put their strings and styles where they belong. No visual change.
- **Creates:** `shared/i18n/parts/session` (en and ru, empty of P9 strings but for what this pull request moves); the session's stylesheet, imported by the session runtime.
- **Changes:** `shared/i18n` (`DictionaryPart` gains `session`); `pages/learn/session-loader.ts` (`loadSessionRuntime` waits for the part, as `loadHomePanels` waits for `home`); `app/styles/index.css` (the session's task styles out; `nk-caret`, which the home's path draws, stays); the budget test of the initial CSS if it names a figure.
- **Tests:** the part loads with the runtime and a failure of the part fails the runtime's load as a failure of the runtime does; key parity of the part; the session screen tests unchanged; e2e: a session looks as before (`learn-session.spec.ts`, desktop and `@mobile`).
- **Acceptance:** 11 (the initial CSS goes down).
- **Docs:** the ADR of the session's lazy parts ([3.10](#310-documents-and-decision-records)); S8 (the `session` part and the lazy styles); `docs/architecture/pages.md`.
- **Preview URL:** a session looks and works as before.
- **Done when:** `verify:quick` passes; CI is green with the e2e; the initial CSS is lower than before by the moved styles.
- **Size:** about 300 lines.

### PR 4 — KanjiVG data

- **Branch:** `p9-04-kanjivg`. **Depends on:** M3; M7 before the merge.
- **Goal.** [D2](#d2-stroke-data-and-the-origin-kanji-from-kanjivg): the stroke chunks, the origins chunk, the origins table and its visual audit.
- **Creates:** `packages/content/src/kanjivg/` (reading a KanjiVG SVG: the strokes in order, their numbers and the strokes of a named group) and the stroke build; `packages/engine/src/data/origins.ts` and its test; `strokes-hiragana.json`, `strokes-katakana.json`, `origins.json`; `packages/content/audit-origins.svg` (generated).
- **Changes:** `packages/content/sources.json`, `src/fetch.ts`, `src/build.ts`, the manifest; `packages/engine/src/index.ts` (`kanaOrigins`, `originOf`); `NOTICE.md` ("Third-party data", "Mirrored content sources"); `packages/content/README.md`.
- **Tests:** the reader on fixture SVGs (order, the numbers, one decimal, the strokes of a named group); every character of every learnable kana has a glyph; the glyphs have the reference's shape (`s`, `n`, `small` only when true; an origin without `n`); every entry of the origins table is a basic hiragana with a katakana pair and a `part` that is a group of its kanji's file or indexes within its strokes; a name that is no group and an index out of range fail the build; `origins.json` holds `kept` (加: strokes 0 and 1, the 力; 久: 0 and 1 as given); `small` on ゃ and ャ, not on や; the audit has one cell per entry and marks a count that differs with `≠`; each chunk ≤ 40 KB gzip.
- **The look.** Before the pull request is opened, the executor renders `audit-origins.svg` with the repository's Playwright (a script in its scratchpad), looks at every cell, and lists in the description the cells it doubts and why.
- **Acceptance:** 10 (the data).
- **Docs:** the ADR of KanjiVG ([3.10](#310-documents-and-decision-records)); S11.
- **Preview URL:** nothing changes: no chunk is imported yet.
- **Done when:** `verify:quick` passes; the build is reproducible; M7 is done.
- **Size:** about 900 lines, plus the generated files.

### PR 5 — Words written in kana

- **Branch:** `p9-05-words-content`. **Depends on:** PR 1; M2 before the merge.
- **Goal.** The words of [D1](#d1-words-written-in-kana) in the committed chunks.
- **Creates:** `packages/content/word-exclusions.json`; `packages/content/audit-words.md` (generated).
- **Changes:** `packages/content/src/jmdict/` (the `misc` and `pos` of a sense), `src/words.ts` (`selectKanaWords`; the JLPT path no longer selects words), `src/build.ts` (the selection, the learnable filter with `readingTokens`, the exclusion list, the sample, the report's counts), `src/types.ts`, the tests and fixtures; `apps/web/src/entities/prompt/content/` (the word chunks, `manifest.json`); `glyphs.txt` and the subset if they change; `packages/content/README.md`.
- **Tests:** each step of the rule on fixture entries (kanji with and without `uk` on the first sense, each priority tag by script, each unfit tag anywhere, each first-sense tag, a name, grammar only and grammar mixed with a noun, no English gloss, not learnable, on the exclusion list, homonyms merged, the order by reading); the build is reproducible (two builds, the same bytes).
- **Acceptance:** 2 (the content).
- **Docs:** the ADR of words written in kana ([3.10](#310-documents-and-decision-records)); S2.
- **Preview URL:** nothing changes: no chunk is imported yet.
- **Done when:** `verify:quick` passes; the description shows the counts of the port before the exclusion list (1,077 and 828), the build report, the histogram of word lengths in kana per script (D10 reads it) and the chunk sizes in gzip (each ≤ 40 KB); M2 is done.
- **Size:** about 600 lines, plus the generated files.

### PR 6 — The grades of P9

- **Branch:** `p9-06-grades`. **Depends on:** PR 2.
- **Goal.** [D6](#d6-grades)–[D10](#d10-the-pace-of-a-word-and-the-synthetic-log) in `@nekotype/model`, with the learn store returning verdicts.
- **Creates:** `packages/model/src/verdict.ts` and its test.
- **Changes:** `grade.ts` (the rows), `fold.ts` (verdicts, the rules, one task per moment, `learner.words`), `pace.ts` (`word`), `stats.ts` (`RecallStat.ok`), `constants.ts` (`WORDS_RECENT`), `index.ts` (`Verdict`, `verdictOf`, `RuleState`), `testing/synthetic-log.ts` (`words`, the profile of D10), `fold.properties.test.ts`; `apps/web/src/entities/learn` (`recordAnswer` returns a verdict, `recordTokens`, `stats()`, `introduce` of a rule); `apps/web/e2e/model-cost.spec.ts`, `home-cost.spec.ts` and the probe (the log with words); `packages/sim` (the adapters write the events of D4).
- **Tests:**
  - every row of D6 on synthetic answers, the slip at its edges (`misses` 1 with `ms` = line and line + 1; `misses` 2; `wrong` set; `hint`);
  - a log of format 3 folds to the same state and statistics as before the change (`syntheticLog({ answers: 40_000, seed: 1 })`);
  - the rules: an introduction, errors in a row, the count reset by a right token and by an introduction, an answer that introduces;
  - one task per moment: a word's events add 1 to `tasks`, share `lastTask` and push one interval; `learner.words` keeps 30, one per task;
  - the pace `word` apart from `recall`'s;
  - `verdictOf` equals the fold's verdict on every event of a seeded log with words and slips;
  - `syntheticLog({ words: true })` holds words of 2–10 kana, rule tokens, runs, rounds and slips in the shares of D10;
  - the property tests converge with words, rules and runs in the log.
- **Acceptance:** 4 (grades, convergence), 7 (the cost with words).
- **Docs:** the ADR of the fold of P9 ([3.10](#310-documents-and-decision-records)); S6; `docs/architecture/model.md`.
- **The simulator:** `pnpm --filter @nekotype/sim run p7` before and after in the description; the P7 lines hold (rule 4c).
- **Preview URL:** in a session, one wrong letter that is no kana's spelling, then the right romaji, on a learned kana: on `/progress` the kana stays learned and its accuracy does not drop.
- **Done when:** `verify:quick` passes; CI is green with the latency gate (`packages/model/` changed); the budgets of [D29](#d29-budgets) with their allowances.
- **Size:** about 1,200 lines, two thirds of them tests of a pure package.

### PR 7 — The task frame

- **Branch:** `p9-07-task-frame`. **Depends on:** PR 3.
- **Goal.** `KanaTask` as decisions 159–162 draw it, with every new prop built and tested by its props, and the session's current kinds (introduction, recall, recognition) shown in the new frame. The session's behaviour does not change: the compare, the feedback, the promise, the held answer and the round's ticks are wired by PR 15.
- **The design.** `docs/design/source/` (ADR 119): `components/KanaTask/README.md` and `README.md` "Learning session"; the live previews `ScreenLesson`, `ScreenLessonMobile` and `ScreenLessonKeyboard` of the design artifact. The port follows [D31](#d31-the-design-reference-in-the-code).
- **Layout** (`KanaTask`): the session line and the ticks (the round's after a `space-3` gap, `session.round`); the task on a card (`bg-raised`, `line`, `radius-md`, padding `space-8` `space-6`; no frame below 640px) that slides in (`dur-reveal`, none under reduced motion), its border `miss-dim` once `answered` is `wrong`; in the card a reserved caption line (`caption`), the prompt, the options; under it the feedback lines (`feedback`, `role="status"`), the notice line (hidden while `held`) and the key line (`Kbd enter` + `next` while `held`, a `next` text button under `pointer: coarse`; `footEnd` at its end). An introduction shows the kana's row (`row`: `jp-cell`, the new kana underlined `eye`, the known ones `fur-dim`, the rest `fur-faint`). A recall answered wrong compares in the stage (`compare`: the right kana `fur` with its romaji, the learner's left of it, smaller, `miss`, `you typed` over it). `promise` stands under the card, and in the key line left of `next` below 640px. The kinds `word` (a typed task whose stage the consumer draws, `stage`) and `break` (a screen of its own: `stage` and `progress` in place of `7 of 30`). The phone over its keyboard (decision 161): every state at 360 within 280px.
- **The current kinds in the frame:** the session passes an introduction's caption with its row (`new kana · the m row`) and its `row`, and a recognition's caption; nothing else of the session changes.
- **Strings (en / ru):** `new kana · the m row` / `новая кана · ряд m` (`the vowels` / `гласные`); `which kana is it?` / `какая это кана?`; `you typed` / `вы ввели`; `next` / `дальше`; `round · 1 of 3` / `повтор · 1 из 3`.
- **Changes:** `shared/ui/kana-task.tsx` and `task-controller.ts` (the card, the caption, the row, `answered`, `compare`, `feedback`, `promise`, `held`, `footEnd`, `stage`, `progress`, the round's ticks, the kinds `word` and `break`), the session's stylesheet; `pages/learn/ui/session-screen.tsx` (the caption and the row of the current kinds); the `session` part; `e2e/learn-session.spec.ts`.
- **Tests:** a DOM test per state through props: the card and its slide-in (none under reduced motion), the reserved caption line in recall, the row, the `wrong` border, the compare, the feedback as a status line, the promise under the card and in the key line below 640px, `held` (the key line reads `next`, no notice line), the round's ticks after their gap, `word` with a stage, `break` with its progress line; `session-screen.test.tsx` still shows 0 renders per keystroke and at most 1 on the answer; e2e at 360 × 280 (`@mobile`): a recall, a recognition and an introduction keep their key line visible.
- **Parity** ([D31](#d31-the-design-reference-in-the-code)): every state above against the reference's `KanaTask`, at 1120 and at 360.
- **Acceptance:** 1 (the frame), 7 (the hot path).
- **Docs:** `docs/architecture/pages.md`; `README.md` (the session's look).
- **Preview URL:** each task lies on a card that slides in; an introduction names its row and shows it; on a phone the key line stays above the keyboard.
- **On production** (M8): a session of the current kinds on a desktop and a phone, the card and the row as in the previews.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; the budgets of D29 with their allowances.
- **Size:** about 800 lines.

### PR 8 — The word and parts stages

- **Branch:** `p9-08-stages`. **Depends on:** PR 7.
- **Goal.** `KanaWord` and `KanaParts` as decisions 163, 166, 169, 170 and 173 draw them, and the controller of a stream ([D22](#d22-typed-answers-by-token): `setToken`). No session uses them yet.
- **The design.** `docs/design/source/components/KanaWord/README.md`; the word, rule, run, build and transfer states of `ScreenLesson` and `ScreenLessonKeyboard`. The port follows D31: what the reference draws from `cur`, `buffer` and `typing` the code writes through the controller.
- **Layout:** `KanaWord` — `tokens` (a merged っX one token), the size by length (up to 4 kana `jp-solo`, up to 7 `jp-solo-sm`, longer `jp-test-sm`; below 640px up to 5 `jp-solo-sm`), one caret and one buffer under the current token, typed tokens `fur-dim`, the reserved line under the word (the reading once `done`), the meaning under it, `marks` (`wrong` in `miss` with a `miss-dim` underline, `rule` on the first character of its token, `eye` on a rule's mark), `ghost` (the ghost hint with its `marks` in `eye`), `note`, `run` (one wrapping line, `jp-test-sm`; 22px below 640px). `KanaParts` — `items` (`{ kana, tone }`, `{ op }` in `mono-counter` `fur-dim`, `{ node }`), the caret before the first kana and the buffer under it while typing, `ghost` or `reading`.
- **Creates:** `shared/ui/kana-word.tsx` (`KanaWord`), `shared/ui/kana-parts.tsx` (`KanaParts`) and their tests.
- **Changes:** `shared/ui/task-controller.ts` (`setToken`), the barrel of `shared/ui`, the session's stylesheet.
- **Tests:** each state through props (sizes at 4, 5, 7 and 10 kana and below 640px, each mark, the ghost and its marks, the note, the meaning only when `done`, a run wrapping); `setToken` and `setBuffer` move the caret and the buffer and set `is-typed` with no render (a render counter); `KanaParts` with its items, tones, ops and a node.
- **Parity** (D31): every state above against the reference, at 1120 and at 360.
- **Acceptance:** 1, 7.
- **Docs:** `docs/architecture/pages.md` (the stream controller).
- **Preview URL:** nothing changes.
- **Done when:** `verify:quick` passes.
- **Size:** about 500 lines.

### PR 9 — The report dialog

- **Branch:** `p9-09-report-dialog`. **Depends on:** PR 3.
- **Goal.** [D26](#d26-the-report-dialog) as decision 167 draws it, built apart from the session: PR 17 opens it from a word task.
- **The design.** `components/Dialog`, `RadioGroup` and `Input` of `docs/design/source/`; the report states of `ScreenLesson`. The port follows D31.
- **Layout:** the shared `Dialog`: the title; the word (`jp-body`) and its meaning (`ui-body`, `fur-dim`); `RadioGroup` of the three reasons, none chosen (16px circles, `line-strong`; chosen: `fur` border and an `eye` dot; 44px rows under `pointer: coarse`); `Textarea` (`Input`'s field, three lines, 88px, resizable vertically); the Turnstile slot, 65px, full width; the reserved `Notice` in the actions row; `cancel`, `send` (enabled once a reason is chosen and the check passed). The states of decisions 115–116.
- **Strings (en / ru):** `Report a problem with this word` / `Ошибка в слове`; `What is wrong` / `Что не так`; `wrong reading` / `неверное чтение`; `wrong translation` / `неверный перевод`; `other` / `другое`; `Comment (optional)` / `Комментарий (необязательно)`; `cancel` / `отмена`; `send` / `отправить`; `sending…` / `отправка…`; `Report sent.` / `Сообщение отправлено.`; `close` / `закрыть`; `offline. reporting is available online only.` / `нет сети. отправка только онлайн.`; `verification failed. try again.` / `проверка не пройдена. попробуйте ещё раз.`; `failed to send. check the connection and try again.` / `не удалось отправить. проверьте соединение.`; `verification did not load.` / `проверка не загрузилась.`; `retry` / `ещё раз`.
- **Creates:** `pages/learn/ui/report/` (restored from 753df9f, the `Select` replaced by the `RadioGroup`), to be loaded by a dynamic import of its own (PR 17); `pages/learn/lib/turnstile.ts`; `shared/ui/radio-group.tsx` and `shared/ui/textarea.tsx`; their tests.
- **Changes:** `shared/ui` (the barrel); the `session` part.
- **Tests:** the dialog in each state with a fake Turnstile loader and a fake request (sending, sent, check failed, send failed, check not loaded, offline); no reason chosen when it opens and `send` disabled until one is; the request's body (`itemId`, `contentVersion`, `reason`, `comment`, the token); the Turnstile script requested only when the dialog opens; `onClose` called on cancel, on ✕ and after sent; `RadioGroup` by arrows, its roles and names; `Textarea`'s label.
- **Parity** (D31): every state against the reference's `Dialog`, `RadioGroup` and `Textarea`, at 1120 and at 360.
- **Acceptance:** 9 (the dialog).
- **Docs:** `docs/architecture/pages.md`.
- **Preview URL:** nothing changes: no screen opens the dialog yet.
- **Done when:** `verify:quick` passes; nothing outside its tests imports the dialog yet (PR 17 adds its dynamic import, and its chunk with it).
- **Size:** about 700 lines, much of it restored.

### PR 10 — The pair differences

- **Branch:** `p9-10-pair-lines`. **Depends on:** PR 3; M6 before the merge.
- **Goal.** The 47 lines of [D23](#d23-feedback-that-teaches) in the `session` part, one per pair of `similarPairs`, in English and Russian. The feedback of PR 15 shows a line once its key exists; until this pull request is merged it shows none.
- **Strings:** the keys `session.pair.<h|k>.<a>.<b>` (`a` and `b` the romaji of the pair in the table's order: `session.pair.h.nu.me`, `session.pair.k.shi.tsu`); the sample of decision 160 is `ぬ ends in a loop, め does not` / `у ぬ на конце петля, у め её нет`. Each line names a difference of shape that the eye can check, in lower case, with the two kana written as kana, in at most 60 characters: one line on a desktop, two on a phone.
- **Creates:** the lines in the part; a test.
- **Tests:** every pair of `similarPairs` has a line in en and in ru; no key names a pair outside the table; each line holds both kana of its pair and is at most 60 characters.
- **The table for M6.** The description lists the 47 pairs: the two kana, the English line, the Russian line.
- **Acceptance:** 1 (key parity).
- **Docs:** none beyond the description.
- **Preview URL:** nothing changes until PR 15.
- **Done when:** `verify:quick` passes; M6 is done.
- **Size:** about 250 lines.

### PR 11 — Stroke order in the kana details

- **Branch:** `p9-11-stroke-order`. **Depends on:** PR 4.
- **Goal.** The details of [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen) as decision 174 draws them, `Strokes` for the origin kanji of PR 19, and the KanjiVG credit on `/about` (175).
- **The design.** `docs/design/source/components/StrokeOrder/README.md`; the kana details in `README.md` "Progress"; the live preview `ScreenProgress` (the `details` select) and the card `StrokeOrder` of the design artifact. The port follows D31 (`StrokeGlyph`, `PEN`).
- **Layout:** at the top of the details, left of the places of the mnemonic (P11) and `listen` (P10): each glyph in a box (112px, 88px below 640px; `line`, `bg`, `radius-sm`), strokes `fur` 3.5 units, numbers Mono 11 units `fur-dim` at KanjiVG's places; a small kana at 70% from the bottom left; under the boxes `replay` (`Button secondary sm`, icon `reset`). Opening the dialog draws the strokes at one pen speed (`PEN`, D27), the current one `eye`; nothing moves under reduced motion. The drawing animates `stroke-dashoffset` (decision 177).
- **Strings (en / ru):** `replay` / `ещё раз`; `stroke order: ぬ` / `порядок черт: ぬ` (the image's name); on `/about` `Sources` / `Источники` and `Ulrich Apel · stroke order and origin kanji` / `Ulrich Apel · порядок черт и иероглифы-предки` (the JMdict row comes with PR 17).
- **Creates:** `shared/ui/strokes.tsx` (`Strokes`, `StrokeOrder`, `PEN`) and its test; `entities/prompt/index.ts` when PR 13 has not created it yet ([D20](#d20-words-in-the-app)).
- **Changes:** `features/kana-details` (the stroke order, its loading); `entities/prompt` (`loadStrokes`); `shared/i18n/parts/details` and `about`; `pages/about` (the sources section); `e2e/progress.spec.ts` (the details show the strokes).
- **Tests:** a kana, a yōon (two boxes, the small kana scaled) and a kana with a dakuten draw their strokes in order with numbers; each stroke's duration follows its length, with `PEN.min` and `PEN.lift` (an injected scheduler); `replay` draws again; loading and failure keep the place and disable `replay`; reduced motion draws every stroke at once; `Strokes` of an origin: no box, no numbers, `kept` in `eye`, drawn once; the chunk is not loaded until a dialog opens.
- **Parity** (D31): the details and `/about` against `ScreenProgress` and `StrokeOrder`, at 1120 and at 360.
- **Acceptance:** 10.
- **Docs:** S12; `docs/architecture/pages.md`.
- **Preview URL:** a kana's details on `/progress` draw its stroke order, long strokes taking longer, and `replay` draws it again; `/about` names KanjiVG.
- **On production** (M8): the details of a kana, a yōon and a small kana on a desktop and a phone.
- **Done when:** `verify:quick` passes; CI is green with the e2e; the stroke chunks are lazy and ≤ 40 KB gzip.
- **Size:** about 600 lines.

### PR 12 — The session plan

- **Branch:** `p9-12-session-plan`. **Depends on:** PRs 1 and 6.
- **Goal.** [D11](#d11-words-in-the-model)–[D13](#d13-the-order-of-a-session) and [D15](#d15-the-two-rules) in `@nekotype/model`: words, the order of a session, the closing word, the round, the rules. `SessionTask` and `PlanFeature` hold every kind of D12, but the planner's task stays the planner's own kind (a plain introduction, a recall, a recognition) and the run's slot gives nothing: PR 14 adds the mix and the run. The application still asks `nextTask`; PR 15 switches it.
- **Creates:** `packages/model/src/words.ts`, `src/session.ts` and their tests.
- **Changes:** `packages/model/src/constants.ts` (`WORD_EVERY`, `WORDS_START`, `ROUND_MAX`, `RULE_ERRORS`, `RULE_WORDS`), `src/index.ts`.
- **Tests:**
  - words: the start at 25 readable words of the selected track, never the other track's; a word after every 5 planner tasks; a slot that waits when no word is readable; no word of `learner.words` or of the session;
  - the closing word at the 30th task and when the planner ends early, only of the session's kana; none when the session's kana make no word;
  - the round: first-error order, at most 5, each once, `record` ignored once it started, null after it, empty when nothing was wrong; `roundKana` null before the round and its kana in order once it starts;
  - `seen`: the kana of every kind of task, each once, in the order first met; the closing word is made of them;
  - the rules: due when not introduced and a word would be readable, or after 2 errors in a row; one a session, っ first; the 2 rule words after it;
  - each feature off falls back as D12 says; the features of PR 14 give the planner's own kind;
  - a property over 200 seeded sessions: every planner task's kana is the one `nextTask` gave, and every session ends.
- **Acceptance:** 5 (words, the closing word, the round, the rules).
- **Docs:** the ADR of the session plan ([3.10](#310-documents-and-decision-records)), with the Status line of ADR 118; S7 (all of the plan, the mix and the run included); A54; `docs/architecture/model.md`.
- **Preview URL:** nothing changes.
- **Done when:** `pnpm --filter @nekotype/model test` passes with its thresholds; `verify:quick` passes.
- **Size:** about 900 lines.

### PR 13 — Words in the client

- **Branch:** `p9-13-words-client`. **Depends on:** PRs 1 and 6.
- **Goal.** [D20](#d20-words-in-the-app) without the session's loading (PR 15) and [D22](#d22-typed-answers-by-token)'s `tokenAnswers`: what a session needs to load words and to judge a typed stream, with no screen yet.
- **Creates:** `entities/prompt/index.ts` (unless PR 11 created it) and `entities/prompt/model/content.ts` (`loadWordItems`, `prefetchWords`, `loadContentVersion`) and their tests; `pages/learn/lib/typed-answer.ts` and its test.
- **Changes:** `app/prefetch.ts` (the word chunk on idle when the selected track has an introduced kana); `scripts/check-budget.mjs` and its test (content chunks from P9, with the checks of `SYNC_ENTRY`); `docs/spec/quality.md` if a row names "no content".
- **Tests:**
  - `tokenAnswers`: a plain word; `te` for って (a rule error, て right); `ta` for って (て wrong as た); a standalone っ; ー; a reveal on a kana and on a merged token (the rule and X); `misses` saturating at 9; the time of each token by A37 from the token before it; a run of 12 kana;
  - `loadWordItems` reads a chunk into `WordItem`s; a failure rejects, and a second call tries again; `prefetchWords` swallows a failure;
  - the budget test fails a content chunk that a route imports statically, and a content chunk over 40 KB.
- **Acceptance:** 2 (shipped lazily).
- **Docs:** `docs/architecture/` (`entities.md`: `entities/prompt`; `quality-gates.md`: content chunks).
- **Preview URL:** nothing visible: the word chunk is fetched on idle (the network panel shows it).
- **Done when:** `verify:quick` passes; the word chunks are lazy and ≤ 40 KB gzip.
- **Size:** about 700 lines.

### PR 14 — The mix, the run and the outline

- **Branch:** `p9-14-mix-run`. **Depends on:** PR 12.
- **Goal.** [D14](#d14-the-mix) and [D16](#d16-the-fluency-run) in the session plan, and the outline of [D18](#d18-the-forecast-and-the-outline) that names the words (Q6).
- **Changes:** `packages/model/src/session.ts` (the mix, the contrast set, find the error, the run's slot and its kana), `src/constants.ts` (`FLUENCY_AT`, `FLUENCY_MIN`, `FLUENCY_MAX`, `CONTRAST_OPTIONS`, `MISMATCH_MAX_KANA`), `src/forecast.ts` (the outline's word slots, `Outline.words`), `src/index.ts`; `apps/web/src/pages/learn/lib/home-copy.ts` (the words' part of the outline) and `shared/i18n/parts/home` (`home.outline.words`).
- **Strings (en / ru):** `home.outline.words`, plural: `{count} word` / `{count} words`; `{count} слово` / `{count} слова` / `{count} слов`.
- **Tests:**
  - the mix: each row of D14 with its precedence and its limit; the contrast set without shared spellings; find the error only on words of at most 9 kana;
  - the run: eligibility, the 12 slowest, the shuffle, none under 8 or without statistics;
  - the property of PR 12 extended: no kind passes its limit, and every kana task's kana is the one `nextTask` gave;
  - the outline: as today with no recent word of the track and on the other track; with one, 25 planner tasks and 5 words in 30; the forecast unchanged (the same plays as before on a seeded state);
  - the home's copy: the words' part with its plural, left out at 0 and while the `home` part has not loaded.
- **Acceptance:** 5 (the mix, the run).
- **Docs:** S7 (the outline); `learning.md` "The outline"; `docs/architecture/model.md`.
- **Preview URL:** nothing changes until a word has been given (PR 17).
- **Done when:** `pnpm --filter @nekotype/model test` passes with its thresholds; `verify:quick` passes; CI is green with the latency gate (`packages/model/` changed); the budgets of D29 with their allowances.
- **Size:** about 800 lines.

### PR 15 — The session on the plan

- **Branch:** `p9-15-session-screen`. **Depends on:** PRs 7, 12 and 13.
- **Goal.** The session plans with `createSessionPlan` ([D21](#d21-the-session)): verdicts, the held answer, the feedback of [D23](#d23-feedback-that-teaches) (decision 160), the round with its screen (feature `round`, decision 162), the word chunk loaded with the runtime (D20), the session's code split by mechanic, and the chunk `session-plan` ([D29](#d29-budgets)).
- **The design.** As PR 7; the round's screen and the held states of `ScreenLesson`, `ScreenLessonMobile` and `ScreenLessonKeyboard`.
- **Layout:** a wrong answer turns the card `wrong` and waits (`held`); a recall answered wrong compares in the stage; under the card the pair's difference when its key exists (PR 10) and the promise while the round has room. The round's screen is `KanaTask kind="break"`: `round · 3 kana` in the session line, the ticks, a card with the cat `neutral`, `once more: the kana you missed` (`ui-heading`), the round's kana (`jp-test-sm`), one line, `start` (`primary`, `lg`, `Kbd enter`). Its tasks are recalls; the session line reads `round · 1 of 3`; an error in the round has no promise.
- **Strings (en / ru):** `me is め · this is ぬ nu` / `me — это め · а здесь ぬ nu` and `this is ぬ nu` / `здесь ぬ nu` (screen reader); `め is me · nu is ぬ` / `め — это me · nu — это ぬ` (a choice, screen reader); the promise `session.promise`, plural by the number of kana: `ぬ comes back at the end of the session` / `ぬ вернётся в конце сессии`, `ぬ, め come back at the end of the session` / `ぬ, め вернутся в конце сессии`; `round · 3 kana` / `повтор · 3 каны` (a plural key with `tPlural`: `1 кана`, `3 каны`, `5 кан`); `once more: the kana you missed` / `ещё раз: каны с ошибками`; `each comes back once, then the summary` / `каждая — один раз, потом итог`; `start` / `начать`.
- **Creates:** `pages/learn/lib/feedback.ts`; `pages/learn/model/typed.ts` and `model/choice.ts` (the mechanics, D21).
- **Changes:** `pages/learn/model/session.ts` (the plan, verdicts, the held answer, the round and its screen, the ticks, the summary's errors, `end` after the round), `lib/constants.ts` (`SESSION_FEATURES` with `round`), `lib/summary.ts`, `ui/session-screen.tsx`, `ui/session-runtime.tsx`, `session-loader.ts` (the word chunk with `Promise.all`; the runtime reads it with `wordEntry`); `vite.config.ts` (`session-plan`) and `scripts/check-budget.mjs` with its test (the chunk by name); the `session` part; `e2e/learn-session.spec.ts`.
- **Tests:** `session-screen.test.tsx` shows 0 renders per keystroke and at most 1 on the answer; a wrong recall compares in the stage, shows the pair's difference for a pair with a key and none for one without, the promise while the round has room and none when it is full or in the round, and waits for `Enter` (keys before it do nothing); a wrong choice waits too; a slip shows nothing and keeps its tick; the round's screen lists `roundKana` before its first task, then the round's line, ticks and order, `end` after it, and no `end` when the learner leaves during it; the summary lists wrong kana, not slips; a word chunk that fails to load gives a session without words; e2e: a session with an error ends with its round; at 360 × 280 the key line of a held wrong answer is visible.
- **Parity** (D31): the held states, the compare and the round's screen, at 1120 and at 360 × 280.
- **Acceptance:** 1 (the screen), 7 (the hot path), 8 (the round).
- **Docs:** S8; `docs/architecture/pages.md` (the core and its mechanics); `README.md` (the session).
- **Preview URL:** a wrong answer shows your kana next to the right one, their difference for a pair such as ぬ and め once PR 10 is in, and that the kana comes back, and waits for Enter; after the last task a screen lists the kana to repeat, then the round brings them back; one wrong letter that is no kana's spelling, then the right romaji, leaves the tick as a right one.
- **On production** (M8): an error with its feedback and the round at the end, on a desktop and a phone with its keyboard.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; the budgets of D29 with their allowances.
- **Size:** about 900 lines.

### PR 16 — The simulator on the production plan

- **Branch:** `p9-16-sim`. **Depends on:** PRs 5 and 14.
- **Goal.** [D19](#d19-the-simulator-on-the-production-plan): `packages/sim` plays the production session plan, and its lines are measured.
- **Creates:** `packages/sim/src/p9.ts`.
- **Changes:** `packages/sim/src/policies/production.ts` (`plan: true`), the harness (the new kinds), `package.json` (`p9`).
- **Tests:** the adapter turns each kind of `SessionTask` into the harness's task and its answers into the events of D4; the research options still give the tables of parts 1–3 (`p9-words`, `p9-tasks`, `p9-planner`).
- **Acceptance:** 6.
- **Docs:** the output of `pnpm --filter @nekotype/sim run p9` in the description, with each line of D19 and the forecast's table of [section 2](#2-what-was-checked) on the production plan, on hiragana and on both tracks.
- **Preview URL:** nothing changes.
- **Done when:** the lines of D19 are met (D18 says what to do if the forecast misses); `verify:quick` passes.
- **Size:** about 500 lines.

### PR 17 — Word tasks

- **Branch:** `p9-17-word-tasks`. **Depends on:** PRs 5, 8, 9 and 15.
- **Goal.** The features `word`, `closing` and `rule` as decisions 163–166 draw them: the stream mechanic (`model/stream.ts`) with `tokenAnswers` and `recordTokens`, the meaning after the answer, the closing word's screen, the rule introductions, the report action opening the dialog of PR 9, JMdict and EDRDG on `/about` (175), and the chunk `session-stream` ([D29](#d29-budgets)).
- **The design.** `components/KanaWord`, `KanaTask` and `README.md` "Learning session"; the word, rule and report states of `ScreenLesson`, `ScreenLessonMobile` and `ScreenLessonKeyboard`.
- **Layout:** a word is `KanaTask kind="word"` with `KanaWord`: the word in the place of the kana, one buffer under the current kana, typed kana `fur-dim`; once answered the reading in the reserved line, the English meaning under it, held for `Enter`. An error in a word: first its first wrong kana as a recall's error (caption `word · <the word>`), `Enter`, then the word with every wrong kana in `miss` and the promise naming the kana the round takes (Q5); a rule error: the word with the mark in `miss` and the rule's line, no promise. The closing word: first its screen (`kind="break"`, the cat `content`, `plan.seen`), then the word with its caption. A rule introduction: the example word, the mark and the letters it gives in `eye` (`marks`, `ghost.marks`), the ghost hint typed once, the rule's line (`note`). `report a problem` (`Button text`) at the end of the key line once answered (left of `next` below 640px); the session waits while the dialog is open, and closing it gives the focus back to the session's input. The word chunk's `WordItem` gives the meaning; the reading is the kana's `displayRomaji` joined.
- **Strings (en / ru):** `word` / `слово`; `a word of today's kana` / `слово из сегодняшних кан`; `one last word` / `слово напоследок`; `all its kana were in this session` / `все его каны были в этой сессии`; `rule` / `правило`; `rule · once more` / `правило · ещё раз`; `っ doubles the next consonant` / `っ удваивает следующую согласную` (ッ on katakana); `ー makes the vowel long: type -` / `ー удлиняет гласную: набирайте -`; `っ doubles the next consonant: もっと is motto` / `っ удваивает следующую согласную: もっと — это motto`; `ー makes the vowel before it long: コーヒー is ko-hi-` / `ー удлиняет предыдущую гласную: コーヒー — это ko-hi-` (`-` is the spelling both strictness modes accept, engine.md); `report a problem` / `сообщить об ошибке`; on `/about` `JMdict`, `words and their meanings` / `слова и их значения`.
- **Creates:** `pages/learn/model/stream.ts`; `e2e/learn-words.spec.ts`; `e2e/sync/report.spec.ts`.
- **Changes:** `pages/learn/model/session.ts` (the closing screen), `lib/constants.ts`, the screen and its use of the stream controller; `vite.config.ts` (`session-stream`) and `scripts/check-budget.mjs` with its test (the chunk by name); `pages/about` (the JMdict row); the `session` and `about` parts; `e2e/latency.spec.ts` (a log in which words open, so word keystrokes are samples, a word of at least 8 kana among them); the e2e server's Turnstile verifier only if the test needs it.
- **Tests:** only the selected track's words; 0 renders per keystroke of a word; the meaning absent before the answer and shown after it; an error in a word shows the pair first and, on `Enter`, the word with each wrong kana marked and the promise naming them; a rule error shows the rule and no promise; the closing word is the last task and its screen lists `plan.seen`; a rule introduction logs an `intro` of the rule; `report a problem` opens the dialog after the answer, never while the word is typed, and the focus comes back on close; e2e: a word task, its meaning after the answer, and a rule introduction; on the sync configuration, from a word task, open the dialog, choose a reason, send, and see the server's answer.
- **Parity** (D31): the word, error, closing, rule and report states, at 1120 and at 360 × 280.
- **Acceptance:** 1, 2, 7, 8, 9, 10 (JMdict).
- **Docs:** S9, S10; `README.md` (the session, the shipped content and its credits); `docs/architecture/` (`pages.md`, `quality-gates.md`: the latency gate's word keystrokes).
- **Preview URL:** from a fresh start, after the k row (25 readable words) a word comes after every 5 tasks; its meaning appears only after it is typed; a word with two wrong kana marks both and says both come back; before the first word with っ the rule is introduced on an example; the last task of a session is a word of its kana, after a screen with the cat; `report a problem` opens the dialog with the word and its meaning, `send` waits for a reason, and offline the action is disabled; `/about` names JMdict and EDRDG.
- **On production** (M8): once 25 words are readable, a word after every 5 tasks, its meaning, a closing word, a rule introduction, and a report sent from a word with the real Turnstile; the home's outline names the words.
- **Done when:** `verify:quick` passes; CI is green with the latency gate and word keystrokes among its samples, the e2e and the sync e2e; the budgets of D29 with their allowances.
- **Size:** about 900 lines.

### PR 18 — Choice tasks

- **Branch:** `p9-18-choice-tasks`. **Depends on:** PRs 14 and 15.
- **Goal.** Contrast, hiragana or katakana? and find the error of [D24](#d24-choice-and-build-tasks) as decisions 168, 171 and 172 draw them; the features `contrast`, `script` and `mismatch`, in the choice mechanic.
- **The design.** `components/OptionCard` and `KanaTask`; the choice states of `ScreenLesson`, `ScreenLessonMobile` and `ScreenLessonKeyboard`.
- **Layout:** contrast — `options: { count, large }`: as many columns as options, cards 136px with 48px kana (56px and 32px below 640px). Find the error — `OptionCard` with `sub`, `options.find` (five a row below 640px); the odd card shows the wrong romaji struck after the answer. Hiragana or katakana? — `promptKana` (48px on a 56px line below 640px), two `OptionCard text`, `options.count` 2.
- **Strings (en / ru):** `which of the similar kana is it?` / `какая из похожих кан?`; `find the error` / `найдите ошибку`; `し was shown as chi; it is shi` / `у し было chi, а это shi`; `hiragana or katakana?` / `хирагана или катакана?`; `hiragana` / `хирагана`; `katakana` / `катакана`; `リ is katakana; its hiragana is り` / `リ — катакана; в хирагане это り`.
- **Changes:** `pages/learn/model/choice.ts`, `lib/constants.ts`, the screen, `shared/ui/kana-task.tsx` (`promptKana`, `options`), `shared/ui/option-card.tsx` (`sub`, `text`); the `session` part.
- **Tests:** each kind's view, keys and log (D4): contrast's options shuffled, its columns and its `alt`; hiragana or katakana by 1 and 2; find the error by number (1–9) and by click, `ok` only at `index`, the struck romaji after a miss, the line and the promise; one render per choice.
- **Parity** (D31): each kind before, after a right and after a wrong answer, at 1120 and at 360 × 280.
- **Acceptance:** 1, 7.
- **Docs:** S13 (these three); `docs/architecture/pages.md`.
- **Preview URL:** on a log with a confused pair, a recognition of its kana becomes a contrast with larger kana; one find-the-error and one hiragana-or-katakana come in a session when their conditions hold.
- **On production** (M8): each of the three on a desktop and a phone, when its condition holds on the maintainer's progress.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; the budgets of D29 with their allowances.
- **Size:** about 700 lines.

### PR 19 — Build and transfer

- **Branch:** `p9-19-build-transfer`. **Depends on:** PRs 4, 8, 11, 14 and 15.
- **Goal.** Build and transfer of [D24](#d24-choice-and-build-tasks) as decisions 169 and 170 draw them, their introductions, and the origin kanji of [D27](#d27-stroke-order-and-the-origin-kanji-on-the-screen); the features `build` and `transfer`.
- **The design.** `components/KanaWord` (`KanaParts`), `StrokeOrder` (`Strokes`) and `KanaTask`; the build and transfer states of `ScreenLesson`, `ScreenLessonMobile` and `ScreenLessonKeyboard`.
- **Layout:** transfer — the introduction `KanaParts` with `Strokes` (the origin, `kept` in `eye`, the rest `fur-dim`, 88px, 56px below 640px; drawn once), `→`, the hiragana `fur-dim`, the katakana `fur`; without the origin the pair alone; the task `promptKana` (48px on a 56px line below 640px) and four katakana. Build — the introduction `か + ゛ → が`; the task the parts with the caret, once answered `→ きゃ` and its reading; a right build holds `ANSWER_PAUSE_MS`, a wrong one waits for `Enter` with the comparison of D23.
- **Strings (en / ru):** `new katakana` / `новая катакана`; `from 加` / `из 加`; `the same kana in katakana` / `та же кана катаканой`; `type the kana they make` / `наберите кану из частей`; a wrong transfer `タ is ta · か ka → カ` / `タ — это ta · か ka → カ`.
- **Changes:** `pages/learn/model/typed.ts` (build, the build and transfer introductions), `model/choice.ts` (transfer), `lib/constants.ts`, `lib/distractors.ts` if transfer needs it, `session-loader.ts` (`origins.json` when the track is katakana), the screen; `entities/prompt` (`loadOrigins`); the `session` part; `apps/web/glyphs.txt` and the Noto subset (`゛` U+309B, `゜` U+309C, decision 170).
- **Tests:** transfer's options of katakana, its keys and log; a wrong transfer keeps the marks and shows its line; build typed and timed, its result after the answer, the hold of a right one and the wait of a wrong one; a build and a transfer introduction (the origin drawn with its `kept` strokes when the table has one, the pair alone without the chunk), each logging an `intro`; 0 renders per keystroke of a build.
- **Parity** (D31): both introductions and both tasks, at 1120 and at 360 × 280.
- **Acceptance:** 1, 7, 10 (the origins on screen).
- **Docs:** S13 (these two); `docs/architecture/pages.md`.
- **Preview URL:** on katakana with the hiragana learned, an introduction draws the kanji with the kept part in blue, then the pair; が is introduced and practised from か and ゛.
- **On production** (M8): a transfer introduction with its origin and a build, on a desktop and a phone, when their conditions hold.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; the budgets of D29 with their allowances; the subset stays within its budget.
- **Size:** about 700 lines.

### PR 20 — The fluency run

- **Branch:** `p9-20-fluency`. **Depends on:** PRs 14 and 17.
- **Goal.** [D25](#d25-the-fluency-run-on-the-screen) as decision 173 draws it, in the stream mechanic; the feature `fluency`.
- **The design.** `components/KanaWord` (`run`); the run's states of `ScreenLesson`, `ScreenLessonMobile` and `ScreenLessonKeyboard`.
- **Layout:** `KanaTask kind="word"` with `KanaWord run`: the caption, the 12 kana in one line (`jp-test-sm`; 22px in two lines below 640px), the caret and the buffer as in a word, typed kana `fur-dim`, a wrong one `miss`. The end: `done` under the card and `Enter`; with a wrong kana the pair of the first one as a line, its difference and the promise naming every wrong kana the round takes.
- **Strings (en / ru):** `run: type them in a row` / `прогон: наберите подряд`; `done` / `готово`; `you typed ぬ nu · here め me` / `вы ввели ぬ nu · здесь め me`.
- **Changes:** `pages/learn/model/stream.ts` (the run), `lib/constants.ts`, the screen; the `session` part; `e2e/fluency.spec.ts`; `e2e/latency.spec.ts` (a run's keystrokes among the samples).
- **Tests:** the run's kana are the plan's; a keystroke renders nothing and the end at most once; one `fluency` event per kana at one moment, with `misses`, `hint` and `wrong`; the end waits for `Enter`; a wrong kana goes to the round; no timer or number on screen; e2e: a seeded log with 8 accurate learned kana gives a run at the 15th task, typed to its end.
- **Parity** (D31): the run while typed, at its end and with an error, at 1120 and at 360 × 280.
- **Acceptance:** 7, 8.
- **Docs:** S14; `docs/architecture/pages.md`.
- **Preview URL:** with 8 accurate learned kana, the 15th task of a session is a run of the slowest of them in one line, with no timer or count, ending with `done`; a wrong kana in it comes back in the round.
- **On production** (M8): a run on a desktop and a phone with its keyboard.
- **Done when:** `verify:quick` passes; CI is green with the latency gate; the budgets of D29 with their allowances.
- **Size:** about 500 lines.

### PR 21 — Close the phase

- **Branch:** `p9-21-close`. **Depends on:** every other pull request, M8.
- **Does:**
  - the leftovers audit, with its command and result in the description: `git grep -n -E "N5–N4 by reading|no content is shipped before P9|before P9|decision 152|none exists before P9|places of"` over `apps`, `packages`, `scripts`, `docs/spec`, `docs/architecture`, `docs/design/source`, each hit removed or explained (research, ADRs and the archive are history);
  - the export against the code: each kind of task, the round, the feedback, the report dialog, the stroke order and `/about` match their previews in the design artifact (a list in the description, from the parity notes of PRs 7–11 and 15–20);
  - `pnpm run build && pnpm run budget`, and the CI figures of the latency, `model-cost` and `home-cost` tests;
  - `pnpm --filter @nekotype/sim run p9` on the merged code;
  - `docs/research/2026-11-NN-p9-acceptance.md` (the day of the check): a row per acceptance item with its line, its measure and its proof, and its row in `docs/README.md`.
- **Docs:** S15; `README.md` and `docs/architecture/` reread against the code; `docs/adr/README.md` has the ADRs of P9; this file moved to `docs/archive/p9-plan.md` with a note on top, and the link of P9 in `phases.md` pointed there; its row in `docs/README.md` removed.
- **Done when:** every row of the table below names a passing test or check in the description; every "On production" list of M8 is marked done, or its condition has not arisen and the description says so.
- **Size:** about 400 lines, documents.

### Acceptance items and pull requests

The items of the P9 acceptance in [phases.md](docs/spec/phases.md), in its order.

| #   | Acceptance item                                                                                                                                                                  | PR                           | Proved by                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | The design comes first, draws every P9 task in full and matches the code; key parity; every task works from the keyboard and is named for screen readers                         | D, 7–11, 15, 17–21           | ADR 119 and the export; DOM tests by role and name; the parity test; the check of PR 21       |
| 2   | The word chunks: the rule, at most 40 KB gzip each, by dynamic import only; the maintainer read a sample                                                                         | 5, 13, 17                    | the build report, `audit-words.md` and M2; `check-budget.mjs`                                 |
| 3   | Format 4: its events, format-3 pages read, `400` for a batch of format 3, a database of schema 7 reset                                                                           | 2                            | `log-codec.test.ts`, the API's sync tests, `database.test.ts`                                 |
| 4   | Every grade of ADR 117 and ADR 118, point 5, has a test; the rule errors are golden tests; two devices converge with words, rules and runs                                       | 1, 6                         | `grade.test.ts`, `verdict.test.ts`, the engine's golden tests, `fold.properties.test.ts`      |
| 5   | The session plan has a test for each rule of ADR 118                                                                                                                             | 12, 14                       | `session.test.ts` of the model                                                                |
| 6   | The simulator runs the production plan and meets the lines of D19                                                                                                                | 16, 21                       | `pnpm --filter @nekotype/sim run p9` in PR 16 and in the acceptance note                      |
| 7   | A keystroke of a typed task renders nothing and its answer at most once; the latency test holds with word keystrokes; the fold, the forecast and the home's line hold with words | 6, 7, 8, 15, 17–20, every PR | `session-screen.test.tsx`; `latency.spec.ts`, `model-cost.spec.ts`, `home-cost.spec.ts` in CI |
| 8   | An e2e plays a session with a word, its meaning and the round, and one with a fluency run                                                                                        | 15, 17, 20                   | `learn-session.spec.ts`, `learn-words.spec.ts`, `fluency.spec.ts`                             |
| 9   | The report dialog on a word task sends with Turnstile, loads its script only when opened, and is disabled offline                                                                | 9, 17                        | the dialog's DOM tests; `e2e/sync/report.spec.ts`                                             |
| 10  | Every learnable kana's details show its stroke order; KanjiVG, JMdict and EDRDG are credited on `/about`, KanjiVG in `NOTICE.md`                                                 | 4, 11, 17, 19                | the stroke tests; the details' DOM test; the `/about` test                                    |
| 11  | Every budget holds, with the lines of this plan                                                                                                                                  | every PR                     | `check-budget.mjs`; the figures of each pull request                                          |
| 12  | The spec describes P9                                                                                                                                                            | 1–21                         | S1–S15; the audit of PR 21                                                                    |

## 8. Instructions for executor agents

One executor takes one pull request of section 7.

1. **Read first:** `AGENTS.md`; in this file sections 1, 8 and 9, your card in section 7, the decisions it names in section 3 and the ones they link; for a pull request with screens, section 4, [D31](#d31-the-design-reference-in-the-code) and the export in `docs/design/source/`; the ADRs your decisions cite (116–118 for the model); the spec sections your card names. Check the Status table and the dependency table of section 7: every pull request yours depends on is merged and every manual step it waits for is marked done. If not, stop and tell the maintainer what is missing.
2. **Make no decision this plan does not hold.** Types, names, files, keys and constants of section 3 are copied as written. How a screen looks is the export's: build what it draws, with its names and strings, by the rules of D31. What the plan and the export leave open you do not fill by taste: ask the maintainer (in Russian) and wait. The functions between the session's core and a mechanic are the one thing an executor writes for the others: PR 15 defines them and documents them in `docs/architecture/pages.md` ([D21](#d21-the-session)).
3. **Deviations.** The code wins where it and the plan disagree. When a contract cannot be built as written (an API that does not exist or behaves otherwise, a name that clashes, a measured cost over a line, a rule that contradicts another one of the spec):
   - build the smallest change that keeps the decision's intent;
   - write it in the pull request's description under "Deviations from the plan", with the reason and what you checked;
   - change this plan in the same pull request: the decision's text, and any later card it affects.

   **Stop and ask instead** when the deviation would change a rule or a constant of the model (anything the simulator measures), the log or the sync format, behaviour the spec defines or the export draws, a budget line, or another pull request's scope.

4. **Rules of P9:**
   - a. The design comes first: no visual decision outside the export; a screen's pull request lists its parity check (D31).
   - b. Words come from the selected track only, and a word's meaning is never shown before its answer.
   - c. The model's rules and constants are those of section 3. A change to `nextTask`, to the fold's rules or to a constant beyond section 3 stops the pull request; it needs a run of `pnpm --filter @nekotype/sim run p7` (and `p9` from PR 16) on the production model, an ADR, and the maintainer's consent.
   - d. `packages/sim` runs the production session plan, never a copy of its rules; the research options stay outside the production path.
   - e. Nothing new on the hot path: a key handler pushes a key (`TypedKey`, with `errorTarget` and `ruleError`) and updates the DOM through the controller; no plan, verdict, fold, `wrongKana`, `tokenAnswers` or IndexedDB access in it; recording is deferred; 0 renders per keystroke, at most 1 on the answer.
   - f. The raw keystroke log is never persisted: an event holds an outcome, and `misses` is a count.
   - g. Content comes from the pipeline: no generated chunk is edited by hand. The exclusion list, the origins table and the pair differences are read by the maintainer before their merge (M2, M7, M6).
   - h. A kind reaches the screen only through `SESSION_FEATURES`, in the pull request that builds it.
   - i. A component pull request (7–11) builds what its card lists and tests it through its props; it wires nothing into the session beyond what its card names.
5. **Stay in scope.** Build what your card lists. Anything else you had to touch is named in the pull request description. A card is sized at most about 900 changed lines with tests (PR 6, a pure package, about 1,200); a pull request that grows well past its card's size stops and proposes a split to the maintainer instead of cutting scope.
6. **Follow `AGENTS.md`:** the code rules (no `any`, no assertions, strings through i18n with `en` and `ru` in parity, injected time and randomness), the layer rules, the hot-path and budget rules. Never bypass a hook.
7. **Budgets.** Run `pnpm run build && pnpm run budget` before and after and write the figures of [D29](#d29-budgets) in the description, each against its allowance. Near an allowance, first move session code out of the first load as D29 says; above a line: stop and ask.
8. **Tests.** Write the tests your card lists and name, for each acceptance item you close, the test that proves it. Run the e2e files you touched on Chromium (`pnpm exec playwright test e2e/<file>.spec.ts --project=chromium`), `pnpm run e2e:sync` when a sync e2e changed, and `pnpm run e2e:latency` when `pages/learn`, `entities/learn/model` or `packages/model` changed (CI is the gate). Report results as they are.
9. **Documents** change in the same pull request: the spec items of [section 3.11](#311-spec-changes), the ADR named, `README.md` and `docs/architecture/` when the code they describe changed. A new ADR takes the next free number and a row in `docs/adr/README.md`.
10. **Finish:** when the work is done and `pnpm run verify:quick` passes, commit with a Conventional Commits message, push the branch (the pre-push hook runs the checks) and open the pull request against `main` (PR 2 as a draft, M4). Its description lists: what changed, why, the deviations from the plan, anything outside the scope, what to check on the preview URL (from your card), the parity check of D31 for a screen, the acceptance items closed with their tests, and the budget figures before and after against their allowances. No AI attribution in commits or in the pull request. Never merge: the maintainer does.
11. **Mark the plan:** after `gh pr create`, set your row of the Status table to `done` with the pull request number, in a second commit on the same branch (`docs: mark P9 PR n done`).
12. **Communication:** with the maintainer in Russian; code, comments, commits and documents in English.

## 9. Risks

| Risk                                                 | How it shows                                                                                            | What to do                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The export needs data section 3 does not give        | A component or a screen needs a value the plan does not compute                                         | Stop and ask; the contract is added to section 3 with the maintainer's consent, as PR D did for D2 and D12                                                                         |
| A component built before its session does not fit it | PR 15, 17, 18, 19 or 20 needs a prop of PR 7–9 or 11 that does not exist, or one that behaves otherwise | The props are the reference's (D31), so a gap is a gap of the reference: the integration pull request adds the prop in `shared/ui` with its DOM test and records it as a deviation |
| The port differs from the reference                  | The parity check of D31 shows a difference; the maintainer sees one in M8                               | The rules of D31: copy the styles and the markup, keep the names; a difference the code cannot avoid gets a row in D31's table                                                     |
| Two pull requests of one wave change one file        | A conflict on the `session` part, `SESSION_FEATURES`, `docs/architecture/` or the Status table          | The second to merge rebases and keeps both sides (section 7). The session's code by mechanic (D21) keeps PRs 17, 18 and 19 in files of their own                                   |
| The port of the selection differs from the script    | Counts other than 1,077 and 828                                                                         | Compare the readings by script, find the tag the parser reads otherwise, fix the port. A real difference of rule goes to the maintainer                                            |
| The rule lets unfit words through                    | The maintainer finds them in the sample                                                                 | The exclusion list (M2). A whole class of them is a change of the rule, written into content.md with the ADR of PR 5                                                               |
| KanjiVG lacks a character                            | The build of PR 4 fails on a kana (a small kana, a kana with a dakuten)                                 | Compose it from KanjiVG parts (the base and the mark) and record it as a deviation; a character that cannot be composed goes to the maintainer                                     |
| A part the katakana kept is wrong                    | A cell of `audit-origins.svg` whose dark strokes do not look like the katakana                          | Visible before the merge: the executor's look and M7. A name of a KanjiVG group is preferred to indexes (D2)                                                                       |
| A content chunk passes 40 KB gzip                    | The figures of PR 4 or PR 5                                                                             | Words: split a script's chunk by the first kana's row. Strokes: one decimal is already the rule; then a chunk per block of the path. Either is a deviation recorded in the plan    |
| The fold slows with words                            | `model-cost.spec.ts` over 100 ms on the log with words, rules and runs (about 1.5 times the events)     | Profile first: D9 keeps a word one task, and the word's events skip `noteTask`. Then stop and ask; the P7 options (a Worker, statistics folded apart) stand                        |
| The home misses its 300 ms                           | `home-cost.spec.ts` over 300 ms                                                                         | The P8 plan's order: profile, split the forecast's plays into callbacks, a Worker only by an ADR                                                                                   |
| The simulator misses a line                          | A number of D19 outside its line in PR 16                                                               | Report the tables and the suspected cause (the mix, the run, the round); the maintainer decides; nothing is tuned                                                                  |
| The forecast drifts with words                       | Its median error over 1 session in PR 16                                                                | Unlikely: measured before the code (section 2). The remedy is decided in D18: the forecast plays the word slots, and PR 16 measures again                                          |
| A rule error is charged wrongly                      | A golden row fails, or a learner sees a kana sent back for っ                                           | The rows of D5 are the contract; a spelling the rows miss (`ltu` forms, `cch`) gets a row first, then the fix                                                                      |
| Timing by token is off                               | A word's first kana always slow                                                                         | Expected: it carries the time to start reading, which is why `word` has a pace of its own (ADR 117). `committedTimings` at the end of a word gives every token                     |
| A chunk passes its line                              | The figures of a pull request against the allowances of D29                                             | The split is decided in D29 (`session-plan`, `session-stream`); session code stays out of the first load. A line passed after that: stop and ask                                   |
| The initial JS passes 31.5 KB                        | The figures of PRs 2, 6, 13, 14, 15 or 19                                                               | D29's rule first: a module only a session runs leaves `entities/learn`, `session-loader.ts` and `app/`. Then stop and ask                                                          |
| The schema reset loses unsent progress               | After PR 2 the account misses a device's last session                                                   | M4 as a hard gate: PR 2 is a draft until every device is ticked (Q7). Before the release nobody else uses production (ADR 061)                                                     |
| A stale tab of format 3                              | It gets `400` and stops syncing                                                                         | A28 as designed: a reload loads the new client, whose schema reset clears its outbox                                                                                               |
| Turnstile in tests                                   | The widget cannot run in CI                                                                             | A fake loader in DOM tests and a stub script in the e2e; the real widget is checked by the maintainer in M8 (PR 17)                                                                |
| The report dialog steals the session's focus         | After closing, keys go nowhere                                                                          | D26: closing gives the focus back to the session's input; a DOM test (PR 9) and the e2e (PR 17) check it                                                                           |
| Interleaving still feels monotonous                  | The maintainer's checks of M8                                                                           | The mix follows the model (ADR 118, point 7). A change of cadence or of the mix is a constant or a rule: a sim run and an ADR                                                      |
| A pull request outgrows its session                  | Well past the size of its card                                                                          | Propose a split to the maintainer instead of cutting scope                                                                                                                         |
