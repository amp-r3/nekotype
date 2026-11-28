# ADR 119: The P9 Design: the Task on a Card, Feedback That Compares, Words and Every New Task Type, the Stroke Order

- **Status:** In force.
- **Context:**
  - P9 ([phases.md](../spec/phases.md), item 10) brings words written in kana into the session, new task types, feedback that teaches after an error, a round of the kana answered wrong, the report dialog on word tasks and the stroke order in a kana's details ([ADR 116](116-words-written-in-kana-and-varied-tasks-in-p9.md), [ADR 117](117-grades-of-the-p9-task-types.md), [ADR 118](118-the-p9-planner.md)). Its plan ([p9-plan.md](../../p9-plan.md)) fixed the data and the rules (section 3) and left the screens to a design brief (section 4), with the wish of ADR 116, point 7, that the session screen as a whole become better and more interesting.
  - The session ran as [ADR 106](106-design-sessions-in-a-workbench-artifact.md) describes, on 2026-11-28: a workbench artifact and four rounds — the session frame with feedback and the round; words, the rules and the report dialog; the other task types; the stroke order, `/about` and the summary — each with the maintainer's answers before it and a review after it, then a review of every approved variant for usability and copy. The approved variants were moved into the design artifact as decisions 159–177 and are exported here.
  - Every state of every kind fits the 280px a phone leaves above its on-screen keyboard; each was measured in a browser.
- **Decision:** Design decisions 159–177 in [`decisions.md`](../design/source/decisions.md), exported from the design artifact.
  1. **The task on a card** (159). One frame for every kind (`KanaTask`): the session line and the ticks, then the task on a card (`bg-raised`, `line`, `radius-md`) with a caption naming the kind over the prompt, the prompt and the options; the feedback lines, the notice line and the key line under it. Recall has no caption, but its line is reserved. Each new card slides in. An introduction shows the kana's row.
  2. **Feedback after an error** (160). Every task with the verdict `wrong` waits for `Enter`, `Space` or a click; `next` stands in the key line. Recall compares in the stage: the right kana in its place, the learner's kana smaller on its left in `miss`; a choice keeps its marks. Under the card the difference of a similar pair and the promise that the kana comes back; the pair as a sentence for a screen reader. A slip shows nothing.
  3. **A phone** (161): the card loses its frame, the promise moves into the key line, a kana prompt of a choice sits on a 56px line, the run's kana are 22px.
  4. **The round and the closing word** open with screens of their own: the cat (`neutral`, `content`), a title, the kana, one line and `start` (162, 165).
  5. **Words** (163, 164): the word in the place of the kana, one buffer under the current kana, typed kana dimmed; once answered the reading and the English meaning, held for `Enter`, and `report a problem` in the key line. An error in a word first shows its first wrong kana as a recall's error, then the word; a rule error shows the rule.
  6. **The rules っ and ー** (166): the example word is the hero, the rule's mark and the letters it gives in `eye`, one line of rule.
  7. **The report dialog** (167): the shared `Dialog` with the word and its meaning, the reasons as a `RadioGroup` with none chosen in advance, a `Textarea` and the Turnstile slot; the states of decisions 115–116.
  8. **The other kinds** (168–173): contrast with 2–4 larger options; a transfer's introduction with the origin kanji drawn from KanjiVG strokes, the part the katakana kept in `eye`; build as parts and the kana (`か + ゛ → が`); find the error as cards with the romaji each kana wears; hiragana or katakana? with two word cards; the fluency run as one line typed in one stream, no timer, count or score.
  9. **The stroke order** (174) at the top of the kana details: each glyph boxed, the strokes numbered, drawn when the dialog opens at one pen speed (a stroke's time follows its length), `replay` with the `reset` icon. **`/about`** (175) lists JMdict and KanjiVG under Sources. **The summary** (176) keeps decision 148, its confusions from the verdicts.
- **Justification:**
  - A card sets the one object of the session screen apart from the line and the keys, and its slide-in marks each new task without moving the prompt, which stands in one place for every kind thanks to the reserved caption line. The caption says what to do, which matters once the kinds change from task to task.
  - An error is the moment to learn: a 400ms flash was too short to read what the answer meant. Comparing the two kana as a picture shows the confusion at a glance; the difference line says what to look at.
  - Screens of their own make the round and the closing word read as parts of the session, not as more tasks; they are the cat's first places in the session, on screens that are not tasks.
  - One buffer keeps a word as calm as a recall; the reading and meaning come when they reward the answer, not before. Showing a word's error as a recall's error first keeps one look for every error and fits a phone (all on the word took 298px of 280).
  - A rule is seen on a word: the mark and the letters it gives, in one colour, without a line that would read as the romaji's.
  - No reason chosen in advance: a default would be sent by whoever does not read it.
  - Larger options make the difference of similar shapes visible; the origin kanji explains a katakana's shape; the parts explain a voiced or combined kana.
  - A stroke drawn at one pen speed shows the hand's movement; a fixed time per stroke made long strokes rush.
- **Rejected alternatives:**
  - _Frame:_ the screen as it was with a caption and a fade (moderate). _Captions:_ on every task, recall included.
  - _Feedback:_ everything as lines under the task; moving on at once with the notice under the next task.
  - _Round, closing word:_ a line in the first task's notice; a caption only.
  - _Words:_ romaji kept under each kana; an error in a word shown all at once on the word.
  - _Rules:_ the mark large over the example; the mark and its letters underlined.
  - _Report dialog:_ a `Segmented` of reasons (the Russian labels do not fit 360); a reason chosen in advance.
  - _Contrast:_ the recognition cards as they are. _Transfer:_ the kanji still. _Find the error:_ the word whole with small numbers. _Run:_ a screen of its own before it.
  - _Stroke order:_ textbook steps, a frame per stroke; drawing only on a button; one time per stroke.
  - _Summary:_ listing the kana the round brought back right.
- **Consequences:**
  - The export changes `README.md` (the principles, typography, motion, the kana details, `/about`, the learning session, the summary, the keyboard, later phases, the cat, the prohibitions, iconography), `decisions.md`, the guidelines of `Cat`, `Dialog`, `Input`, `KanaTask`, `Notice` and `OptionCard`, new guidelines `KanaWord`, `RadioGroup` and `StrokeOrder`, `bundle.js`, `bundle.css` and `index.d.ts`. No token changes, so `tokens.css` and `tokens.test.ts` do not change.
  - The design system's rules change in three places, each named with its decision: an origin kanji drawn from its strokes is the one kanji in the interface (169); the task's card is the one card of the session screen (159); the drawing of strokes animates `stroke-dashoffset` and colour, outside the hot path (177). The cat gains two places (162, 165); the `reset` icon a second use (174).
  - Glyphs `゛` U+309B and `゜` U+309C join the Japanese subset (170), in the pull request that shows a build (PR 11).
  - Behaviour of the plan that changes with the export: every wrong answer waits for `Enter` (D23); the report dialog chooses no reason in advance (D26). The data gain three items, with the maintainer's consent on 2026-11-28: the origins table names the part of the kanji the katakana kept, and `origins.json` the strokes of that part (D2); the session plan exposes `roundKana` and `seen` for the screens of the round and the closing word (D12).
  - [p9-plan.md](../../p9-plan.md): the decisions fill the last column of section 4.2, sections 3 and 7 are amended as above, and the cards of PRs 6, 7, 8, 10, 11 and 12 are rewritten against the export.
  - The P9 workbench artifact is deleted after this export is merged.
