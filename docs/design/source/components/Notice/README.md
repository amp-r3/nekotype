# Notice

One status line. Used for: the revealed romaji, the next step after a wrong option, keyboard layout and IME, a task started over, loading and load errors, storage unavailable, why a test ended, sync status.

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
- `tone="miss"` — only for states that block an action (load failed, sync blocked).
- Loading text does not pulse: the ellipsis says "in progress"; motion would be decoration (see decisions.md).
- In a learning task (`KanaTask`) the notice line sits under the task, reserved, `control-h-sm` high. One at a time: `revealed: nu` / `ответ: nu` (`reveal`, after `Esc` or the `show the romaji` button in recall); `Kbd enter` + `next` / `дальше` after a wrong option (a `next` text button under `pointer: coarse`); layout and IME notices; `the task started over: the tab was hidden` / `задание заново: вкладка была скрыта`.
- The session summary is a lazy chunk: `loading…` / `загрузка…`, or `failed to load. check the connection and try again.` with `retry`; `continue` and `Enter` work in both states.
- Typing results: why a test ended — `test ended: 5 seconds without input` / `тест завершён: 5 секунд без ввода`, `test ended: the tab was hidden` / `тест завершён: вкладка была скрыта`; nothing after a manual zen finish.
- `/stats`: `loading history…` / `загрузка истории…` under the history table.
- `/settings`, sync status (default tone unless noted): `synced` / `синхронизировано`; `pending` / `ждёт отправки`; `offline` / `нет сети`; `session expired` / `сессия истекла` with the action `sign in again` / `войти снова`; `tone="miss"` — `sync is paused until the next app update` / `синхронизация приостановлена до обновления приложения`.
- On `/type` the slot above the stream is a reserved `Notice`, always one height (ADR 046): loading vocabulary, or the error with retry. There is nothing to type until the vocabulary loads.
- Lazy chunks (typing results, session summary — ADR 057; the phrase credits on `/about`) and lazy routes (`/type`, `/stats`, `/settings`, `/about`) show the same loading and error in the chunk's place. The primary button (`next test`, `continue`) and `Enter` work in both states.
