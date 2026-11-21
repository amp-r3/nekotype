# ADR 099: A Learning Home and More Learning Methods Join the MVP; the Tracks Are Linked; P7–P14

- **Context:** P6 closed on 2026-11-20 with learning only. [ADR 093](093-learning-only-words-in-learning.md) planned P7 (the knowledge model), P8 (audio), P9 (placement and mnemonics), P10 (words), P11 (vocabulary) and P12 (release). On 2026-11-21 the maintainer reviewed the learning screen and found two faults:
  - it is unclear what to do next;
  - progress is barely visible.

  The kana chart, which fills most of `/`, belongs on a progress screen, not on the first screen. The maintainer also found that recall and recognition, which both train shape → sound, are too few methods. They chose more methods after a [research note](../research/2026-11-21-kana-learning-methods.md) that weighs the evidence for each one.

- **Decision:**
  1. **A learning home on `/`,** driven by the knowledge model, in a phase of its own after the model:
     - one next action with its reason, for example "5 kana are due for review", "next: the k-row", "practise 3 weak kana";
     - the model's forecast of when the next kana unlocks, in sessions ("in about 2 sessions"), not in days, and no daily goal;
     - the path through the groups of the track, with the learner's place on it;
     - an outline of the next session ("5 reviews, 2 new"), not a promise: the session still adapts as it goes;
     - what got stronger since the last session.
  2. **Hiragana first.** The home suggests hiragana; the model decides when to suggest katakana as well, by a threshold chosen in the P7 research. The learner can switch the track at any time.
  3. **"Progress" replaces `/stats`.** The route becomes `/progress`, with the kana chart on top, where it opens on its own, and the current statistics under it. The chart leaves `/`. "Leave session" and the session summary return to `/`.
  4. **The redesign covers** the home, "Progress", the session summary, the session screen, a kana details view and the navigation. Its design also draws the states of the later phases, so they do not redraw the home: the first visit and the placement test, the sound, the mnemonic, the stroke order and the words the learner can read. A later phase only turns its state on. The render rule of the hot path stays.
  5. **Learning methods** join the MVP, as task types of the knowledge model:
     - discrimination of confusable kana (シ/ツ, ぬ/め, わ/ね/れ), with contrast tasks and a confusion state per pair of kana;
     - feedback that teaches: after an error the right answer is shown next to what the learner's answer was, and the kana is checked again a few tasks later in the same session;
     - hiragana → katakana transfer: a katakana is introduced next to its hiragana, with their shared origin where there is one, and practised by "か → カ" tasks;
     - building composites: dakuten, handakuten and yōon as rules, with tasks that build a composite from its parts;
     - a fluency run: about 20 seconds of known kana typed one after another. The planner places it inside a session for kana that are accurate but slow. It has no kana per minute, no record and no free start, so the typing trainer does not return (ADR 093, point 1);
     - stroke order: every learnable kana has a "how to write it" view in its details. Writing by hand is the learner's choice; the application does not check a drawing.
  6. **The tracks are linked.** A7 ("hiragana progress does not unlock katakana") is amended: the items of the two tracks may be linked, and a transfer answer is evidence for both kana of the pair. Unlocking still follows each track's own items.
  7. **Audio** gains dictation (the sound is played, the learner types the romaji) and minimal pairs (か/が, は/ば/ぱ). One voice is kept, as O6 asks.
  8. **The P7 model accepts every task type** of this ADR and of ADR 093 from the start:
     - recall, recognition, contrast, transfer, build, fluency run, listening, dictation and minimal pair;
     - the answer features: correctness, answer time, a hint used, the lag in tasks since the kana was last seen, a re-check after an error, and the wrong answer given;
     - a confusion count per ordered pair of kana;
     - credit from a composite or a word to each kana in it;
     - links across the tracks;
     - a forecast, in sessions, of the next unlock and an outline of the next session, computed before the session starts;
     - enough history per item to say what got stronger since the last session.

     P7 keeps the current screens with the smallest change the new state needs: confidence and the boxes go, and the chart states and the summary follow the model. P7 adds no design.

  9. **Phases.** P0–P6 are done. The rest:
     - P7, the knowledge model and its sync;
     - P8, the learning home and "Progress";
     - P9, the learning methods of point 5;
     - P10, audio (the former P8), with listening, dictation and minimal pairs;
     - P11, the start (the former P9): the placement test and the mnemonics;
     - P12, words in learning (the former P10);
     - P13, vocabulary (the former P11);
     - P14, polish and release (the former P12).

     If O6 is still open when P9 closes, P11 goes before P10. Only the next phase is specified in full; a later phase is a scope line until the phase before it closes.

