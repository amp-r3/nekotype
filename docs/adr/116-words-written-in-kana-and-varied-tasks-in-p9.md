# ADR 116: Words Written in Kana and More Varied Tasks Join P9, Which Opens With a Design Session for the Session Screen

- **Status:** In force.
- **Context:**
  - P8 closed on 2026-11-25. P9 is a scope line in [phases.md](../spec/phases.md): the learning methods of [ADR 099](099-learning-home-methods-and-phases-after-p6.md), point 5, and the stroke order.
  - On 2026-11-27, before P9 was specified, the maintainer said that typing the romaji of one kana after another grows dull. Their own idea was words of known kana. Out of the ideas discussed, they chose:
    1. words of known kana with their meanings, katakana loanwords first;
    2. "read the sign": public signs and menus, on condition that the content supports it;
    3. "find the error": a word with its romaji where one kana does not match;
    4. "hiragana or katakana?";
    5. the rules of っ, ー and long vowels;
    6. task types interleaved in a session;
    7. a word that closes the session.

    Several typefaces of one kana, vertical text and the learner's name in katakana were proposed and not chosen.

  - [Part 1 of the P9 research](../research/2026-11-27-p9-words-content.md) counted the readable content:
    - Hiragana words come from the first session.
    - 82% of the 1,167 hiragana words of the N5–N4 chunk are kanji words written in kana (あか for 赤).
    - The 108 katakana words of the chunk are thin until the r row, and 60 of them need っ or ー.
    - No pinned source marks a sign.
    - A selection of common words written in kana gives 1,077 hiragana and 828 katakana words. With it a beginner reads 10 hiragana words on day 1 and 50 katakana words on day 9.
  - Words are planned for P12 ([ADR 099](099-learning-home-methods-and-phases-after-p6.md), point 9). The maintainer wants them in P9, shown only as they are written in real text, with English meanings, and expects a lot of the design session: the session screen itself is to become better and more interesting, not only to gain new task types.

- **Decision:**
  1. **Word tasks move into P9.**
     - A word made only of kana the learner knows is a task. Each answer is evidence for every kana of the word, as the P7 model already allows ([ADR 100](100-knowledge-model-fsrs-planner-and-answer-log.md)).
     - Two things come with the word tasks: the report action and its dialog on a word task ([content.md](../spec/content.md), "Reports"), and the JMdict credit on `/about`.
     - "Words you can read now" on `/` and in the session summary stay in P12.
  2. **Only words written in kana.** A word is selected when all of these hold:
     - **Written in kana.** Its JMdict entry has no kanji, or its first sense is "usually written using kana alone" (`uk`).
     - **Common.** Its reading carries `news1`, `ichi1`, `spec1` or `spec2`.
     - **Fit to show.** It has no vulgar, rude, derogatory or sensitive sense, and its first sense is not archaic, obsolete or rare.
     - **A word, not a name or grammar.** Its first sense is not a name, and not only a particle, auxiliary, conjunction, copula, prefix, suffix, counter or expression.

     The rule is the same for both scripts and replaces "N5–N4 by reading" for words. The N5–N4 lists stay for the vocabulary filter of phrases. A kanji word written in kana is never a word task. The pull request that changes `packages/content` writes the rule into [content.md](../spec/content.md), "Words", and settles the filter on a sample that the maintainer reads.

  3. **Meanings are English only** in the MVP (O3, [ADR 093](093-learning-only-words-in-learning.md)). The meaning is shown after the answer, never before it, because the meaning of a loanword gives its reading away.
  4. **Words start when there are enough.** Word tasks begin once the selected track has enough readable words. The threshold comes from part 3 of the research. Kanji words do not fill the first rows.
  5. **Signs are dropped.** No pinned source marks a sign, and a hand list would break D19.
  6. **More task types in P9**, beside the methods of ADR 099, point 5:
     - "find the error": a word and its romaji, one kana of which does not match;
     - "hiragana or katakana?", once both tracks have known kana;
     - the rules of っ, ー and long vowels, taught and practised as build tasks are;
     - task types interleaved by the planner, so that a session is not one kind of task after another;
     - a session that may close with a word made of its kana.

     Their weight in the model and the planner's rules come from parts 2 and 3 of the research.

  7. **A design session opens P9,** before any code pull request, as [Design workflow](../design/workflow.md) describes. Its brief is wider than drawing the new task types:
     - **The session screen as a whole** is redrawn to be better and more interesting. That covers `KanaTask` and the session line, how one task type gives way to the next, the feedback after an error, and the moment of reading a word and seeing its meaning. Decision 152 only drew places for the later task types; the session replaces those places.
     - **Every task type of P9** is drawn in full. So are the closing word and the stroke order in the kana details.
     - **Constraints that stay:**
       - the keyboard first;
       - the render rule of the hot path;
       - the budgets;
       - no score, record or kana per minute ([ADR 093](093-learning-only-words-in-learning.md), point 1);
       - the tokens and the components of the design system.
  8. **Phases.**
     - P9 is the learning methods of ADR 099, the word tasks and the task types above.
     - P12 keeps "words you can read now" on `/` and in the summary.
     - The order after P9 does not change, and the O6 rule of ADR 099 holds.
     - P9 is specified in full once parts 2 and 3 of the research are done.

- **Justification:**
  - Words give meaning to an answer, which a single kana does not have. The content allows them from the first session, so keeping them for P12 would leave the next three phases as dull as now.
  - Showing words only as they are written keeps what the learner reads true to Japanese. The wider selection makes up for the kanji words. It keeps about as many hiragana words as the chunk and gives katakana eight times as many, most of them loanwords a learner recognises.
  - Onomatopoeia (161 in hiragana) is written in kana, belongs to Japanese, and is a reason to read.
  - Shown before the answer, the meaning turns a reading task into a translation (`coffee` → `koohii`). Shown after it, the meaning is the reward.
  - The list of readable words is a screen of its own and needs the home's design. The tasks do not.
  - Variety comes from the session screen as much as from the task types. A design session that only places new tasks into today's screen would not answer the maintainer's complaint.

- **Rejected alternatives:**
  - _Keeping words in P12:_ three more phases of kana alone, although the content is ready.
  - _All 1,167 N5–N4 hiragana words:_ most are kanji words written in kana, which a Japanese reader never sees so.
  - _Only the N5–N4 words written in kana:_ 6 words after the vowels and 10 after the k row, nearly all interjections.
  - _The kanji spelling beside a kanji word:_ the chunk and the font hold no kanji. The kana font's budget of 45 KB leaves no room for about 950 more glyphs.
  - _Signs drawn from the word list by hand:_ D19.
  - _The meaning before the answer:_ see the justification.
  - _Several typefaces, vertical text, the learner's name in katakana:_ proposed and not chosen by the maintainer.

- **Consequences:**
  - These change with this ADR:
    - [phases.md](../spec/phases.md): P9 and P12;
    - [Product scope](../spec/README.md#product-scope);
    - the phase of shipped content and of reports, from P12 to P9: [content.md](../spec/content.md), [quality.md](../spec/quality.md), `README.md` and [quality gates](../architecture/quality-gates.md).
  - [content.md](../spec/content.md), "Words", and the pipeline change in one pull request of P9. The content version and the word chunks change with it, and each word chunk stays within the 40 KB of a content chunk.
  - The [research note](../research/2026-11-27-p9-words-content.md) holds the numbers. Parts 2 (task types and their weight) and 3 (the planner) come before P9 is specified in full.
