# OptionCard

An option in a choice (`KanaTask kind="recognition"`): the number key and the kana. Four in one row in recognition and transfer; 2–4 in contrast, 2 in hiragana or katakana?, up to 9 in find the error. Picked with keys `1`–`4` (`1`–`2`, `1`–`9`) — from the number row and from the numeric keypad — with a click or a tap.

- `line-strong` border, `radius-sm`, no fill. Hover — `bg-hover`. Kana in `jp-test-sm`, the key in `Kbd`.
- Desktop: 112px tall, the key top left, the kana at the bottom. Below 640px: 56px tall (≥ `touch-min`), about 76px wide at 360, kana centred — four fit in one row above the on-screen keyboard.
- Under `pointer: coarse` the key numbers are not shown (a tap is the input); on desktop they stay. Keys `1`–`4` still work if a hardware keyboard is attached.
- `aria-label`: `2: ぬ`. The row is a `group` labelled `options` / `варианты`.

**States**

| state | when | look |
| --- | --- | --- |
| `idle` | before the answer | `fur` kana, `line-strong` border |
| `correct` | the chosen option is right | `fur` border and the `eye` mark; held 400ms, then the next task |
| `wrong` | the chosen option is wrong | `miss` with a `miss-dim` underline |
| `reveal` | the right option after a wrong choice | `fur` border and the `eye` mark |
| `idle` + `disabled` | every option not chosen, after the answer | `fur-dim`, `line` border |

- After a wrong choice the next task waits for `Enter`, `Space` or a click; the key line shows `Kbd enter` + `next` / `дальше` (a `next` text button under `pointer: coarse`), the feedback lines under the card say what tells the kana apart (decision 160).

**P9 options** (decisions 168, 171, 172):

- `options.large` (contrast): as many columns as options, 136px tall, the kana 48px; below 640px 56px and 32px.
- `sub` (find the error): the romaji the kana wears under it (`mono-romaji`, `fur-dim`; `mono-small` below 640px); after the answer the odd card shows its wrong romaji struck in `miss` and the right one in `fur`. The card's mark sits under the romaji.
- `text` (hiragana or katakana?): a word in `ui-heading` instead of a kana, 72px tall (56px below 640px).
- In the task's card the options are filled with `bg` (the card is `bg-raised`).
- Keys pressed before the next task appears are ignored (behaviour, not a visual state).
- No green, no praise for a correct answer: correctness reads from the `eye` mark.

**Choosing the options** (engine rule, recorded here so the previews follow it): one right kana and three others — at most one of the kana the user gave instead (め for ぬ), at most one visually similar kana, then kana from the same row (ね, の), then the rest of the track. An option never shares a spelling with the right one: じ / ぢ, ず / づ, お / を never appear together under `relaxed`.
