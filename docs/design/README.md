# Design system

The visual reference for Nekotype: tokens, components, logo and cat assets. [ADR 031](../adr/031-adopt-the-nekotype-design-system.md) adopted it from P2, [ADR 059](../adr/059-design-system-v10.md) took version 10, drawn for the learning-first product of [ADR 058](../adr/058-learning-first.md), and [ADR 094](../adr/094-design-system-without-typing.md) took the typing trainer out of it for the learning app of [ADR 093](../adr/093-learning-only-words-in-learning.md). Where it disagrees with [`docs/spec/`](../spec/README.md), the spec wins.

## Where things are

| Path                                         | Contents                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`source/README.md`](source/README.md)       | Principles, colour, type, layout, motion, the screens                                               |
| [`source/tokens.json`](source/tokens.json)   | All tokens                                                                                          |
| [`source/components/`](source/components/)   | Guidelines per component, types, reference CSS and JS                                               |
| [`source/assets/`](source/assets/)           | Logo, favicon and the `geometry` cat (ADR 031); all rights reserved, see [BRAND.md](../../BRAND.md) |
| [`source/decisions.md`](source/decisions.md) | How each design question was resolved; v10 decisions under "After ADR 058"                          |

`source/` is a verbatim export of the [private artifact](https://claude.ai/artifact/22bxWBXuofNxqfnPzuvej1): version 10 with design decisions up to 152. Each export since version 10 is recorded in an ADR ([ADR 062](../adr/062-design-review-of-the-p3-build.md) and later; the [ADR index](../adr/README.md) lists them), and [`source/decisions.md`](source/decisions.md) holds every decision. It keeps the export's folder names and is excluded from Prettier. It is not edited by hand: change the artifact and export again. Live previews of components and screens stay in the artifact, as do the font files.

## Changing the design

The artifact holds only approved design. A design session is drawn in a separate workbench artifact, in rounds the maintainer reviews one at a time, then moved into the artifact and exported. The workbench is deleted after the export. The procedure: [workflow.md](workflow.md) ([ADR 106](../adr/106-design-sessions-in-a-workbench-artifact.md)).

## Moving a component into the app

`bundle.js` and `bundle.css` are a React reference, not a dependency. Components are rewritten in Preact in `shared/ui` under the rules in [Frontend](../spec/frontend.md).

- **Learning task.** `KanaTask` and its `createTaskController` draw one task of a learning session; they are not built on the typing stream (ADR 059), which left the system with the typing trainer (ADR 094).
- **Fonts.** Fonts are subset by the project's own build ([ADR 032](../adr/032-font-weights-for-the-design-system.md), [ADR 034](../adr/034-design-tokens-and-font-build.md)); the font files in the artifact are copies of those subsets. The glyphs under "Glyphs to add to subsets" in [`source/decisions.md`](source/decisions.md) are in the subsets (`apps/web/scripts/subset-fonts.mjs`); the Noto subset is built from the generated content, so it holds the punctuation the words and phrases use, `！` and `？` included (ADR 071).
- **Names.** The code uses the design's names (ADR 059): `Switch` for the on/off track and the `text` button variant. `Toggle` in the code is the on/off item that the [`Segmented`](source/components/Segmented/README.md) guidelines had until ADR 094, not the old switch; it goes with the typing filters.
- **Identifiers.** Row and strictness values are the engine's (`RowId`, `learner`, `ime`). `index.d.ts` documents them but is not imported.
- **Strings.** Russian and English labels in the reference are examples. All strings come from `shared/i18n`.
