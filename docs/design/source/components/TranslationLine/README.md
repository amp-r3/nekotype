# TranslationLine

The line under the stream: translation, the `source` link and the `report a problem` action. Visible during a typing test.

- Translation in `ui-body` / `fur-dim`, actions in `ui-caption`. No fill, no border.
- `source` / `источник` is required for phrases (Tatoeba licence condition) and absent for words. It is attribution, so it shows whenever there is a `sourceHref` — with the translation on or off.
- Offline, reporting is disabled; the reason is in `title`.
- The height is reserved for 2 lines (`min-height: 48px`) so the stream does not jump when the prompt changes.
- Setting off (ADR 056): `show the translation under the text` / `перевод под текстом` on `/settings`, on by default. When it is off, pass `hidden`: the line keeps its two-line height, the translation text and `report a problem` go, and for a phrase `source` stays — the stream does not move.
- Kana inside the translation is drawn in Noto Sans JP through the `ui` family's fallback.
