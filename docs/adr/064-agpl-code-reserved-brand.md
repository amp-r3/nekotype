# ADR 064: Code Under AGPL-3.0-only, Brand Reserved, Fonts Under OFL-1.1

- **Status:** In force. Replaces the MIT licence the repository had from the start.
- **Context:** The code was under MIT, which lets anyone take it into a closed product, including a hosted one, and says nothing about the name, the logo or the cat: under MIT they were licensed with the code. The project is to stay open source for the community, but a hosted copy must not be able to close its source, and a fork must not look like Nekotype. All commits so far are by amp-r3, so the licence can be changed without anyone else's consent.
- **Decision:**
  - The source code, tests, tooling and documentation are under the **GNU AGPL v3.0 only** (`AGPL-3.0-only`). `LICENSE` holds the verbatim licence text; every `package.json` says `AGPL-3.0-only`.
  - [NOTICE.md](../../NOTICE.md) adds terms allowed by section 7 of the AGPL: the copyright notice and an attribution "Based on Nekotype by amp-r3" with a link (7(b)), modified versions marked as different and not presented as the original (7(c)), and no rights to the name, logos and cat (7(e)).
  - The **brand** — the name "Nekotype", the logos, wordmark, favicon, banners and every drawing of the cat, including its geometry in `shared/ui/cat.tsx` and in the design bundle — is **all rights reserved** ([BRAND.md](../../BRAND.md)). A public fork or deployment must replace it.
  - The **fonts** keep the **SIL Open Font License 1.1**, with the `OFL-*.txt` files next to them.
  - `NOTICE.md` maps every path to its terms; no per-file licence headers, except a comment in `cat.tsx`, where brand geometry sits inside AGPL code.
- **Justification:**
  - AGPL section 13 closes the network loophole of the GPL: a modified version used over a network must offer its source, which is the case of a web app.
  - `-only` rather than `-or-later`: the author decides on a future version of the licence instead of the FSF.
  - Keeping `LICENSE` verbatim lets GitHub and package tools detect the licence; the extra terms live in `NOTICE.md`.
  - Copyright in the drawings and the name as a mark are separate from the copyright in the code, so the brand can stay reserved while the code is free; section 7(e) states this inside the licence.
- **Consequences:**
  - A contribution is accepted under AGPL-3.0-only; a contribution to a brand file also grants amp-r3 a licence to use it as part of the brand (`NOTICE.md`).
  - Section 5(d) only binds a modified version to show legal notices if the original shows them. The `/about` page (P4, [Content](../spec/content.md)) therefore states the licences and links to the source code.
  - New brand files and new fonts are added to the lists in `NOTICE.md`.
