# Nav

The top bar: the mark and "nekotype" on the left; `learn · type · stats · settings` / `обучение · набор · статистика · настройки`; on the right the `en / ru` switch and `sign in` / `войти`. `about` / `о проекте` lives in the `Footer`.

- `learn` leads to `/`, `type` to `/type` (ADR 058). `/` is active for `learn`.
- Links `ui-label`: `fur-dim` → `fur`; the active one is `fur` + `aria-current="page"`.
- **Language switch:** a segmented control with lower-case `en` / `ru`; the selected one is `fur` with the `eye` underline. The code's upper case `EN / RU` is not adopted (lower-case rule).
- **No line under the bar** — it is separated by spacing (the code's line is not adopted).
- `sign in` leads to `/settings`. Hidden on preview environments and after sign-in (`loginLabel={null}`).

**During a typing test (ADR 041, 055)** — together with the config bar, the footer and the notice slot above the stream:
- fades over `dur-fade`, then gets `visibility: hidden` and leaves the focus order (`inert`). Its space is kept; nothing shifts;
- returns when the mouse moves more than 8px and stays until the next key; `Tab` and `Shift` do not hide it again; any other key hides it;
- every keystroke resets the mouse's reference point.

**During a learning session** it is not rendered at all; the session line carries `leave session` (decisions 48, 59). It returns on the session summary.

**Below 640px:** the mark, `en / ru` and `sign in` in the first row; the links in the second, stretched across. Russian `обучение · набор · статистика · настройки` fits at 360 (checked on every 360 screen). Touch targets from `touch-min`.
