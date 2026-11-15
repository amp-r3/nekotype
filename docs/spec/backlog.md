# Post-MVP backlog

| Version | Item                                      | Condition or dependency                                                                                                                                           |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.1    | Russian translations of words and phrases | Coverage report from P4 (open item O3)                                                                                                                            |
| v1.1    | Kanji with furigana as a display option   | Font loaded in `unicode-range` chunks to stay within the font budget                                                                                              |
| v1.1    | Custom word sets                          | Import of a kana word list                                                                                                                                        |
| v1.1    | Hepburn-only mode (D9)                    | Implemented as a filter on relaxed mode                                                                                                                           |
| v1.1    | Reset progress for signed-in users        | Needs a server-side reset; sync only adds deltas (A33). Includes "Reset learning", which keeps typing statistics (design decision 91, A45)                        |
| v1.1    | Learning of っ, ー and small kana         | っ and ー have no `KanaKey` today                                                                                                                                 |
| v1.2    | Offline PWA, themes                       | —                                                                                                                                                                 |
| v1.2    | Audio for words and phrases               | Recordings or speech synthesis; synthesised voice quality differs across platforms (A44)                                                                          |
| v1.2    | Decomposed yōon `kilya`/`kixya` (D6)      | —                                                                                                                                                                 |
| v2      | Kanji learning with JLPT presets N5–N1    | JLPT has published no official kanji or vocabulary lists since 2010: a source for the presets has to be chosen and pinned, as Waller's lists were for words (A20) |
| v2      | Vocabulary SRS (FSRS)                     | —                                                                                                                                                                 |
| v2      | Leaderboards                              | Server-side result verification with the engine running in Pages Functions                                                                                        |
| v2      | Content admin panel                       | Moderation of content reports                                                                                                                                     |
| v3      | Grammar                                   | —                                                                                                                                                                 |
