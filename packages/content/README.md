# @nekotype/content

The content pipeline: reads the pinned source files and generates the words and phrases the typing screen loads. It is a build tool: its dependencies are devDependencies and never reach the web bundle; `apps/web` does not import it. The specification is [docs/spec/content.md](../../docs/spec/content.md).

## Requirements

- Node ≥ 24, pnpm ≥ 10.
- `bzip2` on the `PATH` (the Tatoeba exports are `.bz2`; they are decompressed by `bzip2 -dc`, no dependency). The build runs by hand on Linux and never in CI.

## Sources

`sources.json` pins every input file: upstream URL, mirror URL, sha256, size, retrieval date and licence. The upstream exports are "latest only", so the files are mirrored unchanged as assets of a GitHub release (`release` in `sources.json`) and every build reads the mirror and checks the hash ([ADR 068](../../docs/adr/068-content-sources-mirrored-as-release-assets.md)).

```bash
pnpm --filter @nekotype/content run fetch            # download from the mirror into .cache/, verify sha256
pnpm --filter @nekotype/content run fetch --upstream # refresh the mirror (see below)
```

Refreshing the mirror: `fetch --upstream` downloads every file from its upstream URL into `.cache/upstream/`, gzips `users_sentences.csv`, and prints the sha256 and size of each file and the `gh release create` command. If `ftp.edrdg.org` does not answer, download `JMdict.gz` by hand and put it at `.cache/upstream/JMdict.gz`; the script continues with it. Create a release with a new date, upload the files, then update `release`, `mirror`, `sha256`, `bytes` and `retrieved` in `sources.json`.

## Generate

```bash
pnpm --filter @nekotype/content run generate   # word and phrase steps on .cache/; prints the counts
```

The current `generate` runs the word and phrase steps: it reads the pinned files from `.cache/` (run `fetch` first) and writes `words-report.json`, `ru-coverage.json`, `words.json`, `phrases-report.json`, `phrases.json` and `credits.json` into `.cache/build/`, and `audit-sample.md` into the package folder (commit it: the maintainer checks it in review). It fails when compile failures exceed 5% of the selected words, or of the phrases that passed the filters, and when fewer than 300 phrases qualify. The phrase step takes about 40 s and about 1 GB of memory (kuromoji, ratings). The chunks and the manifest are added in the following PRs.

The phrase step reads the sentences with kuromoji (IPADIC, shipped in the package) and filters them as [content.md](../../docs/spec/content.md) "Phrases" says (`src/phrases.ts`); `src/tatoeba/load.ts` streams the exports into indexes.

It is not named `build` on purpose: the root `pnpm run build` runs every package's `build`, and CI has no `.cache/`.

## Source formats

All Tatoeba exports are UTF-8, tab-separated, without a header, and write a missing value as `\N`. Counts are from the files retrieved on 2026-11-11.

| File                                                    | Columns                                                    | Notes                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `jpn_sentences_detailed.tsv.bz2` (≈ 249 k rows)         | `id, lang, text, username, date_added, date_modified`      | `username` can be `\N`; `date_added` can be `\N` or `0000-00-00 00:00:00`             |
| `eng_sentences_detailed.tsv.bz2` (≈ 2.04 M rows)        | the same                                                   |                                                                                       |
| `jpn-eng_links.tsv.bz2` (≈ 281 k rows)                  | `jpn_id, eng_id`                                           | one Japanese sentence can have several translations                                   |
| `jpn_transcriptions.tsv.bz2` (≈ 249 k rows)             | `sentence_id, lang, script, username, transcription`       | `lang` is `jpn`, `script` is `Hrkt`; a row with a username is by a contributor        |
| `users_sentences.csv.gz` (≈ 1.80 M rows; mirrored gzip) | `username, sentence_id, rating, date_added, date_modified` | tab-separated despite the name; `rating` is `-1`, `0` or `1`; ≈ 99 MB unpacked        |
| `n5.csv`, `n4.csv` (684 and 640 rows plus a header)     | `jmdict_seq, kana, kanji, waller_definition`               | comma-separated, RFC 4180 quoting (`"to open, to become open"`); `kanji` can be empty |

The JLPT CSV has one row per (entry, reading) pair: the same `jmdict_seq` can occur twice with two readings (1004500 こちら / こっち).

### Transcription markup

A transcription is plain kana and punctuation with furigana groups: `[kanji|reading]` or `[kanji|r1|r2|…]`. The readings after the first `|` belong to single kanji and are concatenated: `[場所|ば|しょ]` is ばしょ, `[0点|れい|てん]` is れいてん. The base can be Latin letters (`[Twitter|ツイッター]`). A symbol Tatoeba does not read is a group with an empty reading (`[―|]`, `[-|]`, `[㌔|]`): such a sentence is unreadable and is excluded. `parseTranscription` returns `null` for an empty reading, an unbalanced or nested bracket and a `|` outside a group. Plain rows without brackets exist (`ごめん、ぼーっとしてた。`).

### JMdict

The original multilingual XML. The tags (`re_inf`, `pos`, `misc`, …) are written as entities declared in the internal DTD subset (`<re_inf>&sk;</re_inf>`); the parser reads each entity as its own name (`sk`). Glosses without `xml:lang` are English; `xml:lang="rus"` marks Russian ones. A sense can be restricted to some readings (`stagr`) and a reading to some kanji (`re_restr`). Many senses carry only glosses of other languages and no English gloss.
