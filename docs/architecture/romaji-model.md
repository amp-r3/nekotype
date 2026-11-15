# Two-tier romaji spelling model

Part of the [architecture description](README.md) of the current code.

Typing Japanese romaji involves substantial ambiguity between formal IME keystrokes and intuitive learner romanizations. Nekotype solves this with a deterministic two-tier model:

| Level      | Name             | Description                                                                                                                                                         |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier 1** | **Strict IME**   | Exact keystroke sequences accepted by Microsoft IME and Google Japanese Input on Japanese keyboard layouts. Rejects invalid shortcuts (e.g. `koohii` for コーヒー). |
| **Tier 2** | **Learner Mode** | Accepts all Strict IME spellings **plus** common phonetic romanizations (Hepburn, Kunrei-shiki, Nihon-shiki, digraph variants, and vowel-lengthening alternatives). |

## Ambiguous Romaji Resolution Table

| Kana                           | Strict IME Keystrokes                          | Learner Mode Additional Keystrokes                               | Design Rationale                                                                           |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **を**                         | `wo`                                           | `o`                                                              | Standard IME requires `wo` to produce を; `o` produces お. Learners frequently expect `o`. |
| **ぢ**                         | `di`                                           | `ji`, `zi`, `dzi`                                                | In standard IME, `ji` produces じ. `di` produces ぢ.                                       |
| **づ**                         | `du`                                           | `zu`, `dzu`                                                      | In standard IME, `zu` produces ず. `du` produces づ.                                       |
| **ティ**                       | `thi`                                          | `ti`, `texi`                                                     | In standard IME, `ti` produces ち. `thi` produces digraph ティ.                            |
| **ディ**                       | `dhi`                                          | `di`, `dexi`                                                     | In standard IME, `di` produces ぢ. `dhi` produces digraph ディ.                            |
| **トゥ**                       | `twu`                                          | `tu`, `toxu`                                                     | In standard IME, `tu` produces つ. `twu` produces digraph トゥ.                            |
| **ドゥ**                       | `dwu`                                          | `du`, `doxu`                                                     | In standard IME, `du` produces づ. `dwu` produces digraph ドゥ.                            |
| **ウォ**                       | `who`                                          | `wo`, `uxo`                                                      | In standard IME, `wo` produces を. `who` produces extended digraph ウォ.                   |
| **シェ**                       | `she`                                          | `sye`, `sixe`                                                    | Standard IME input for extended Katakana シェ.                                             |
| **ジェ**                       | `je`                                           | `zye`, `jye`, `zixe`                                             | Standard IME input for extended Katakana ジェ.                                             |
| **チェ**                       | `che`                                          | `tye`, `cye`, `tixe`                                             | Standard IME input for extended Katakana チェ.                                             |
| **ファ, フィ, フェ, フォ**     | `fa, fi, fe, fo`                               | `fua, fui, fue, fuo`                                             | Standard IME shortcuts vs decomposed kana combinations.                                    |
| **ヴァ, ヴィ, ヴ, ヴェ, ヴォ** | `va, vi, vu, ve, vo`                           | `buxa, buxi, buxe, buxo`                                         | Extended Katakana voiced labiodental series.                                               |
| **じゃ, じゅ, じょ**           | `ja, ju, jo`, `zya, zyu, zyo`, `jya, jyu, jyo` | _(None; `dya/dyu/dyo` removed as they represent ぢゃ/ぢゅ/ぢょ)_ | Prevents conflation with dakuten ぢ digraphs.                                              |

## Chōonpu (ー) Dual-Tier Rules

- **Strict IME:** Accepts only `-` (hyphen/minus). Phonetic repeats like `koohii` are rejected.
- **Learner Mode:** Accepts `-` and the final vowel of the nearest kana token to the left, looking through other `ー` (`koohii` and `ko-hi-` for `コーヒー`). After ん, a standalone っ, a skip token or at the start of a prompt only `-` is accepted.

## Sokuon (っ / ッ) Consonant Doubling

- **Merged っ:** `っ` followed by a kana becomes one token with the following kana's key. Every spelling that starts with a consonant other than `n` or `y` is doubled (`ch` gives `tch` and `cch`), and the `xtu`/`ltu`/`xtsu`/`ltsu` prefix is accepted before any spelling (spec D5, D22).
- **Standalone っ:** At the end of a prompt, before `ん`, `ー`, another `っ` or a skip token, `っ` is its own token with the four prefix spellings. It never merges across a prompt boundary.

## Syllabic ん / ン Contextual Lookahead (spec D2, D3, A15)

- `nn` and `n'` are always accepted. A bare `n` is stored as a spelling that may only precede certain spellings of the next token: those starting with a consonant other than `n` or `y`, and in learner mode also those starting with `n`.
- The next token is looked up across prompt boundaries. At a boundary, learner mode accepts a bare `n` before any spelling of the next prompt. At the end of the stream and before a skip token a bare `n` is always accepted.

## Skip tokens (spec D8)

Punctuation and spaces (`SKIP_CHARACTERS`) are tokens that need no input; the matcher passes over them and statistics ignore them.

## Reading Hints (`readingHints`)

In vocabulary words, certain particles and irregular kanji readings deviate from base kana tables. For example, the topic marker `は` in `こんにちは` is pronounced `wa`.

- `compile()` inspects `prompt.readingHints`.
- In `learner` mode, the specified token index receives the hint spelling (e.g. `wa` for `は` in `こんにちは`).
- Without a hint, `は` strictly requires `ha` in both modes (e.g. `はな` rejects `wana`).
