# Input engine rules

The engine remains an NFA simulation over tokens, now applied to a stream of prompts rather than a single prompt. It receives the kana table as a parameter, supports small kana and skip tokens, and exposes the state needed for live conversion and for the learning mode. The accepted-input table is normative: every row MUST be covered by a golden test.

## `@nekotype/engine` API

```ts
export function createEngine(table: EngineTable): Engine; // entries only, so both selectable and standalone rows fit

interface Engine {
  compile(prompts: readonly PromptItem[], strictness: Strictness): Matcher; // window of the stream
  extend(m: Matcher, prompts: readonly PromptItem[]): Matcher; // append prompts; existing state stays valid
  compact(m: Matcher, s: MatchState): { m: Matcher; s: MatchState; droppedTokens: number }; // drop committed prompts, rebase token indices
  start(m: Matcher): MatchState;
  step(m: Matcher, s: MatchState, ch: string): MatchState | null; // null = key rejected
  isComplete(m: Matcher, s: MatchState): boolean; // end of the stream reached
  committedPrompts(m: Matcher, s: MatchState): number; // prompts committed in every active position
  committedTimings(m: Matcher, s: MatchState): readonly TokenTiming[]; // per committed token, surviving path; no skip tokens
  settledPrompts(m: Matcher, s: MatchState): number; // leading committed prompts whose tokens all have agreed timings; what compact() may drop
  extensions(m: Matcher, s: MatchState): ReadonlySet<string>;
  view(m: Matcher, s: MatchState): EngineView; // live conversion
  errorTarget(m: Matcher, s: MatchState): number; // token index for error attribution (D10, A34)
  canonical(m: Matcher, promptIndex: number): string; // hint text (Esc)
  spellingsFor(key: KanaKey, strictness: Strictness): readonly string[]; // learning mode
  canonicalFor(key: KanaKey): string;
}

interface Matcher {
  readonly tokens: readonly Token[]; // all tokens of the window, skip tokens included
  readonly promptStarts: readonly number[]; // index of each prompt's first token in `tokens`
  readonly strictness: Strictness; // fixed by compile(); extend() keeps it
}

interface EngineView {
  displayedTokens: number; // tokens completed by the display position; may exceed the committed tokens
  pendingLatin: string; // typed latin beyond those tokens
  activeToken: number; // token highlighted in the stream: the earliest token any active position is typing, so it can lag behind displayedTokens
}

interface TokenTiming {
  tokenIndex: number;
  firstKey: number; // index of the first accepted keystroke consumed by the token
  lastKey: number; // index of the last accepted keystroke consumed by the token
}
```

**Error log.** `step()` is pure and records nothing. The package also exports a pure helper that holds the per-token error data of D10, D11 and the confusion pairs:

```ts
export function createErrorLog(): ErrorLog;

interface ErrorLog {
  record(tokenIndex: number, expected: KanaKey | null, typed: string): void; // mistakes += 1, errored = true
  mistakes(tokenIndex: number): number;
  errored(tokenIndex: number): boolean;
  confusions(): ReadonlyMap<KanaKey, ReadonlyMap<string, number>>; // expected kana → typed character → count
  rebase(droppedTokens: number): void; // after compact()
}
```

A pair is stored only when `expected` is a `KanaKey`: a standalone っ and ー have none (see "Statistic keys" in [Metrics and statistics](metrics.md)). The caller passes `errorTarget()` as `tokenIndex`.

**Spelling constraints.** A spelling of a token MAY carry the set of next-token spellings it may precede: a single `n` for ん only before qualifying spellings, a doubled consonant for っ only before the spelling it doubles. `step()` spawns positions into the next token only for permitted spellings. `extend()` never moves a token or spelling index: when the context that arrives rules out the bare `n` of a trailing ん, that spelling stays in place with an empty set of permitted next spellings, so a state typed before the call remains valid and the stale position dies on the next key. This replaces the baseline token model `{ spellings[] }` and changes the baseline `start`/`step`.

