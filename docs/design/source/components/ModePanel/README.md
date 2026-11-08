# ModePanel

The config bar of the typing test on `/type` (ADR 058). Six groups:

| group | options (en / ru) | value |
| --- | --- | --- |
| script | `hiragana / katakana / both` — `хирагана / катакана / обе` | `hiragana` · `katakana` · `both` |
| content | `words / phrases` — `слова / фразы` | `words` · `phrases` |
| strictness | `relaxed / strict IME` — `мягкая / строгая IME` | `learner` · `ime` |
| test | `time / count / zen` — `время / количество / zen` | `time` · `count` · `zen` |
| length | time `15 / 30 / 60 / 120` s, count `10 / 25 / 50 / 100`; no group in zen | number, `mono-romaji` |
| weak kana | `weak kana` / `слабые каны` — an `aria-pressed` toggle in segment style | `weakFocus` |

- Content `kana`, the rows button and `RowPicker` are gone.
- **Desktop: two rows stay** (decision 66): "script | content | strictness" — what you type; "test | length | weak kana" — how the test runs. Six groups in one row need ≈ 1100px in English and more in Russian, so they would wrap at random; two fixed rows never put a divider at the start of a row. Dividers — `line`. On desktop the group labels are for screen readers only.
- **Below 640px** the panel is collapsed to one line — the mode line, as above KPM on results (`modeLine`: `words · hiragana · relaxed · 30 s`, `+ · weak kana` when on). The line is a button (`aria-expanded`, ≥ `touch-min`, a `fur-dim` chevron drawn with two hair lines, turned by `transform`); a tap opens the full panel under it: each group on its own line with a `ui-caption` label (`weak kana` needs none). `compact`, `open` / `defaultOpen`, `onToggle` control it; both states are drawn on `ScreenSetupMobile` and in the preview.
- **Strictness here is the typing strictness** — a setting separate from `learning strictness` / `строгость в обучении` in `/settings` (decision 87); the group keeps the short label `strictness` / `строгость` because it sits in the typing config.
- **During a test** (`hidden`) the bar behaves like `Nav`: fades over `dur-fade`, then `visibility: hidden` + `inert`, space kept (ADR 041, 055).
