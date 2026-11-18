# Input

A form field: nickname, deletion confirmation, a custom word. Typing-test input is not a field: `TestArea` draws it.

- `bg-raised`, no border, `radius-sm`, `control-h` height; browser caret `eye`.
- In a `Dialog` (decision 127): the full width of the body and filled with `bg`, since the dialog itself is `bg-raised`. The same for `Select` and `Textarea`.
- Placeholder — `fur-dim` (Q25): `untyped` is allowed only from 24px.
- Error — a `miss` underline at the bottom and `miss` text. Disabled — no fill, `line` border.
