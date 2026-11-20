# ADR 015: Merging Widgets Layer into `pages/trainer/ui/`

- **Context:** `steiger` enforces `fsd/insignificant-slice` requiring slices to have more than one consumer across the codebase. Private components previously placed in `widgets/` were consumed solely by `pages/trainer`.
- **Decision:** In accordance with the prompt guidance ("If it flags a slice with one consumer, MERGE it into that consumer; do not disable the rule"), the widgets (`top-bar`, `config-bar`, `test-stage`, `results-panel`, `rows-dialog`, `live-stats-strip`, `speed-chart`, `weakest-kana-list`) were merged into `pages/trainer/ui/` as page-internal UI components.
- **Extraction Seam:** When a second page (such as a separate stats history page, study review page, or custom drill page) is introduced that requires reusing these components, they should be extracted back to `widgets/` or `features/`.
- **Status:** Amended by [ADR 093](093-learning-only-words-in-learning.md): `pages/trainer` and its components left in P6; the rule (a slice with one consumer is merged into that consumer) stands.