- **Justification:**
  - A next action with its reason answers "what now" without the learner reading a chart. A forecast in sessions follows from the model and does not depend on how often the learner comes back, which a forecast in days would have to guess.
  - The chart shows the whole track at once. It is the right picture of progress and the wrong first screen for a beginner who knows five kana.
  - The home has its own phase because the model alone is the largest change ahead (the learning state, its merge across devices, the CPU limit of `/api/sync`), and its screens can be designed only once the model's states are known. The minimal adaptation keeps production working at the end of P7.
  - The methods come right after the home because they need the model and the planner but no new content source. Feedback that teaches is the best-supported method in the note, and the discrimination of similar kana matches the errors learners make. Transfer and composites follow the structure of the scripts and are cheap.
  - Stroke order is shown and not checked: a drawing check needs stroke data, a stroke matcher, pointer input in a keyboard-first application and device testing. The evidence for handwriting is mixed, and it takes time from retrieval.
  - One voice: the gain of several voices for minimal pairs is small, and a replication did not find it. Several voices would make the open search for a sound source harder.
  - The tracks are linked because the scripts are linked. Many hiragana and katakana come from the same man'yōgana and look alike, and a learner who knows the hiragana can anchor the katakana to it.

- **Rejected alternatives:**
  - _The home inside P7:_ one phase of about 15 pull requests whose design waits for its own research.
  - _The home after the methods:_ the methods would be built on a screen that the maintainer has already rejected.
  - _A daily goal in minutes or sessions:_ a new concept the model does not need. The forecast and the outline already say what the next session gives.
  - _A guess before a kana's introduction:_ a kana's shape has no relation to its sound, so a guess is close to random, and its benefit for kana is uncertain.
  - _Drawing the kana on the screen with a stroke check:_ see the justification. It can return after the release.
  - _Several voices:_ see the justification.
  - _Keeping the tracks independent:_ transfer would have to count for the katakana only, and the shared shapes of the two scripts would go unused.
  - _Keeping `/stats` next to a new `/progress`:_ two screens in the navigation that answer the same question, "how am I doing".

- **Consequences:**
  - These change with this ADR:
    - [phases.md](../spec/phases.md): P7 in full, P8–P14 as scope lines;
    - [Product scope](../spec/README.md#product-scope);
    - [decisions.md](../spec/decisions.md): A7 amended, O6 for P10 and P9, O9 for P11.
  - The phase numbers of audio, start, words, vocabulary and release move by two in the spec, `AGENTS.md`, `README.md`, `docs/architecture/`, the package README of `packages/content` and code comments. The design export in `docs/design/source/` keeps the old numbers until the next export.
  - [learning.md](../spec/learning.md) describes the current learning until P7 replaces it. `/stats`, `frontend.md` and `metrics.md` describe the statistics screen until P8 renames it.
  - The release rules of [ADR 061](061-schema-reset-before-release.md) and the device-matrix pass apply to P14.
  - The P7 research note takes its requirements from point 8 of this ADR and from [Learning goals](../spec/README.md#learning-goals).
  - Stroke order data is shipped as separate files under their own licence (KanjiVG, CC BY-SA 3.0, or the kana SVGs of AnimCJK, LGPL), credited on `/about` and in `NOTICE.md`. The choice is made in P9.
  - [ADR 093](093-learning-only-words-in-learning.md) is amended: points 6 (audio comes right after the model) and 8 (the phases).

- **Status:** In force.
