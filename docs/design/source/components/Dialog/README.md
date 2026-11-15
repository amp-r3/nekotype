# Dialog

A modal dialog: reset progress, sign out with unsent data, delete account, signing in to another account, report a problem.

- Native `<dialog>` with `showModal()`: focus is trapped inside, `Esc` closes (`onClose`), the page underneath is inert. Backdrop — `scrim`.
- `bg-raised`, `line` border, `radius-md`, no shadow. Appears with `nk-reveal` over `dur-reveal`.
- Head: the title (`ui-heading`) and a close button `✕` (JetBrains Mono, in the subset; `aria-label` `close` / `закрыть`). No line under the title.
- Text `ui-body` / `fur-dim`, actions on the right. The safe action comes first and receives initial focus.
- An irreversible action is `Button variant="danger"`.

| dialog | title (en / ru) | text | actions |
| --- | --- | --- | --- |
| reset progress (guest) | `Reset progress?` / `Сбросить прогресс?` | `Learning progress and typing statistics in this browser will be erased. This cannot be undone.` | `cancel`, `reset` (danger) |
| sign out with unsent data | `Sign out?` / `Выйти?` | `3 results have not been sent yet. If you sign out now, they will be lost.` | `cancel`, `sign out` (danger) |
| delete account | `Delete account?` / `Удалить аккаунт?` | + `Input` `Type "delete" to confirm` / `Введите «удалить»` | `cancel`, `delete forever` / `удалить` — disabled until the word is typed |
| another account (decision 118) | `Sign in to another account?` / `Войти в другой аккаунт?` | `This browser holds data of another account that has not been sent. If you continue, it will be lost.` / `В этом браузере есть неотправленные данные другого аккаунта. Если продолжить, они пропадут.` | `cancel`, `discard and continue` / `удалить и продолжить` (danger) |
| report a problem (decisions 23, 114) | `Report a problem with this phrase` / `Ошибка во фразе`; `Report a problem with this word` / `Ошибка в слове` | the phrase or word (`jp-body`, `fur`), `Select` `What is wrong` / `Что не так`, `Textarea` `Comment (optional)` / `Комментарий (необязательно)`, the Turnstile widget (300 × 65), a reserved `Notice` line | `cancel`, `send` / `отправить` (primary) |

Sign out without unsent data needs no dialog. The another-account dialog opens on `/`, where the sign-in returns; its `cancel`, `Esc` and `✕` all cancel the new sign-in.

**A request in flight** (decisions 115, 122). While the dialog's request runs — sending a report, deleting the account — its fields and `cancel` are disabled, the action is disabled and names the request (`sending…` / `отправка…`, `deleting…` / `удаление…`), and the dialog cannot be closed: `onClose` is not passed, so there is no `✕` and `Esc` does nothing. Closing would not stop the request.

**Failure** (decisions 116, 122). A dialog with a request ends its body with one reserved `Notice` line (`control-h-sm` high; two lines below 640px), so a message never changes the dialog's height. `tone="miss"`, one message at a time; the strings are in the `Notice` guidelines. After a failure the fields and actions work again, and the action is the retry.

**Success of a report** (decision 115). The body becomes one line, `Report sent.` / `Сообщение отправлено.`, with one action `close` / `закрыть` (`secondary`, focused); the title stays. A deleted account closes its dialog: the screen returns to guest mode.
