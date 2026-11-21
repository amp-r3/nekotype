# Kana learning methods beyond recall and recognition

Written on 2026-11-21, before the knowledge model of P7 and the ADR that reorders the phases after it. Nekotype teaches a kana with two tasks today: recall (the kana is shown, the learner types its romaji) and recognition (the romaji is shown, the learner picks the kana from 4) ([Learning](../spec/learning.md)). P8 adds listening. All of them train one association, shape → sound, and most of the work is recognising a shape. The maintainer asked for more methods and chose eight of them on 2026-11-21. This note collects the evidence for each one, says what the task would be in Nekotype, what an answer should be worth to the model, and what it costs.

The note decides nothing. It is input for:

- the P7 research note, which must define one item model that accepts every task type below ([Phases](../spec/phases.md), P7);
- the ADR that places the methods in phases.

## How the evidence was read

The sources were found by web search on 2026-11-21. For most of them only the abstract, a publisher page or a citing paper was read, not the full text. Where a result comes from a secondary source, the note says so. Each method gets one of four labels:

- **strong**: many experiments or a meta-analysis, and the effect holds for paired associates like kana;
- **moderate**: controlled experiments, but on other materials or with mixed replications;
- **weak**: small or classroom studies, or a theory without direct tests;
- **hypothesis**: no study found; the method follows from how kana are built.

The two principles the model already rests on are strong and are not repeated per method:

- **Retrieval practice**: a test helps long-term retention more than restudy, although restudy wins on an immediate test (Roediger & Karpicke 2006).
- **Spacing**: practice spread over time beats massed practice (Cepeda et al. 2006, a synthesis of 317 experiments).

## 1. Discrimination of confusable kana

**Evidence: moderate.** Interleaving examples of different categories helps when the categories are hard to tell apart, and massing helps when they are easy (Kang & Pashler 2012; Carvalho & Goldstone 2014). Kang and Pashler read the gain as coming from the contrast between neighbours, not from the time gap between them. Later work found that spacing adds to it (Birnbaum et al. 2013). For kana, a classroom report on katakana names シ/ツ and チ/テ as the pairs learners struggle with, and the difficulty eased within four sessions (Suemasa et al.). No study was found that measures kana confusion rates directly.

**Task.** A contrast task: the options come only from the kana's confusion set (シ ツ ソ ン, ぬ め, わ ね れ), in both directions. After the answer, the pair is shown side by side with the difference that separates them, for example the stroke direction of シ and ツ. The visually-similar table in `packages/engine` and the `mixups` of recognition are the seed of the confusion sets.

**For the model.** Confusion is a state of a pair, not of a kana: the learner may know シ and ツ alone and still mix them up. The model needs a confusion count per ordered pair, fed by recognition mixups and by recall errors, since the engine attributes a typed `tsu` on シ. The planner schedules contrast tasks for pairs above a threshold. A correct contrast answer is strong evidence for both kana of the pair, because the lure is the hardest one there is.

**Cost.** Low: a new task type in `KanaTask`, the pair state and the explanation strings in `en` and `ru`.

## 2. Feedback that teaches

**Evidence: strong.** In word-pair learning, showing the correct answer after an error improved final recall, and feedback that said only "right" or "wrong" did not help (Pashler et al. 2005). Multiple-choice tests teach the lures as well, and feedback after the test removes that harm (Butler & Roediger 2008). This matters for recognition, whose distractors are chosen to be similar. Errors followed by corrective feedback help learning, most of all for errors made with confidence: the hypercorrection effect (Metcalfe 2017). Practising an item to a correct answer, then again in later sessions, is successive relearning (Rawson & Dunlosky, review 2022).

**Task.**

- After an error, show the right answer next to what the learner's answer was: "you typed `tsu`: that is ツ; this is シ (`shi`)".
- The kana comes back two or three tasks later in the same session, not as the next task: a short gap is spacing within the session.
- Today an error shows the right option and waits for Enter. The explanation line is new; the re-check needs the planner to insert a task.

