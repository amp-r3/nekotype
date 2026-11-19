# Nav

The top bar: the mark and "nekotype" on the left; `learn · stats · settings` / `обучение · статистика · настройки` (decision 129); on the right the `en / ru` switch and `sign in` / `войти`. `about` / `о проекте` lives in the `Footer`.

- `learn` leads to `/` (ADR 058), `stats` to `/stats`, `settings` to `/settings`. `/` is active for `learn`.
- Links `ui-label`: `fur-dim` → `fur`; the active one is `fur` + `aria-current="page"`.
- **Language switch:** a segmented control with lower-case `en` / `ru`; the selected one is `fur` with the `eye` underline. The code's upper case `EN / RU` is not adopted (lower-case rule).
- **No line under the bar** — it is separated by spacing (the code's line is not adopted).
- `sign in` leads to `/settings`. Hidden on preview environments and after sign-in (`loginLabel={null}`).
- **Session expired** (decision 120): the link returns as `sign in again` / `войти снова` on every screen and leads to `/settings`, where the sync status has the `sign in again` button. Same link style, not `miss`: the app keeps working locally. It goes once the user has signed in again or signed out.

**During a learning session** it is not rendered at all; the session line carries `leave session` (decisions 48, 59). It returns on the session summary.

**Below 640px:** the mark, `en / ru` and `sign in` in the first row; the links in the second, stretched across. Russian `обучение · статистика · настройки` fits at 360, and so does `войти снова` in the first row. Touch targets from `touch-min`.
