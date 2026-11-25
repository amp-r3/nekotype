# Notice

One status line. Used for: the revealed romaji, the next step after a wrong option, keyboard layout and IME, a task started over, loading and load errors, storage unavailable, sync status, a sign-in that did not finish, a failed request inside a dialog.

- `ui-label`, `fur-dim`, no fill and no icons, `role="status"`.
- `reserve` — the space is held even when there is no notice: nothing shifts when one appears.
- `action` — one link or a `secondary` `sm` button at the end of the line (`retry`, `sign in again`).

**States**

| state | look | example (en / ru) |
| --- | --- | --- |
| default | `fur-dim` | `switch your keyboard layout to English` / `переключите раскладку на английскую` |
| `reveal` | `mono-romaji`; `lead` in `fur-dim`, romaji in `eye` | `revealed: kotoba` / `ответ: kotoba` |
| `loading` | `fur-dim`, static text, no animation | `loading your progress…` / `загрузка прогресса…`, `loading…` / `загрузка…` |
| `tone="miss"` + retry | `miss` text, `secondary` retry button | `failed to load. check the connection and try again.` / `не удалось загрузить. проверьте соединение.` |

- The revealed romaji is `eye`: it is the answer for the current position, the same family as the romaji buffer, and appears only when the user presses `Esc`. It shares the task's notice line with the layout and IME notices; one at a time.
- `tone="miss"` — only for an error or a state that blocks an action (load failed, sync blocked, sign-in failed, a request that failed).
- Loading text does not pulse: the ellipsis says "in progress"; motion would be decoration (see decisions.md).
- In a learning task (`KanaTask`) the notice line sits under the task, reserved, `control-h-sm` high. One at a time: `revealed: nu` / `ответ: nu` (`reveal`, after `Esc` or the `show the romaji` button in recall); `Kbd enter` + `next` / `дальше` after a wrong option (a `next` text button under `pointer: coarse`); layout and IME notices; `the task started over: the tab was hidden` / `задание заново: вкладка была скрыта`.
- The session summary is a lazy chunk: `loading…` / `загрузка…`, or `failed to load. check the connection and try again.` with `retry`; `continue` and `Enter` work in both states.
- `/progress` (decision 130): `loading…` or the load error with `retry` under the title, in place of the blocks; `no answers in this period` / `за этот период ответов нет` with the action `show all time` / `показать всё время` (default tone: nothing is blocked).
- `/settings`, sync status (default tone unless noted): `synced` / `синхронизировано`; `pending` / `ждёт отправки`; `offline` / `нет сети`; `session expired` / `сессия истекла` with the action `sign in again` / `войти снова`; `tone="miss"` — `sync is paused until the next app update` / `синхронизация приостановлена до обновления приложения`.
- `/`, after a sign-in that did not finish (decision 119), in the screen's reserved line until the next navigation: `sign-in was cancelled` / `вход отменён` (default tone); `tone="miss"` — `sign-in failed. try again in settings.` / `вход не удался. повторите в настройках.` No action. The line shows one notice, in this order: the load error, storage unavailable, the sign-in notice.
- Inside a dialog (decisions 116, 122, 127): one reserved line in the actions row, left of the buttons (`Dialog` `note`), two lines high; its own row above the buttons below 640px. Delete account — `failed to delete. check the connection and try again.` / `не удалось удалить. проверьте соединение.`
- Lazy chunks (the session summary — ADR 057) and lazy routes (`/progress`, `/settings`, `/about`) show the same loading and error in the chunk's place. The primary button (`continue`) and `Enter` work in both states.
