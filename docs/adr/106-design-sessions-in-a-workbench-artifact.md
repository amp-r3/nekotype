# ADR 106: Design Sessions Run in a Workbench Artifact, and the Design System Holds Only What Is Approved

- **Status:** In force.
- **Context:**
  - Design changes have been drawn straight into the design-system artifact since [ADR 062](062-design-review-of-the-p3-build.md). Variants, explorations and proposal notes went in with them and stayed after the choice. [ADR 080](080-design-system-clean-up.md) removed one such sheet, `StatsExplorations`.
  - On 2026-11-23 the artifact still draws the model before P7 (`confident`, Leitner boxes, `review (N)`, a review session), the phase numbers before [ADR 099](099-learning-home-methods-and-phases-after-p6.md), the typing trainer on its cover, and notes such as "proposal, open question". The export in `docs/design/source/` is the same, byte for byte.
  - How to change the design was written only in the phase plans (the P6 and P8 step M1) and in the agent's notes.
  - The P8 session ([p8-plan.md](../archive/p8-plan.md), section 4) is the largest so far: five screens, every state, and the states of P9–P12 drawn switched off. One review cannot hold it.
  - On 2026-11-23 the maintainer asked:
    - for the design-system artifact to be the project's source of truth, consistent and without leftover examples or changes;
    - for a separate artifact for development, which shows how a thing looks now and what is proposed, with several variants;
    - for a large session to run in parts: the agent draws what it recommends, or what it understood from the maintainer's answers, and the maintainer refines it;
    - for the procedure to be written down.
- **Decision:**
  1. **Two artifacts.** The design system holds only approved design. A workbench, an ordinary HTML artifact, holds one session: for each question, "now" and variants A, B, sometimes C, the recommended one marked.
  2. **Rounds.** A session runs in rounds of one screen or a small group of questions. Before a round the agent asks up to four questions, or draws its recommendation when the maintainer asks for it. The session may stop after any round; the workbench's first screen holds the state.
  3. **Remarks in the chat.** The workbench is a static page without forms or stored state.
  4. **Transfer, then export.** When every round is approved, the agent moves the approved variants into the design system in one change, then the export pull request follows. Each design decision names, in one line, the variants that were considered.
  5. **Deletion.** After the export is merged, the workbench is deleted, with the maintainer's confirmation. Only the export reaches the repository.
  6. **Before P8, a clean-up.** The design system catches up with the P7 code (item o of the P8 brief moves here), with the phase numbers of ADR 099. It loses the typing trainer's leftovers and the notes of earlier sessions. The cover is redrawn, with its variants in a workbench: the first use of the procedure. It becomes design decision 139 and ADR 107 (p8-plan.md, M0 and PR C). P8's decisions start at 140, and the ADR numbers the P8 plan expects move up by two.
  7. The procedure is in [docs/design/workflow.md](../design/workflow.md).
- **Justification:**
  - A design system that holds only approved design can be read without asking what is current. A code pull request builds what it shows, and an audit compares the code with it.
  - A workbench per session starts empty and is deleted whole, so nothing of a session can stay behind. `decisions.md` and the ADR keep the outcome and the variants considered.
  - Rounds keep each review small enough to look at every state. They also let a session span several days and conversations without losing its state.
  - "Now" next to each variant shows what changes without the maintainer having to remember the current screen.
  - Remarks in the chat are how the maintainer already works. A page without forms is less code to get wrong, and the agent's effort goes into the drawings.
  - The clean-up before P8 lets the P8 workbench show the real application as "now", not the model before P7.
- **Rejected alternatives:**
  - _Draw in the design system, as before._ The leftovers above are what that produced.
  - _One permanent workbench with a section per session._ One link, but every session's drawings would have to be removed by hand.
  - _A second artifact of the Design System type._ Its page shows one card per component; it has no place for "now" and variants side by side.
  - _Choice buttons and notes stored in the workbench._ The maintainer prefers the chat, and stored state needs code the drawings do not.
  - _Keep the workbench after the export as a record._ The decisions record the outcome. Drawings of rejected variants outside the repository would go stale.
  - _A page template for the workbench in the repository._ Not before a second session shows the page is stable. Until then the agent builds it by [the description](../design/workflow.md#the-workbench-page).
- **Consequences:**
  - New: `docs/design/workflow.md`, linked from `docs/design/README.md`, `docs/README.md` and `AGENTS.md`.
  - [p8-plan.md](../archive/p8-plan.md):
    - a step M0 and a pull request C for the clean-up;
    - M1 in five rounds;
    - item o of the brief moved to the clean-up;
    - design decisions from 140;
    - the ADRs of P8 renumbered: 108 in PR D, 109 in PR 1, 110 in PR 2, 111 in PR 3.