**For the model.** A re-check a few tasks after an error is weak evidence of memory, since the answer was just seen. It should count less than a first answer of the session. The model already has the answer time; it also needs the lag in tasks since the kana was last shown.

**Cost.** Low to medium: planner insertion, the explanation line in `KanaTask`, strings.

## 3. A guess before the introduction

**Evidence: moderate in general, weak for kana.** An attempt to answer before the answer is known, even when it fails, improves learning once the answer is shown (Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009, the "pretesting effect"). The benefit is clearest when the cue and the answer are related in meaning, and studies with immediate feedback found that failed attempts can also impair learning (Hays, Kornell & Bjork 2012; Knight et al. 2012). A kana's shape has no relation to its sound, so a blind guess at a new kana is close to random and its benefit is uncertain.

**Task.** The guess is only asked where it can be reasoned out, not blind:

- a katakana guessed from its hiragana pair (see 4): "カ looks like か; what is it?";
- a dakuten kana guessed from its base and the rule (see 5): "か is `ka`; what is が?";
- a shape guessed from its mnemonic, once mnemonics exist.

The answer is shown at once, and the introduction follows.

**For the model.** No evidence of memory: the kana is new. A correct guess is evidence that the rule or the pair is understood, which may let the planner move faster through a row.

**Cost.** Low, given 4 and 5.

## 4. Hiragana → katakana transfer

**Evidence: hypothesis.** No study was found that teaches katakana through hiragana. The method follows from the scripts: many pairs come from the same man'yōgana and still look alike, for example か/カ (加), り/リ (利), へ/ヘ (部), せ/セ (世), も/モ (毛). A learner who knows the hiragana can anchor the katakana to it, which is an elaboration on known material. The risk is interference: the learner may answer with the wrong script, or confuse the pair less clearly related ones (ち/チ, そ/ソ).

**Task.**

- At the introduction of a katakana whose hiragana the learner knows, both are shown with the shared origin where there is one.
- A task "か → ?" with katakana options, and the reverse.

**For the model.** This collides with A7: today "an answer in one track never changes the other". A transfer answer involves both tracks. Either the transfer task counts only for the katakana, or A7 is amended so that an item can have links to items of the other track. The confusion pairs of 1 also cross the scripts (へ/ヘ are nearly the same shape, which is a help, not a confusion).

**Cost.** Low for the task; the decision on A7 is the main cost.

## 5. Building composite kana

**Evidence: hypothesis.** No kana-specific study was found. Dakuten, handakuten and yōon are rules: が is か with voicing, ぱ is は with `p`, きゃ is き with a small ゃ. Teaching the rule once and practising it on new members is cheaper than learning every composite as a separate shape. The dependencies of [Learning](../spec/learning.md) already follow this structure: が depends on か, きゃ on き and や.

**Task.**

- "Build" tasks: き + ゃ shown, the learner types `kya`; or `gya` shown, the learner picks its parts.
- A guess from the rule before the introduction of each composite (3).