- **Display position.** `view()` uses the active position with the shortest `pendingLatin`; on a tie, the position whose spellings come first in table order. Example, relaxed こんな: `kon` → こん; `konn` → こん; `konna` → こんな.
- **Window.** The stream is compiled with at least one full prompt beyond the active prompt. `extend()` MUST be called before the active token enters the last prompt of the window, so that the context of every non-final ん is known before it is typed. compact() is called after every 20 committed prompts, so a zen session does not grow the matcher without bound. It returns `droppedTokens`; the session adds it to a running offset and numbers the stream's tokens from the start of the test, so the stream UI holds no reference that needs rebasing and the ≤ 1 render budget holds (ADR 040). What the stream draws behind the caret is independent of the matcher and is cut by whole lines (ADR 047). `committedTimings()` covers only tokens still in the matcher, so the session reads it before calling compact(). compact() drops only the prompts counted by `settledPrompts()`, so a prompt whose last ん is still ambiguous waits for the next key and no timing is lost; it returns `droppedTokens` 0 meanwhile. `firstKey` and `lastKey` are session-wide keystroke indices and are never rebased.
- **Timings.** Keystroke indices count accepted keystrokes only (a rejected key returns `null` and is not in the state); `MatchState` carries the running count. A token is reported by `committedTimings()` only when every active position agrees on its `firstKey` and `lastKey`. Relaxed こんな after `konn` has two live paths (ん = `n` and ん = `nn`) that disagree on ん's `lastKey`; ん is reported once `a` leaves a single path. When two paths reach the same position, the one that arrived first in table order is kept. Skip tokens consume no keystroke and never appear in the result.
- **Canonical.** `canonical()` is the concatenation of the first spelling of every token of the prompt in strict table order; ん is always `nn` and the result does not change after `extend()`.
- **Imports.** The package MUST NOT import DOM APIs, signals, storage or application aliases. The kana table and the visually-similar kana table ship in the same package as data.
- **Case.** Upper-case letters are lowercased before `step`; Caps Lock has no effect on matching.
- **Types not defined here** (`KanaTable`, `PromptItem`, `ReadingHint`, `KanaKey`, `Strictness`) are retained from the baseline. `ReadingHint.tokenIndex` counts the prompt's tokens from 0; a merged っX and a skip token each count as one token.

## Tokens

- **Kana** — longest match against the table (きゃ wins over き).
- **っ followed by a kana** — spellings are built per spelling of the next kana (D22): every next spelling that starts with a latin consonant other than `n` and `y` is accepted with its first letter doubled (for ch-spellings: `cch`, `tch`, `tt` as in the table below); in addition, `xtu`, `ltu`, `xtsu` or `ltsu` followed by any next spelling is accepted. If no next spelling qualifies for doubling, only the prefixed forms remain.
- **っ elsewhere** — at the end of a prompt, before ん, before ー, before a skip token or before another っ: `xtu`, `ltu`, `xtsu`, `ltsu`. In っっ the first っ is standalone and the second follows the rules above.
- **ん** — `nn` and `n'` are always accepted. A single `n` is accepted, per spelling of the next token, when that spelling starts with a latin consonant other than `n` and `y`, and at the end of the stream or before a skip token. Relaxed mode also accepts a single `n` before a spelling that starts with `n`, and at a prompt boundary before any spelling of the next prompt (A15).
- **ー** — `-` in both modes. Relaxed mode also accepts the final vowel of each spelling of the previous kana token (ADR 007). The vowel comes from the nearest kana token to the left, looking through ー (relaxed こーー accepts `kooo`). At the start of a prompt, after a skip token, after ん and after a standalone っ there is no such vowel, so only `-` is accepted.
- **Small kana** — ぁぃぅぇぉゃゅょゎ and ヵヶ as standalone tokens (D7), with their katakana forms. They and ゐ/ゑ live in the engine table only, as `standaloneRows`; they belong to no selectable row (see [Learning mode](learning.md)). ゕ and ゖ are not supported.
- **Skip token** — 、。，．！？・「」『』（）…〜 and half-width and full-width spaces. Rendered in the stream, requires no input; the cursor passes over it automatically; excluded from metrics.

