# Char

A legend of character states for documentation. The stream itself draws characters through the `TestArea` controller.

| state | class | colour |
| --- | --- | --- |
| not typed | `is-untyped` | `untyped` (≥ 24px only) |
| correct | `is-correct` | `fur` |
| error | `is-miss` | `miss` + 2px `miss-dim` underline |
| current | — | `eye` caret on the left |
| skip token passed | `is-skip is-done` | `fur-dim` |
