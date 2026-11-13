# EmptyState

An empty state: cat, title, explanation, one action.

- `geometry` cat, 112px, `sleep` by default.
- The `ui-heading` title states the fact, the `ui-body` / `fur-dim` text says what to do. One `primary` action.

| where | cat | title (en / ru) | text | action |
| --- | --- | --- | --- | --- |
| `/stats`, guest without data | `sleep` | `No statistics yet` / `Статистики пока нет` | `Learn your first kana: answer times, streaks and typing results will appear here.` / `Выучите первые каны: здесь появятся время ответа, серии и результаты набора.` | `to learning` / `к обучению` → `/` |
| 404 | `neutral` | `Page not found` / `Страница не найдена` | `There is no such address.` | `go home` |

A section of `/stats` without data, while the other section has some, is not an `EmptyState` and has no cat (decision 101): a `ui-heading` title, one `ui-body` `fur-dim` line and one `primary` action, left-aligned — `No answers yet` / `Ответов пока нет` → `to learning` / `к обучению`; `No finished tests yet` / `Тестов пока нет` → `to typing` / `к набору`.
