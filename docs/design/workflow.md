# Design workflow

How the design changes: who draws what where, how the maintainer reviews it, and how it reaches the repository. Decided by [ADR 106](../adr/106-design-sessions-in-a-workbench-artifact.md).

## Two artifacts

| Artifact      | What it holds                                                                                                                       | Lifetime                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Design system | The approved design and nothing else: tokens, components, guidelines, previews of every screen, assets, the log of decisions        | Permanent; linked from [README.md](README.md)                               |
| Workbench     | One design session: for each open question, how it looks now and the proposed variants; the session's working copies of the changes | Created when a session starts, deleted after the session's export is merged |

Both live on claude.ai in the maintainer's account. Only the design system reaches the repository, through its export in [`source/`](source/README.md).

### Rules for the design system

- It shows what is approved. No variants, no explorations, no "proposal" or "open question" notes.
- Guidelines and captions describe what is. The history of a change lives in `decisions.md` only.
- It matches the code, or the code of the phase whose export it is. A state of a later phase is drawn only when a brief asks for it: switched off and named with its phase.
- It changes in two ways only: by the transfer at the end of a session, or by a direct change that has no visual choice (a guideline's text, a catch-up with decisions already made in ADRs). Either way the maintainer approves it, and the export follows.

## A design session

A session answers a brief: the design section of a phase plan, or a question a code pull request raised. A large brief, such as a phase's screens, is split into rounds so it never has to be reviewed in one sitting.

1. **Rounds.** The agent splits the brief into rounds, each one screen or a small group of questions, and lists them on the workbench's first screen with their status: waiting, drawn, approved.
2. **Before a round.** The agent asks up to four questions where the brief leaves a real choice, or the maintainer says "draw what you recommend". Then the agent draws its understanding.
3. **Drawing.** Each question is a card: how it looks now, then variants A, B, and sometimes C. The recommended variant is marked. Each variant says in two or three lines why it works and what it costs.
4. **Review.** The maintainer writes remarks in the chat, in Russian. The workbench is a static page with no forms or buttons. The agent revises the card, which shows the latest version with a line on what changed since the last review.
5. **Approval.** When the maintainer approves the round, the agent marks it approved with the chosen variants and starts the next round.
6. **Breaks.** A session may stop after any round and continue in another conversation. The status on the workbench's first screen is the state: a new agent reads it, the brief and this file, then goes on.
7. **Transfer.** When every round is approved, the agent moves the approved variants into the design system in one change. It numbers the decisions from where the plan says. Each decision names, in one line, the variants that were considered. The agent checks every changed preview in a browser and lists for the maintainer what to look at in the design system.
8. **Export.** After the maintainer's last approval, a pull request copies the exported files into [`source/`](source/README.md), with an ADR when the decisions change the code or the spec ([Decision logs](../README.md#decision-logs)).
9. **Deletion.** After the export is merged, the agent deletes the workbench, and the maintainer confirms the deletion. Nothing of it goes into the repository.

## The workbench page

The workbench is an ordinary HTML artifact, private, titled `Nekotype · <session>` (`Nekotype · P8 design`). It is not of the Design System type: that type shows one card per component and has no place for variants side by side.

- **First screen.** The brief's link, the rounds with their status, and the remarks still open.
- **A card.** The question and its constraints, then the frames: "now" and each variant. The maintainer can flip between them in one place and see them side by side.
- **A frame** is a page of its own, shown in an inline frame at a desktop width (1120 px) or a phone width (360 px). It has the switches of a design-system preview: the states of the screen and the language (`en`, `ru`).
- **Sources.** "Now" frames load the design system's files: `tokens.json` turned into CSS variables, `bundle.css`, `bundle.js`, the fonts and the screens' script, copied server-side with `files: { path: { artifact, path } }`. Variant frames load the session's working copies of the files the session changes. React 18 comes from jsDelivr with an exact version, as in the design system.
- **No runtime capabilities.** Remarks are written in the chat, so the page stores nothing.

## Changing the design system

The design system is an artifact of the Design System type. Its files are under `project/`, and `project/design-system.json` is its index.

1. Before the first publish in a conversation, `read` the artifact's URL with no `path`.
2. Read each file you change with `path`, and edit copies in the scratchpad, under one folder that mirrors `project/`.
3. Publish the changed files in one call, with `root` set to that folder.
4. Read `project/design-system.json` again. Set its `lastChange` (`by` the maintainer's name, `via` "Claude Code", `at` now, `note` one line). Publish it last, in a call of its own.
5. Check each changed preview in a browser before the maintainer looks: a local page with the tokens as CSS variables, `bundle.css`, React 18, `bundle.js` and the preview, opened with the repository's Playwright.

Details that are easy to miss:

- Every `Screen*/preview.html` holds the same script. A change to the screens' code or data goes into each of them.
- Images (the logo, the cat) are uploads, not files. A new one is uploaded with `asset: true`, and the index's `assetGroups` points at its id.
- `index.d.ts` is published with `contentType: "text/plain"`.
- A token removed from `tokens.json` is removed from `apps/web/src/shared/styles/tokens.css` too, because `tokens.test.ts` compares them.
- The cat in `bundle.js` and in `apps/web/src/shared/ui/cat.tsx` is drawn from the same geometry as the SVG files, and the three stay identical.
