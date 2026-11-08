Not used in the MVP (ADR 058).

# VerticalLabel

The vertical mode label (`writing-mode: vertical-rl`) that stood next to KPM on typing results in v9 (`ことば・３０`).

**Why it is out (decision 85):** mode labels come from i18n only, without Japanese — the mode line above KPM (`words · hiragana · relaxed · 60 s`, `phrases · 25` / `фразы · 25`, `words · zen` / `слова · zen`). A Japanese label would need more glyphs in the subsets and does not read for someone who is only learning kana.

- Kept for the record: kana, `・` and `０`–`９` only; `ariaLabel` required.
- The fullwidth digits `０`–`９` in the Noto subset were added for this label (Q15) and have no other use now — see the open questions.
