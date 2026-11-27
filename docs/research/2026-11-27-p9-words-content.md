# P9 research, part 1: how many words a learner can read, and when

Before P9 is specified, the maintainer asked how to make learning less monotonous than typing the romaji of one kana after another, and chose seven ideas to look into (2026-11-27). Two of them depend on content: **words of known kana with their meanings, katakana loanwords first** (idea 1), and **"read the sign"**, short public signs and menus (idea 2). The maintainer's rule for both: if the content does not support them, they are dropped. This part answers one question for each: how many texts of the generated content a learner can read at each point of a track, and on which day of learning. Words are planned for P12 ([ADR 099](../adr/099-learning-home-methods-and-phases-after-p6.md), point 9), so the answer also says whether they could come earlier.

This note decides nothing and changes neither the model nor the app. Parts 2 (the task types and their weight in the model) and 3 (the planner: the mix of a session) follow.

## In short

- **Hiragana words are there from the first session.** The five vowels already make 13 words of the chunk (あお "blue", いえ "house", うえ "above"), the k row 40, the s row 86, the basic 46 kana 703 of 1,167. In the simulator a beginner can read 10 words in session 2 and 50 in session 4, both on day 1, and 100 in session 10 on day 2. Words do not have to wait for P12 for lack of content.
- **Most of them are kanji words written in kana.** 956 of the 1,167 hiragana words (82%) are words that JMdict spells in kanji: あか is 赤, あさ is 朝. Beginners' textbooks write them in kana, and the meaning is real, but a Japanese reader would not see them so. Only 211 are written in kana in real text. The vowels give 6 of them, mostly interjections (ああ, ええ), the basic kana 133.
- **Katakana words are thin in the current chunk and need っ and ー.** `words-katakana` has 108 words, the N5–N4 loanwords, and 60 of them contain っ or ー. Once the basic katakana are introduced, 37 are readable when っ and ー count as taught, and 16 when they do not. A learner who follows the katakana suggestion starts katakana on day 6–7. They read their first katakana word on day 8, 10 on day 9 and 50 on day 14.
- **A wider pool of common loanwords fixes it.** The pinned JMdict has 663 kana-only katakana words with an `ichi1`, `spec1` or `spec2` priority tag, names and onomatopoeia left out. After the t row 41 of them are readable (the chunk: 10), after the basic kana 227 (the chunk: 37). On the simulator's days this means 10 words on day 8 and 50 on day 10. Taking them needs a new selection rule for katakana words in [content.md](../spec/content.md) and an ADR.
- **Phrases come later.** The hiragana phrases start with the r row (60 after it, 100 after the basic kana, 389 in all), so in the simulator they arrive in sessions 20–40 (days 5–8). There are no katakana phrases, and the 111 mixed ones need both tracks complete. A phrase is a goal for the end of the basic hiragana, not for the first week.
- **"Read the sign" has no source.** No source pinned in `packages/content` marks a word or a phrase as a sign or a menu item, and choosing them by hand is forbidden (D19). Signs as their own content are dropped. A word task may still look like a sign, but then it is a matter of design, not of content.
- **For idea 8:** っ and ー matter little for hiragana (53 of 1,167 words) and a lot for katakana (60 of 108; 350 of the 663 of the wider pool). Katakana words without the っ/ー rule would leave out most loanwords: コーヒー, ケーキ, スーツ.

## Method