**Invariant:** relaxed mode accepts every input that strict mode accepts, for every prompt. This is a property test. Example: ほんを — strict accepts `honwo`, `honnwo`, `hon'wo`; relaxed accepts those plus `honno` and `hon'o`.

## Prompt boundaries

- ん at the end of a prompt takes its context from the first token of the next prompt, using the same rules as inside a prompt. In relaxed mode a single n is additionally accepted at a boundary before any next spelling (A15).
- ん before a skip token and ん at the end of the stream behave as "ん at the end": a single `n` completes it.
- っ never merges across a prompt boundary or a skip token.
- NFA positions MAY cross a prompt boundary. A prompt counts as completed when `committedPrompts()` includes it; its completion time is the time of the keystroke that committed it. The last prompt of a finite stream also counts as completed when `isComplete()` holds: `hon` ends a stream that ends in ほん, although the position that takes another `n` is still active. When a zen test is ended by hand or a time test reaches its deadline, every prompt before the displayed one counts as completed, whether or not its final ん is settled (ADR 050); `committedPrompts()` still decides what is settled during the test.

## Accepted input

Every input listed in a row MUST be accepted. The rows are representative, not exhaustive: the complete set follows from the rules under "Tokens" and the kana table. Golden tests cover every listed input and every input under "Rejected input".

| Case                                | Example     | Relaxed                                     | Strict IME                               |
| ----------------------------------- | ----------- | ------------------------------------------- | ---------------------------------------- |
| し ち つ ふ じ                      | —           | shi/si, chi/ti, tsu/tu, fu/hu, ji/zi        | same                                     |
| を                                  | —           | wo, o                                       | wo                                       |
| ぢ / づ                             | —           | di, ji, zi, dzi / du, zu, dzu               | di / du                                  |
| ん at the end of the stream         | ほん        | hon, honn, hon'                             | same                                     |
| ん before a consonant               | かんた      | kanta, kannta, kan'ta                       | same                                     |
| ん before n                         | こんな      | konna, konnna, kon'na                       | konnna, kon'na                           |
| ん before a vowel                   | かんい      | kanni, kan'i                                | same                                     |
| ん before y                         | ほんや      | honnya, hon'ya                              | same                                     |
| ん across a boundary                | ほん → ねこ | honneko, honnneko, hon'neko                 | honnneko, hon'neko                       |
| ん before a skip token              | ほん。      | hon, honn, hon'                             | same                                     |
| Merged っ                           | きって      | kitte, kixtute, kiltute, kixtsute, kiltsute | same                                     |
| っ before ch                        | まっちゃ    | maccha, matcha, mattya, maxtucha            | same                                     |
| Standalone っ                       | あっ        | axtu, altu, axtsu, altsu                    | same                                     |
| っ before ー                        | ッー        | xtu-, ltu-, xtsu-, ltsu-                    | same                                     |
| Yōon                                | きゃ, しゃ  | kya; sha, sya                               | same                                     |
| ちゃ / じゃ                         | —           | cha, tya, cya / ja, zya, jya                | cha, tya / ja, zya, jya                  |
| Small kana                          | ぁ, ゃ      | xa, la; xya, lya                            | same                                     |
| ゎ / ヵ / ヶ                        | —           | xwa, lwa / xka, lka / xke, lke              | same                                     |
| ゐ / ゑ                             | —           | wyi / wye                                   | same                                     |
| Extended katakana                   | ファ, ティ  | both columns of "Extended katakana"         | Strict IME column of "Extended katakana" |
| ー                                  | コーヒー    | ko-hi-, koohii                              | ko-hi-                                   |
| ー at the start of a prompt         | —           | -                                           | -                                        |
| Particles は / へ                   | こんにちは  | konnichiwa, konnichiha                      | konnnichiha                              |
| Skip token                          | 、          | no input                                    | same                                     |
| ん before を                        | ほんを      | honwo, honnwo, hon'wo, honno, hon'o         | honwo, honnwo, hon'wo                    |
| ん before a vowel across a boundary | ほん → あめ | honame, honname, hon'ame (A15)              | honname, hon'ame                         |

