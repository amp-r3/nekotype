# ADR 065: Cleaner Cat and Logo Drawings, a Smiling `content` Cat and a Reserved `grumpy` Cat

- **Status:** In force. Amends [ADR 059](059-design-system-v10.md).
- **Context:** The maintainer asked for cleaner favicon, logo and cat drawings while keeping the `geometry` style, its shapes and its three colours. The drawings had visible flaws:
  - the ears were separate sharp triangles that met the head in sharp notches;
  - the sitting body and its tail were two shapes edge to edge, so a hairline of the background could show at the seam;
  - the sleeping cat's tail lay wholly inside the body and was never seen;
  - the favicon's head touched the bottom edge of its square;
  - the wordmark's caret was 1.5 px wide at the size the app shows the lockup, so it blurred.

  In review the maintainer also found that the `content` cat's eyes (lower half-discs, flat side up) read as rolled eyes, not as a personal best. The design export may not be edited by hand ([Design system](../design/README.md)), so the change was made in the design artifact (decisions 97–98 in `docs/design/source/decisions.md`) and exported again.

- **Decision:**
  1. **Cleaner outlines (design 97).** The shapes, sizes and colours stay; only the outlines change.
     - The head and both ears are one outline: ear tips rounded (r 1.6 at the mark's scale), the joints of ear and head filleted (r 2.2).
     - The sitting body and its tail are one outline: a fillet where the tail leaves the back, small rounds on the tail's end and the feet.
     - The invisible tail of the sleeping cat is removed; the picture does not change.
     - The favicon's head is centred in its square, with eyes of r 3.8 so that they read at 16 px.
     - The wordmark's caret is the interface caret: `stroke-mark` wide, fully rounded, on whole pixels at the lockup's half size in the app. Glyph coordinates are rounded to 0.01.
  2. **`content` smiles (design 98).** The `content` cat has closed, smiling eyes: two `eye` arcs. It keeps its place: typing results, on a personal best only.
  3. **`grumpy` is reserved (design 98).** The old `content` picture becomes a new mood, `grumpy` (`cat-geometry-grumpy.svg`, `Cat` `mood="grumpy"`), in `geometry` only. It has no place in the product yet. It is kept for an error or a failure screen, which a later decision and a spec change will choose.
- **Justification:**
  - One outline per shape removes the seams and the sharp notches. Rounding stays small, so the drawing remains the flat `geometry` cat at 16 px.
  - More detail (nose, whiskers, fur) and more colours were considered. The maintainer chose cleaner outlines only.
  - A sleeping cat with a visible tail was drawn and rejected in favour of the familiar picture.
  - Of two smiling-eye variants (the half-discs turned over, or arcs), the arcs read as pleasure at 48 px.
  - `grumpy` is kept, not deleted, so that the next error screen has a picture ready.
- **Consequences:**
  - The `docs/design/source/` export is updated:
    - the assets: `favicon.svg`, `lockup.svg`, `mark-geometry.svg`, `wordmark.svg`, the three product cats and the new `cat-geometry-grumpy.svg`;
    - `decisions.md` gets entries 97–98;
    - the README, the `Cat` component README and the asset READMEs describe `grumpy`;
    - `bundle.js` gets the new geometry and an `eyeline` role, and falls back to `neutral` for a mood a style does not draw;
    - `index.d.ts` adds `grumpy` to `CatMood`.
  - The app copies follow: `apps/web/public/favicon.svg`, `apps/web/src/assets/logo/lockup.svg` and the sleeping cat in `apps/web/src/shared/ui/cat.tsx`. `docs/design/readme-banner.svg` gets the new lockup.
  - The app does not draw `content` yet: personal bests come with the typing results. When they do, it uses the new eyes.
  - The spec does not change: the cat's places stay as in [Metrics](../spec/metrics.md) and the design README.
