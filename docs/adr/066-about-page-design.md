# ADR 066: The `/about` Page: Sources, Terms and Paged Phrase Credits

- **Status:** In force. Amends [ADR 059](059-design-system-v10.md).
- **Context:** [Content pipeline](../spec/content.md) ("Attribution and reporting") fixes what `/about` says: the four content sources and their licences, the terms of Nekotype itself as in [NOTICE.md](../../NOTICE.md), and a generated list of every phrase used in typing (300–500) with its Tatoeba sentence id, link and author usernames. P6 adds a kana audio credit and P7 a description of the data stored on the device. The design system had only a placeholder `ScreenAbout` with invented copy. The design export may not be edited by hand ([Design system](../design/README.md)), so the screen was drawn in the design artifact (decision 99 in `docs/design/source/decisions.md`) and exported again.
- **Decision:**
  1. **Order.** Sources and licences · kana audio (P6) · Nekotype's terms · data on this device (P7) · phrase authors. The long list is last. The P6 and P7 sections are not rendered before their phase.
  2. **Terms as rows.** Each source or term is one row: name and use on the left, the licence as a link on the right, the holder under them, rows separated by `line`. The AGPL row carries the link to the source code (section 13). No new colour, token or component.
  3. **Phrase credits in pages of 25**, the same number at every width, with `Pagination`, in ascending sentence id. On a desktop it is a five-column table (phrase, sentence, author, translation, transcription); in a container of 480 px or less each row is a block with labelled lines. A transcription without an author shows `machine · kuromoji` / `машинная · kuromoji`.
  4. **Loading.** The list is one lazy content chunk. While it loads, or when it fails, only its place shows `loading…` or the error with `retry`; the other sections are in the route chunk and stay. Page changes need no loading state.
  5. **No cat** on the page.
- **Justification:**
  - One long list was rejected: 412 rows are about 17 000 px on a desktop and 55 000 px on a phone, and put 412 link stops before the footer for a keyboard user. "Show all" has the same cost once opened.
  - The same page size at every width keeps the reader's page when a phone is rotated. 25 rows keep a page short and its tab stops at 25.
  - The cost is that find-in-page sees only the current page. Sorting by sentence id lets a reader find the id that the typing screen's "Source" link shows.
  - The cat marks the learner's states (empty, personal best, 404); this page is reference and legal text.
- **Consequences:**
  - The `docs/design/source/` export is updated: `README.md` (new section "About", lazy loading, the Cat section), `decisions.md` (99), the `Pagination` and `Notice` READMEs. The previews `ScreenAbout` and `ScreenAboutMobile` stay in the artifact.
  - [Content pipeline](../spec/content.md) and [Frontend](../spec/frontend.md) describe the paged list.
  - P4 builds the page: the route chunk stays within the 25 KB lazy route budget; the list's data counts against the content chunk budget. All strings come from `shared/i18n`.
  - Open for P4: Waller's lists state CC BY without a version, so `CC BY` is shown without a link until the content pipeline settles it.
