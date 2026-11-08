# Dialog

A modal dialog: reset progress, sign out with unsent data, delete account, report a problem.

- Native `<dialog>` with `showModal()`: focus is trapped inside, `Esc` closes (`onClose`), the page underneath is inert. Backdrop — `scrim`.
- `bg-raised`, `line` border, `radius-md`, no shadow. Appears with `nk-reveal` over `dur-reveal`.
- Head: the title (`ui-heading`) and a close button `✕` (JetBrains Mono, in the subset; `aria-label` `close` / `закрыть`). No line under the title.
- Text `ui-body` / `fur-dim`, actions on the right. The safe action comes first and receives initial focus.
- An irreversible action is `Button variant="danger"`.

| dialog | title (en / ru) | text | actions |
| --- | --- | --- | --- |
| reset progress (guest) | `Reset progress?` / `Сбросить прогресс?` | `Learning progress and typing statistics in this browser will be erased. This cannot be undone.` | `cancel`, `reset` (danger) |
| sign out with unsent data | `Sign out?` / `Выйти?` | `3 results have not been sent yet. If you sign out now, they will be lost.` | `cancel`, `sign out` (danger) |
| delete account | `Delete account?` / `Удалить аккаунт?` | + `Input` `Type "delete" to confirm` / `Введите «удалить»` | `cancel`, `delete forever` — disabled until the word is typed |

Sign out without unsent data needs no dialog.
