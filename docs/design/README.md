# Design system

The visual reference for Nekotype: tokens, components, logo and cat assets. [ADR 031](../adr/031-adopt-the-nekotype-design-system.md) adopted it from P2, and [ADR 059](../adr/059-design-system-v10.md) took version 10, drawn for the learning-first product of [ADR 058](../adr/058-learning-first.md). Where it disagrees with [`docs/spec/`](../spec/README.md), the spec wins.

## Where things are

| Path                                         | Contents                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`source/README.md`](source/README.md)       | Principles, colour, type, layout, motion, the typing and learning screens                           |
| [`source/tokens.json`](source/tokens.json)   | All tokens                                                                                          |
| [`source/components/`](source/components/)   | Guidelines per component, types, reference CSS and JS                                               |
| [`source/assets/`](source/assets/)           | Logo, favicon and the `geometry` cat (ADR 031); all rights reserved, see [BRAND.md](../../BRAND.md) |
| [`source/decisions.md`](source/decisions.md) | How each design question was resolved; v10 decisions under "After ADR 058"                          |

`source/` is a verbatim export of the [private artifact](https://claude.ai/artifact/22bxWBXuofNxqfnPzuvej1), version 10 with decisions 93–96 from the review of the P3 build ([ADR 062](../adr/062-design-review-of-the-p3-build.md)) 97–98 from the redraw of the cat and logo ([ADR 065](../adr/065-cleaner-cat-and-logo-drawings.md)) 99, the `/about` page ([ADR 066](../adr/066-about-page-design.md)) 100–112, the `/stats` screen ([ADR 076](../adr/076-stats-screen-redesign.md)) and 113, its chart checked against the code. It keeps the export's folder names and is excluded from Prettier. It is not edited by hand: change the artifact and export again. Live previews of components and screens stay in the artifact, as do the archived `line` and `silhouette` cats and the font files.

## Moving a component into the app

`bundle.js` and `bundle.css` are a React reference, not a dependency. Components are rewritten in Preact in `shared/ui` under the rules in [Frontend](../spec/frontend.md).

- **Test stream.** The reference controller marks characters, while the engine reports tokens: きゃ and a merged っち are one token. The app maps tokens to character ranges. The engine, not the controller, decides what is a skip token.
- **Learning task.** `KanaTask` and its `createTaskController` draw one task of a learning session; they are not built on `TestArea` (ADR 059).
- **Fonts.** Fonts are subset by the project's own build ([ADR 032](../adr/032-font-weights-for-the-design-system.md), [ADR 034](../adr/034-design-tokens-and-font-build.md)); the font files in the artifact are copies of those subsets. The glyphs under "Glyphs to add to subsets" in [`source/decisions.md`](source/decisions.md) are added in P3. `！` and `？` are listed as skip characters but are not in the Noto subset; settle this with the content in P4.
- **Names.** The design's names are the target: the code's `Toggle` becomes `Switch` and the `ghost` button variant becomes `text` in P3 (ADR 059).
- **Identifiers.** Row and strictness values are the engine's (`RowId`, `learner`, `ime`). `index.d.ts` documents them but is not imported.
- **Strings.** Russian and English labels in the reference are examples. All strings come from `shared/i18n`.