- **Content.** The chunks committed in `apps/web/src/entities/prompt/content/` at content version `098be8bfd536`: `words-hiragana` (1,167), `words-katakana` (108), `phrases-hiragana` (389), `phrases-katakana` (0), `phrases-mixed` (111). Words are the N5–N4 entries by their kana reading ([content.md](../spec/content.md), "Words").
- **Readable.** A text is split into tokens the way the engine and `kanaOfReading` of the model split it: the longest learnable kana first (two characters, then one). A text is readable when every token is a known kana. The exceptions are punctuation and spaces, which are skip characters, and っ and ー, which count as taught only in the "with っ/ー" columns. っ, ー and small kana outside yōon are not learned items ([learning.md](../spec/learning.md)).
- **By row.** The kana of a track are introduced row by row in track order, the order of introduction of [learning.md](../spec/learning.md). This is the upper bound: every kana of a row counts as known as soon as the row is open.
- **By session.** `packages/sim` with the production model (`createProductionPolicy`) runs 30 beginners for 60 days on both tracks. They take the katakana suggestion: hiragana until the 46 basic hiragana are learned, then katakana (as `FOLLOWS_SUGGESTION` of the [answer-time note](2026-11-25-adaptive-answer-time.md)). Here a kana counts as known once the model holds it as `learned` (5 correct recalls in a row), which is stricter than introduced. The learner sits twice a day for about 5 minutes and sometimes skips a sitting. That makes 255 (248–262) sessions in 60 days, about 4 a day. A cell is a median with the 10th–90th percentile.
- **JMdict.** `packages/sim/scripts/p9-jmdict.py` reads the pinned `JMdict.gz` (2026-07-05) and the JLPT lists of `packages/content/.cache`:
  - It classifies each hiragana word by its N5–N4 entries: an entry with no kanji, an entry whose first sense is "usually written using kana alone" (`uk`), one with `uk` on a later sense, or a kanji word. The most kana-like class wins.
  - It builds the pools of katakana words: entries with no kanji, a katakana reading with a priority tag (`news1`, `ichi1`, `spec1`, `spec2`, `gai1`), and no name or onomatopoeia sense. That gives 3,978 entries, 3,809 of which carry `gai1`. The "core" pool is the 663 with `ichi1`, `spec1` or `spec2`.

## Changes to the simulator

