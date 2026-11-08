# WeakKanaList

Mistyped kana on typing results: `mistyped kana` / `каны с ошибками`. Up to 5, most errors first.

| column (en / ru) | content |
| --- | --- |
| `kana` / `кана` | `jp-cell` |
| `romaji` / `ромадзи` | accepted spellings in `mono-small` / `fur-dim`, joined with " · ": `tsu · tu`, `fu · hu`, `nu` (U+00B7 in Mono is on "Glyphs to add to subsets") |
| `errors` / `ошибки` | number of errors, `mono-romaji`, right-aligned |

- No reaction-time column (ADR 058).
- Rows separated by a `line`, no cards. The metrics engine sets the order; the component only cuts to 5.
