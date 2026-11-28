# Dialog

A modal dialog: reset progress, sign out with unsent data, delete account, signing in to another account, report a problem with a word.

- Native `<dialog>` with `showModal()`: focus is trapped inside, `Esc` closes (`onClose`), the page underneath is inert. Backdrop — `scrim`.
- `bg-raised`, `line` border, `radius-md`, no shadow. Appears with `nk-reveal` over `dur-reveal`.
- Head: the title (`ui-heading`) and a close button `✕` (JetBrains Mono, in the subset; `aria-label` `close` / `закрыть`). No line under the title.
- Text `ui-body` / `fur-dim`, actions on the right. The safe action comes first and receives initial focus.
- An irreversible action is `Button variant="danger"`.

| dialog | title (en / ru) | text | actions |
| --- | --- | --- | --- |
| reset progress (guest) | `Reset progress?` / `Сбросить прогресс?` | `Learning progress in this browser will be erased. This cannot be undone.` / `Прогресс обучения в этом браузере будет стёрт. Это нельзя отменить.` (decision 131) | `cancel`, `reset` (danger) |
| sign out with unsent data (decisions 126, 133) | `Sign out?` / `Выйти?` | always the same line: `Some progress has not been sent yet. If you sign out now, it will be lost.` / `Часть прогресса ещё не отправлена. Если выйти сейчас, она пропадёт.` | `cancel`, `sign out` (danger) |
| delete account | `Delete account?` / `Удалить аккаунт?` | `Your account and learning progress will be deleted on every device.` / `Аккаунт и прогресс обучения будут удалены на всех устройствах.` + `Input` `Type "delete" to confirm` / `Введите «удалить»` | `cancel`, `delete forever` / `удалить` — disabled until the word is typed |
| report a problem with a word (decision 167) | `Report a problem with this word` / `Ошибка в слове` | the word (`jp-body`) and its meaning; `What is wrong` / `Что не так` — a `RadioGroup` of `wrong reading`, `wrong translation`, `other` with none chosen; `Comment (optional)` — a `Textarea`; the Turnstile slot, 65px, full width | `cancel`, `send` — enabled once a reason is chosen and the check passed; `sending…`; then `Report sent.` and `close` |
| another account (decision 118) | `Sign in to another account?` / `Войти в другой аккаунт?` | `This browser holds data of another account that has not been sent. If you continue, it will be lost.` / `В этом браузере есть неотправленные данные другого аккаунта. Если продолжить, они пропадут.` | `cancel`, `discard and continue` / `удалить и продолжить` (danger) |

Sign out without unsent data needs no dialog. The another-account dialog opens on `/`, where the sign-in returns; its `cancel`, `Esc` and `✕` all cancel the new sign-in.

**A request in flight** (decisions 115, 122). While the dialog's request runs — deleting the account — its fields and `cancel` are disabled, the action is disabled and names the request (`deleting…` / `удаление…`), and the dialog cannot be closed: `onClose` is not passed, so there is no `✕` and `Esc` does nothing. Closing would not stop the request.

**Fields** (decision 127). An `Input` in a dialog takes the full width of the body, filled with `bg`: the dialog is `bg-raised`, the page's field fill would vanish on it.

**Failure** (decisions 116, 122, 127). A dialog with a request has one reserved `Notice` line in its actions row, left of the buttons (`note`; two lines of `ui-label`, 40px; its own row above the buttons below 640px), so a message never changes the dialog's height and no empty band stands above the buttons. `tone="miss"`, one message at a time; the strings are in the `Notice` guidelines. After a failure the fields and actions work again, and the action is the retry.

A deleted account closes its dialog: the screen returns to guest mode. The report dialog opens from a word task after the answer; the session waits, and closing gives the focus back to the session's input (decision 167). Its failures are those of decision 116: `verification failed. try again.`, `failed to send. check the connection and try again.`, `verification did not load.` with `retry`, and offline `offline. reporting is available online only.` (default tone, fields and `send` disabled).
