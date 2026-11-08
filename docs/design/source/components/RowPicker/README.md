Not used in the MVP (ADR 058).

# RowPicker

Row selection for content "kana" (removed by ADR 058 together with kana tests). Opens in a `Dialog` from `ModePanel`. Values are the engine's `RowId`s.

- Groups: basic (vowels … w_n), voiced (g … p), combinations (ky … py). Extended katakana rows (ext_fa, ext_va, ext_wi, ext_ti, ext_che) are shown only with script `katakana` or `both`: for hiragana they yield no kana.
- When the script switches to hiragana, selected extended rows are not removed from the value but are neither shown nor counted: in the same way `personalBestKey` takes only the rows that yield kana for the script (`metrics.md`).
- A group has `all` and `none` actions. A row is a checkbox (`role="checkbox"`): a 12px square filled `eye` when on; kana in `jp-body` (in katakana for `both`); the `RowId` in `mono-small`.
- Nothing selected → `Notice` "the test will use the base rows"; an empty list is replaced with the defaults (`storage-sync.md`).
- A long list scrolls inside the dialog body; the actions stay in place.