**For the model.** An answer on a composite is evidence for its parts, as a word answer is evidence for each kana of the word (P7 already requires this). It is also evidence for the rule: once the dakuten rule is shown on a few rows, the next dakuten row may unlock as a group. That may make the pace goal for the whole track easier to reach ([Learning goals](../spec/README.md#learning-goals)). The P7 simulation can test it.

**Cost.** Low to medium.

## 6. Fluency

**Evidence: moderate in theory, weak in direct tests.** In the theory of automatic processing in reading, a skill is first accurate and needs attention, then automatic and does not, and slow decoding takes attention away from understanding (LaBerge & Samuels 1974). For letters, what predicts reading is whether letter-sound links are automatic, not only whether they are known (Clayton & Hulme 2017). A 2022 meta-analysis of 11 studies of automaticity training for letters and words in grades 1–6 found an overall effect of 0.28 on fluency and comprehension that was not statistically significant (per a citing summary).

**Task.** A short timed run, about 20 seconds, over kana the model rates as known. The kana come in a stream, and the learner types them one after another. The engine already matches a stream, since the removed trainer used it.

This is not the removed trainer ([ADR 093](../adr/093-learning-only-words-in-learning.md)): there is no speed record, no free practice and no score. The planner chooses the kana, and the run feeds the model.

**For the model.** Mostly speed evidence for kana that are already accurate. It shows when a kana is accurate but slow, which the median answer time already measures. The run is offered only above an accuracy threshold.

**Cost.** Low to medium: a session type over the existing stream matching.

## 7. Handwriting by drawing on the screen

**Evidence: moderate, mixed.**

- Adults who learned new characters by hand recognised them and their mirror images better than those who learned them by typing, with different brain activity during recognition (Longcamp et al. 2008).
- A 2016 study that trained German letters found no difference between handwriting and typing (per a citing paper).
- A 2021 preschool study found that composing letters from parts, without writing, did as well as handwriting, which questions the motor explanation.
- For Chinese characters, learners who spent about 35% of practice time on handwriting recognised fewer words, and the gains were lost after a week (Lu et al. 2019). Writing costs time that could go to retrieval.
- Kana-specific studies found are small or classroom-based (Vanbaelen 2025; a katakana case study).

The likely gain is the discrimination of shape: mirror images, stroke direction, the confusable pairs of 1. The likely cost is time.

**Task.**

- The learner draws the kana with a finger, a stylus or the mouse after its romaji (or, from P8, its sound) is shown.
- Each stroke is checked against the reference: order, direction, start and end, and rough shape. A wrong stroke is shown and corrected, as in 2.
- Writing tasks are a small share, aimed at confusable and weak kana, not at every kana.

**Data.**

- [KanjiVG](https://kanjivg.tagaini.net/) has a file per kana (`03042.svg` あ, `030a2.svg` ア, `030f4.svg` ヴ, checked on 2026-11-21) with each stroke as a separate centre-line path in order, which is the shape a stroke check needs. The licence is CC BY-SA 3.0 (copyright Ulrich Apel).
- [AnimCJK](https://github.com/parsimonhi/animCJK) has kana SVGs that may be used under the LGPL, since they are not derived from Arphic fonts (its README). Strokes that overlap themselves, as in あ and ぬ, are split into parts.

**Licence.** ShareAlike applies to the converted data. The data would be shipped as separate files under their own licence, as the fonts are under OFL-1.1 ([ADR 064](../adr/064-agpl-code-reserved-brand.md)), and credited on `/about` and in `NOTICE.md`. The maintainer decides whether that fits the licence policy; this note is not legal advice.

**Check.** A comparison of resampled strokes in the manner of the $1 recognizer (Wobbrock et al. 2007; BSD), applied stroke by stroke in order, or code written for the project. [Hanzi Writer](https://github.com/chanind/hanzi-writer) (MIT) has a stroke quiz, but its kana data comes from AnimCJK under other licences.

**Input.** This is the one method that needs a pointer in a keyboard-first application. On a phone or tablet it fits; on a desktop with a mouse, drawing is slow and imprecise.

**For the model.** A correct drawing from memory is production, the strongest evidence of the shape. A drawing with corrected strokes is weaker.

**Cost.** High:

- the data conversion in the content pipeline;
- the stroke check and the drawing surface (pointer events, outside the keystroke hot path);
- a lazy chunk with the data (size to be measured);
- a design session;
- device testing.

It is the largest item of the eight and fits a phase of its own.

## 8. Dictation and minimal pairs

**Evidence: strong for perception training, which this is.** High-variability phonetic training began with Japanese listeners learning English /r/–/l/ from minimal pairs with feedback (Logan, Lively & Pisoni 1991), and the gains held after three months (Lively et al. 1994). Its canonical form needs several talkers, several phonetic contexts and corrective feedback (Thomson 2018). A meta-analysis of 79 studies supports it for L2 perception (Uchihara, Karas & Thomson 2024). Multi-talker training has a small benefit over a single talker, which a replication did not find (Brekelmans et al. 2022).

**Task.**

- Dictation: a kana is played, the learner types its romaji. This is recall from sound, the counterpart of the listening task of P8, which is recognition from sound.
- Minimal pairs: two kana that differ in one feature (か/が voicing, は/ば/ぱ), the learner picks which one was played.
- The contrasts that are hardest for English and Russian speakers are long vowels, っ and the length of ん. These are features of words, not of single kana, so they belong to words in learning.

**For the model.** Sound items or task types of the same kana item, as P7 requires ("listening" is already named there).

**Cost.** Medium, on top of the audio phase. Several talkers conflict with O6, which asks for one voice for every kana ([Decisions](../spec/decisions.md)).

## Mnemonics

Mnemonics are already planned with the placement test. The evidence is mixed: a study of 66 beginners found no difference between mnemonics and flash cards on immediate recall (Matsunaga 2003, per its abstract and a Japan Foundation summary). A katakana study found no benefit from conventional mnemonics (Matsunaga 2009), and their long-term effect has been questioned (Kondo 2011). The guess of 3 can use them once they exist.

## What the P7 model must accept

- **Task types** as evidence of one kana item, each with a weight to be fitted in the P7 simulation:
  - recall, recognition, contrast, transfer, build, fluency run, drawing, listening, dictation, minimal pair;
  - an ordering to start from: drawing and recall above contrast, contrast above recognition, a re-check after an error and a fluency run lowest for memory.
- **Answer features**: correctness, answer time, hint used (Esc, "Show the romaji"), the lag in tasks since the kana was last seen, whether it is a re-check after an error, and which wrong answer was given.
- **Confusion per ordered pair**, fed by mixups and attributed recall errors, read by the planner.
- **Credit to parts**: a composite or a word answer is evidence for each kana in it, and maybe for a rule (dakuten, handakuten, yōon).
- **Links across tracks** if A7 is amended for transfer.
- **The planner** inserts re-checks into a running session and chooses task types, not only kana.

## Placement in phases

| Method                   | Evidence        | Cost       | Needs                        |
| ------------------------ | --------------- | ---------- | ---------------------------- |
| Feedback that teaches    | strong          | low–medium | model, planner               |
| Discrimination           | moderate        | low        | model (pair confusion)       |
| Guess before introducing | weak for kana   | low        | transfer, build or mnemonics |
| Transfer hira → kata     | hypothesis      | low        | decision on A7               |
| Building composites      | hypothesis      | low–medium | model (credit to parts)      |
| Fluency run              | weak (direct)   | low–medium | model (accuracy threshold)   |
| Dictation, minimal pairs | strong          | medium     | audio; decision on O6 voices |
| Drawing                  | moderate, mixed | high       | stroke data, licence, design |

The six methods without sound and drawing fit one phase after the model. The phase can come before or after the new learning home; the home design keeps places for them either way. Dictation and minimal pairs join the audio phase. Drawing is a phase of its own.

## Open questions for the maintainer

1. **A7 and transfer.** Should a transfer answer count only for the katakana, or should A7 be amended so that items of the two tracks can be linked?
2. **Drawing on a desktop.** Should writing tasks be offered with a mouse, only on touch screens, or behind a setting?
3. **Voices.** Should minimal pairs use one voice as O6 asks, or should O6 look for several voices?
4. **Fluency and ADR 093.** Is a timed run chosen by the planner acceptable, given that the typing trainer was removed?
5. **Stroke data licence.** Is CC BY-SA 3.0 data (KanjiVG) or LGPL data (AnimCJK kana) acceptable as separate files next to AGPL code?

## Sources

The sources, with links, are listed in [a separate file](2026-11-21-kana-learning-methods-sources.md).