- `RunResult.milestones` gives, per item, the session and day of its introduction and of the first time the policy holds it as learned at the end of a session. `Policy.learned` is optional; only the production policy has it. Nothing else changes, and every earlier table reproduces (the sim's tests pass).
- `src/p9-words.ts` prints the tables (`pnpm --filter @nekotype/sim run p9-words`, `PART=content|rows|first|sessions|jmdict`).
- `scripts/p9-jmdict.py` writes the JMdict files that `PART=jmdict` and `KATAKANA_POOL` read. They are not committed: they come from the cache, which is not in the repository.

## Tables

### 1. The content

| chunk            | texts | with っ or ー | tokens per text | never readable |
| ---------------- | ----- | ------------- | --------------- | -------------- |
| words-hiragana   | 1167  | 53            | 3 (2–4)         | 0              |
| words-katakana   | 108   | 60            | 4 (2–6)         | 0              |
| phrases-hiragana | 389   | 96            | 11 (7–14)       | 1 (a small ぁ) |
| phrases-katakana | 0     | —             | —               | —              |
| phrases-mixed    | 111   | 47            | 11 (8–14)       | 0              |

### 2. Hiragana by row

Readable texts once the row and every row before it are introduced. "In kana" is the share of the words that JMdict writes in kana (with っ/ー).

| row    | kana | words, no っ/ー | words, with っ/ー | share | of them in kana | phrases, with っ/ー |
| ------ | ---- | --------------- | ----------------- | ----- | --------------- | ------------------- |
| vowels | 5    | 13              | 13                | 1%    | 6               | 0                   |
| k      | 10   | 38              | 40                | 3%    | 10              | 0                   |
| s      | 15   | 83              | 86                | 7%    | 18              | 0                   |
| t      | 20   | 162             | 174               | 15%   | 32              | 1                   |
| n      | 25   | 212             | 225               | 19%   | 41              | 7                   |
| h      | 30   | 248             | 262               | 22%   | 45              | 9                   |
| m      | 35   | 332             | 352               | 30%   | 64              | 14                  |
| y      | 38   | 370             | 394               | 34%   | 70              | 25                  |
| r      | 43   | 562             | 590               | 51%   | 120             | 60                  |
| w_n    | 46   | 671             | 703               | 60%   | 133             | 100                 |
| d      | 61   | 903             | 940               | 81%   | 188             | 277                 |
| p      | 71   | 997             | 1040              | 89%   | 204             | 316                 |
| py     | 104  | 1114            | 1167              | 100%  | 211             | 388                 |

The first words, by the row that opens them:

- vowels (13): あう "to meet", あお "blue", あおい "blue", いい "good", いいえ "no", いう "to say", いえ "house", うえ "above";
- k (+27): あか "red", あき "autumn", いく "to go", いけ "pond", えき "railway station", おおきい "big";
- s (+46): あさ "morning", あし "foot", あそこ "there", いす "chair", おいしい "tasty", おかし "sweets";
- t (+88): あした "tomorrow", あつい "hot", いくつ "how many", いたい "painful".

### 3. Katakana by row: the chunk and the JMdict pools

| row     | chunk (108), no っ/ー | with っ/ー | core (663), no っ/ー | with っ/ー | all (3,978), no っ/ー | with っ/ー |
| ------- | --------------------- | ---------- | -------------------- | ---------- | --------------------- | ---------- |
| vowels  | 0                     | 0          | 0                    | 1          | 2                     | 3          |
| k       | 0                     | 1          | 2                    | 7          | 9                     | 22         |
| s       | 0                     | 1          | 4                    | 16         | 19                    | 54         |
| t       | 2                     | 10         | 10                   | 41         | 45                    | 146        |
| n       | 4                     | 13         | 14                   | 49         | 68                    | 195        |
| h       | 6                     | 16         | 18                   | 58         | 89                    | 243        |
| m       | 6                     | 17         | 34                   | 89         | 139                   | 364        |
| r       | 14                    | 31         | 70                   | 162        | 378                   | 904        |
| w_n     | 16                    | 37         | 113                  | 227        | 584                   | 1232       |
| d       | 30                    | 56         | 172                  | 338        | 938                   | 1956       |
| p       | 44                    | 96         | 259                  | 543        | 1415                  | 3110       |
| py      | 47                    | 103        | 282                  | 606        | 1549                  | 3540       |
| ext_che | 48                    | 108        | 313                  | 663        | 1734                  | 3973       |

The first words of the chunk: ケーキ "cake" (k); コート, スカート, セーター, タクシー, テスト, スーツ, ステーキ (t); ネクタイ, ノート, テニス (n); コーヒー, ナイフ (h); カメラ, カレー, クラス, トイレ, ホテル, メートル (r). The core pool beyond N5–N4 holds words like アイス, アイスクリーム, アイデア, アドバイス, アルバム, アレルギー, アンケート, インターネット, エアコン, エネルギー, オレンジ. It also holds some a beginner will not know, such as アフィリエイト and インスリン. The full pool of 3,978 is mostly words of that second kind.

### 4. By session in the simulator

Readable words from learned kana after N sessions (with っ/ー; 30 beginners).

| session | hiragana words | hiragana phrases | katakana words, chunk | katakana words, core pool |
| ------- | -------------- | ---------------- | --------------------- | ------------------------- |
| 2       | 13 (8–13)      | 0                | 0                     | 0                         |
| 4       | 52 (40–65)     | 0                | 0                     | 0                         |
| 10      | 103 (79–104)   | 0                | 0                     | 0                         |
| 20      | 248 (216–284)  | 9 (3–11)         | 0                     | 0                         |
| 30      | 378 (327–455)  | 17 (14–33)       | 0                     | 0                         |
| 40      | 755 (700–795)  | 120 (94–128)     | 0                     | 0 (0–1)                   |
| 60      | 800 (776–848)  | 128 (122–141)    | 5 (1–11)              | 22 (16–43)                |
| 80      | 800 (776–848)  | 128 (122–141)    | 17 (17–27)            | 91 (77–149)               |
| 100     | 813 (776–848)  | 130 (122–141)    | 52 (43–61)            | 291 (256–366)             |

The hiragana columns stop near 800 because these learners move to katakana once the basic hiragana are learned. The voiced hiragana then come only when the other track falls more than `TRACK_LAG` behind.

When the learner can first read N words (session and day):

| words | hiragana         | katakana, chunk       | katakana, core pool |
| ----- | ---------------- | --------------------- | ------------------- |
| 1     | 1 (1–2), day 1   | 52 (48–57), day 8     | 44 (40–48), day 7   |
| 10    | 2 (2–3), day 1   | 63 (60–67), day 9     | 56 (52–60), day 8   |
| 50    | 4 (4–7), day 1   | 100 (96–105), day 14  | 69 (63–72), day 10  |
| 100   | 10 (8–12), day 2 | 135 (130–140), day 19 | 84 (77–88), day 12  |

## What it means for the ideas

- **Idea 1, words with their meanings: the content supports it, so it stays.** For hiragana the chunk is enough from the first session. For katakana, loanwords are the reason to read words at all. The N5–N4 chunk gives a katakana learner about 1 word per row until the r row, so the katakana side needs both the wider pool and the っ/ー rule (idea 8). The cost is a selection rule in `packages/content` for katakana words beyond N5–N4, for example `ichi1`/`spec1`/`spec2` kana-only entries. It is a change of [content.md](../spec/content.md) that needs an ADR, and the content version and the chunk size change with it. The chunk is lazy (not in the first load). Its size is checked when the rule is chosen.
- **Idea 2, signs: dropped as content.** There is no source, and a hand list breaks D19. If it returns, it is a visual variant of a word task in the design session, not new content.
- **Idea 10, a word at the end of a session: possible from day 1.** After the vowels there are 13 hiragana words. One of them can close the first session.
- **Kanji words in kana:** the maintainer decides whether all 1,167 hiragana words are used or only the 211 written in kana. All of them give meaning from the first session (あお, いえ, あか), as textbooks do. The 211 keep the text authentic but leave the first rows almost without words: 6 words after the vowels, mostly interjections, and 10 after the k row. A middle way is to use all of them and, in the kana details or the summary, show the kanji spelling of those that have one. That needs the kanji in the chunk; today it holds only the kana.

## Open questions for the maintainer

1. **Words in P9.** The content allows words from the first session. Should the word tasks of P12 (words of known kana, credit to each kana) move into P9, with "words you can read now" left in P12 or moved as well? It changes the phases of ADR 099 and needs an ADR.
2. **Kanji words in kana:** all 1,167, only the 211 written in kana, or all with the kanji shown beside them?
3. **The katakana pool:** keep the 108 N5–N4 words, or widen it to the core pool of about 660 common loanwords (a new selection rule)?
4. **Meanings in Russian:** the meanings are English only (O3, ADR 093). A loanword needs no translation, but a hiragana word does (あか "red"). Is English enough for a learner who uses the Russian UI?

## Reproduce

```bash
pnpm --filter @nekotype/sim run p9-words                  # tables 1, 2, 4 (chunk) and the first words
pnpm --filter @nekotype/content run fetch                 # the pinned JMdict and JLPT lists into .cache/
python3 -I packages/sim/scripts/p9-jmdict.py /tmp/p9
PART=jmdict HIRA_KIND=/tmp/p9/hira-kind.json \
  POOL=core=/tmp/p9/katakana-core.json,all=/tmp/p9/katakana-pool.json \
  pnpm --filter @nekotype/sim run p9-words                # table 3 and the "in kana" column
PART=sessions KATAKANA_POOL=/tmp/p9/katakana-core.json \
  pnpm --filter @nekotype/sim run p9-words                # table 4, core pool
```
