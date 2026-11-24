# ADR 111: `/progress` Replaces `/stats` With a 301, and the Kana Details Are a Dialog of a Lazy Feature Slice

- **Status:** In force.
- **Context:**
  - The P8 design ([ADR 108](108-p8-design-export.md), decisions 146 and 147) moves the kana chart and the statistics to "Progress" and replaces the chart's inline panel with a dialog that three screens open: the chart, the home's "since the last session" and the session summary ([p8-plan.md](../../p8-plan.md), D11 and D12).
  - `/stats` has been a screen since P3; a bookmark or a stale copy of `index.html` at the edge (P6 saw one answer a removed path for up to 7 days) must not show a screen that no longer exists. The dev server and `vite preview` ignore `_redirects`.
  - `pages` do not import each other, so a dialog that `pages/learn` and `pages/progress` both open cannot live in either. `steiger` accepts a slice with two consumers (ADR 015).
- **Decision:**
  1. **Routes.** `ROUTE_PATHS` is `/`, `/progress`, `/settings`, `/about`. `ROUTE_REDIRECTS` (`app/route-paths.ts`) maps `/stats` to `/progress`. `public/_redirects` rewrites the screens with status 200 and redirects `/stats` and `/stats/` with status 301, and `redirects.test.ts` keeps both lists equal to the code. The smoke test of a deployment expects the 301. `startRouter(redirects)` replaces a retired path with its target (`replaceState`) on start and on `popstate`; the redirects are passed in from `app`, because `shared` cannot import it.
  2. **The page.** `pages/stats` becomes `pages/progress`, the dictionary part `stats` becomes `progress`, and `page.stats` and `nav.stats` become `page.progress` and `nav.progress`. The title has one track switch, local to the page: it starts at `learn.track` and never writes it. The answer-time chart follows it, and a track without answers says so. The navigation reads `learn · progress · settings`, the open link underlined in `eye`.
  3. **The dialog.** `features/kana-details` holds a signal with the open key, `openKanaDetails` (a no-op while `immersive`), a host in the initial chunk and the dialog and its dictionary part `details` as a lazy chunk, which are idle-prefetched. The host keeps the dialog mounted after the first load and drives it by `open`, so closing by `✕` or the backdrop gives the focus back as `Esc` does. `Dialog`'s title takes nodes (the kana and its romaji), and `KanaChart` calls `onOpen(cell)` after focusing the cell, so the focus returns to it even where a click does not focus a button.
  4. **The budget gate.** `check-budget.mjs` fails when the dialog's chunk is missing from the manifest, is in the initial chunk or is a static import of a route chunk, as it does for the sync engine.
- **Justification:** a 301 fixes the address for bookmarks and search, the router covers what the edge cannot, and one feature slice is the smallest place that three screens can share without importing each other. A lazy dialog keeps the chart's details out of the first load, which P9–P14 need.
- **Rejected alternatives:**
  - _A 200 rewrite of `/stats` with the router showing `/progress`:_ the address would stay wrong in bookmarks.
  - _Unmounting the dialog on close:_ `✕` and the backdrop would not fire the native `close` event, and the focus would not return.
  - _The dialog in `pages/learn` with `pages/progress` importing it:_ pages importing each other.
- **Consequences:**
  - [frontend.md](../spec/frontend.md), [metrics.md](../spec/metrics.md), [architecture.md](../spec/architecture.md) and [quality.md](../spec/quality.md) describe the routes, the page, the dialog and the gate; [architecture/pages.md](../architecture/pages.md) and [layout.md](../architecture/layout.md) describe the code.
  - Until P8 PR 4 takes the chart off `/`, `pages/learn` and `pages/progress` each keep a copy of the chart's rows and strings (`lib/chart.ts`); PR 4 deletes the one in `pages/learn`.