Particle readings come from `readingHints` produced by the content pipeline and apply in relaxed mode only, as in the baseline. On a merged っX a reading is a spelling like any other and carries the っ (D22).

The spellings of each kana are defined by the kana table in `packages/engine`: strict mode uses `ime[]`, relaxed mode uses `ime[]` and `learner[]`. A row names one member of a family and the whole family behaves alike: しゅ is `shu`, `syu`; ちゅ is `chu`, `tyu`, and `cyu` in relaxed mode; じゅ is `ju`, `zyu`, `jyu`. Every other kana has exactly one spelling, identical in both modes: its Hepburn spelling (か ka, が ga, ぱ pa, きゃ kya, ぎょ gyo).

## Rejected input

Each of these MUST be rejected at the key that makes it invalid.

| Mode        | Example     | Rejected input                 |
| ----------- | ----------- | ------------------------------ |
| Both        | かんい      | kani                           |
| Both        | ほんや      | honya                          |
| Both        | きゃ        | kilya, kixya (D6)              |
| Both        | あっ → たま | attama: no merge at a boundary |
| Strict only | こんな      | konna                          |
| Strict only | ほん → ねこ | honneko                        |
| Strict only | ほん → あめ | honame                         |
| Strict only | ほんを      | honno, hon'o                   |
| Strict only | を          | o                              |
| Strict only | ぢ          | ji                             |
| Strict only | ちゃ        | cya                            |
| Strict only | コーヒー    | koohii                         |
| Strict only | こんにちは  | konnnichiwa                    |
| Strict only | ファ        | fua                            |

## Extended katakana

| Kana                          | Strict IME                   | Relaxed also accepts                             |
| ----------------------------- | ---------------------------- | ------------------------------------------------ |
| ファ フィ フェ フォ           | fa, fi, fe, fo               | fua/huxa, fui/huxi, fue/huxe, fuo/huxo           |
| ヴァ ヴィ ヴ ヴェ ヴォ        | va, vi, vu, ve, vo           | buxa, buxi, —, buxe, buxo                        |
| ウィ ウェ ウォ                | wi, we, who                  | whi/uxi, whe/uxe, wo/uxo                         |
| ティ トゥ ディ ドゥ テュ デュ | thi, twu, dhi, dwu, thu, dhu | ti/texi, tu/toxu, di/dexi, du/doxu, texyu, dexyu |
| シェ ジェ チェ                | she, je, che                 | sye/sixe; zye/jye/zixe; tye/cye/tixe             |

Other extended combinations (ツァ, クァ, イェ, スィ, フュ and similar) are not in the table; content containing them is excluded at build time.

## Errors

- A rejected key does not enter the buffer, the state is unchanged, and the caret flashes (see [Frontend](frontend.md)).
- The error is recorded on token `errorTarget()` (D10): the minimum `tokenIndex` among active positions, but never before the first token that needs input of the prompt on display (A34). Relaxed ほん → ねこ after `hon`: ねこ is on display, so a wrong key is charged to ね, not to ん; relaxed こんな after `kon`: the prompt has not changed, so it is charged to ん. On the token: `mistakes += 1`, `errored = true`, and the pair "expected kana → typed character" is stored for the confusion matrix.
- Any character other than a latin letter, `-` or `'`, as well as Space, Enter and Backspace, is `ignore`, not an error (D15). Only a non-latin letter shows the layout notice.
- Esc (hint) keeps the baseline behaviour: shows `canonical` for the active prompt, counts one error, and the prompt must still be typed in full. The error is recorded on token `errorTarget()`, as for a rejected key.
- `shouldAbsorb` is removed; surplus `n` keys are resolved by stream matching (D3).
