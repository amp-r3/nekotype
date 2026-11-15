# Notice

One status line. Used for: the revealed romaji, the next step after a wrong option, keyboard layout and IME, a task started over, loading and load errors, storage unavailable, why a test ended, sync status, a sign-in that did not finish, a failed request inside a dialog.

- `ui-label`, `fur-dim`, no fill and no icons, `role="status"`.
- `reserve` — the space is held even when there is no notice: nothing shifts when one appears.
- `action` — one link or a `secondary` `sm` button at the end of the line (`retry`, `sign in again`).

**States**

| state | look | example (en / ru) |
| --- | --- | --- |
| default | `fur-dim` | `switch your keyboard layout to English` / `переключите раскладку на английскую` |
| `reveal` | `mono-romaji`; `lead` in `fur-dim`, romaji in `eye` | `revealed: kotoba` / `ответ: kotoba` |
| `loading` | `fur-dim`, static text, no animation | `loading vocabulary…` / `загрузка словаря…`, `loading…` / `загрузка…` |
| `tone="miss"` + retry | `miss` text, `secondary` retry button | `failed to load. check the connection and try again.` / `не удалось загрузить. проверьте соединение.` |

- The revealed romaji is `eye`: it is the answer for the current position, the same family as the romaji buffer, and appears only when the user presses `Esc`. It shares one line under the stream with the layout and IME notices; one at a time.
- `tone="miss"` — only for an error or a state that blocks an action (load failed, sync blocked, sign-in failed, a request that failed).
- Loading text does not pulse: the ellipsis says "in progress"; motion would be decoration (see decisions.md).
- In a learning task (`KanaTask`) the notice line sits under the task, reserved, `control-h-sm` high. One at a time: `revealed: nu` / `ответ: nu` (`reveal`, after `Esc` or the `show the romaji` button in recall); `Kbd enter` + `next` / `дальше` after a wrong option (a `next` text button under `pointer: coarse`); layout and IME notices; `the task started over: the tab was hidden` / `задание заново: вкладка была скрыта`.
- The session summary is a lazy chunk: `loading…` / `загрузка…`, or `failed to load. check the connection and try again.` with `retry`; `continue` and `Enter` work in both states.
- Typing results: why a test ended — `test ended: 5 seconds without input` / `тест завершён: 5 секунд без ввода`, `test ended: the tab was hidden` / `тест завершён: вкладка была скрыта`; nothing after a manual zen finish.
- `/stats`: `loading history…` / `загрузка истории…` under the history table; `loading…` or the load error with `retry` in place of a section; `no tests in this selection` / `в этой выборке тестов нет` and `no answers in this period` / `за этот период ответов нет` with the action `show all time` / `показать всё время` (default tone: nothing is blocked).
- `/settings`, sync status (default tone unless noted): `synced` / `синхронизировано`; `pending` / `ждёт отправки`; `offline` / `нет сети`; `session expired` / `сессия истекла` with the action `sign in again` / `войти снова`; `tone="miss"` — `sync is paused until the next app update` / `синхронизация приостановлена до обновления приложения`.
- `/`, after a sign-in that did not finish (decision 119), in the screen's reserved line until the next navigation: `sign-in was cancelled` / `вход отменён` (default tone); `tone="miss"` — `sign-in failed. try again in settings.` / `вход не удался. повторите в настройках.` No action. The line shows one notice, in this order: the load error, storage unavailable, the sign-in notice.
- Inside a dialog (decisions 116, 122): one reserved line above the actions, `control-h-sm` high (two lines below 640px). Report dialog — `offline. reporting is available online only.` / `нет сети. отправка только онлайн.` (default tone); `tone="miss"`: `verification failed. try again.` / `проверка не пройдена. попробуйте ещё раз.`, `failed to send. check the connection and try again.` / `не удалось отправить. проверьте соединение.`, `verification did not load.` / `проверка не загрузилась.` with `retry` / `ещё раз`. Delete account — `failed to delete. check the connection and try again.` / `не удалось удалить. проверьте соединение.`
- On `/type` the slot above the stream is a reserved `Notice`, always one height (ADR 046): loading vocabulary, or the error with retry. There is nothing to type until the vocabulary loads.
- Lazy chunks (typing results, session summary — ADR 057; the phrase credits on `/about`) and lazy routes (`/type`, `/stats`, `/settings`, `/about`) show the same loading and error in the chunk's place. The primary button (`next test`, `continue`) and `Enter` work in both states.
