# ADR 069: Word Readings and Meanings

- **Status:** In force.
- **Context:** [content.md](../spec/content.md) took "the first non-search-only kana reading and the first 1–3 English senses" of a JMdict entry. The JLPT lists (N5, N4) give one row per (entry, reading) pair with the reading the level list means (`こちら` and `こっち` of the same entry), so the first reading of the entry can be the wrong one. Many JMdict senses apply to some readings only (`stagr`), and many have glosses in other languages only.
- **Decision:**
  1. The reading of an item is the CSV `kana` column. It MUST be a `reb` of the entry that is not search-only; otherwise the row is excluded. Mixed-script readings are excluded.
  2. The meaning is the first English gloss of each of the first 3 senses that have an English gloss and apply to the reading; senses are dropped from the end while the text is longer than 60 characters, and the first one stays.
  3. Homonyms (same script and reading) merge into one item `w:<script>:<reading>`; the meaning takes the first sense's first gloss of up to 3 entries in item order.
  4. The fallback selection by priority tags is implemented and tested but used only when `sources.json` has no JLPT mapping.
  5. JMdict is parsed with `sax` (devDependency, never in the web bundle); entities are read as their own names.
- **Justification:** The level list, not JMdict's reading order, says which reading the learner meets. The 60-character limit keeps the translation line on one row. Parsing the original XML keeps every priority tag ([content.md](../spec/content.md), "Sources").
- **Consequences:** A word's meaning can repeat a gloss (`elevator; elevator`) when two senses start with the same one; the pipeline does not deduplicate. The build reports excluded rows by reason and the compile failures; the Russian coverage is reported, not shipped.
