# ADR 071: Glyph Set from Generated Content

- **Status:** In force.
- **Context:** The Noto Sans JP subset was built from the hand-written words and phrases plus a fixed list that included `・` and the fullwidth digits `０`–`９` for the Japanese mode label of the typing results. Design system v10 removed that label (design decision 85), and the typing screen is about to read generated content, so the subset must follow the generated chunks (open item O8).
- **Decision:**
  1. `apps/web/scripts/subset-fonts.mjs` reads every `words-*.json` and `phrases-*.json` of `apps/web/src/entities/prompt/content/` instead of the hand-written data. The subset is the kana table, every character of those chunks and `ーっッゃゅょャュョァィゥェォ、。`.
  2. `・` and `０`–`９` leave the mandatory list. If a generated item uses one, it is in the subset because the content uses it.
  3. `glyphs.txt` stays committed and `data.test.ts` recomputes it from the same inputs, so a content change without `pnpm --filter @nekotype/web run fonts` fails the test.
- **Justification:** The font carries what the screen can show and nothing else; a glyph nobody renders only costs bytes against the 45 KB font budget.
- **Consequences:** Regenerating the content can change `glyphs.txt` and the Noto file; both are committed with the content. The hand-written data is still read by the typing screen until the cutover (PR 5), and uses only kana from the kana table.
