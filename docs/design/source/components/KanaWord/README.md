# KanaWord

The stage of a word, a run and a rule's example inside `KanaTask kind="word"` or `"introduction"` (decisions 163, 166, 173), and `KanaParts`, the stage of a build and a transfer's introduction (decisions 169, 170). Static markup: in the app the task's controller writes the caret, the buffer and the classes on a keystroke; a keystroke renders nothing.

**KanaWord** — `tokens` (the kana by reading token; a merged っX is one token: `も`, `っと`), `cur`, `buffer`, `marks` (per token: `wrong`, `rule`, `eye`), `done`, `reading`, `meaning`, `run`, `ghost` (`{ text, marks }`), `note`.

- **Size** by length: up to 4 kana `jp-solo`, up to 7 `jp-solo-sm`, longer `jp-test-sm`; below 640px up to 5 `jp-solo-sm`, then `jp-test-sm`. A run: `jp-test-sm` in one line, 22px wrapping below 640px.
- **Typing:** the `eye` caret before the current token, the buffer under it (`mono-romaji`, `eye`; `mono-small` below 640px); typed tokens `fur-dim`, the rest `fur` — the question is what is left. The line under the word is reserved: nothing moves when it fills.
- **Answered:** the word `fur`; the reading in the reserved line (`mono-romaji`, `fur-dim`); the meaning under it (`ui-body`, `fur`, English in both languages, at most 40 characters a line).
- **Marks:** `wrong` — `miss` with a `miss-dim` underline; `rule` — the first character of the token (the っ of っと) the same way; `eye` — the rule's mark of an example.
- **A rule's example:** the ghost hint (`mono-counter`, `untyped`) with the letters the mark gives in `eye` (`eye-bright` once typed), and `note` — the rule in one line (`ui-body`, `fur-dim`; 14px below 640px).

**KanaParts** — `items`: `{ kana, tone }` (`dim` a part, `q` a part to read, `new` the kana being introduced), `{ op }` (`+`, `→` in `mono-counter`, `fur-dim`), `{ node }` (the origin kanji with `from 加` / `из 加` under it); `typing` and `buffer` put the caret before the first kana; `ghost` (an introduction) or `reading` (a build once answered).
