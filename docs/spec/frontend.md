# Frontend

One page takes keyboard input: learning on `/` ([Learning](learning.md)), where recall and introduction tasks are answered by typing romaji. A keystroke MUST NOT trigger a component render there.

## Input source (D14, D15)

1. Input is captured by a hidden `<input>` with `autocomplete=off`, `autocorrect=off`, `autocapitalize=off`, `spellcheck=false`.
2. A `keydown` listener on `document` keeps the baseline behaviour: when focus is outside the hidden input (for example on a button of the session after Tab), outside any text field and no dialog is open, a typable key returns focus to the hidden input and is processed as input. Modifier combinations and keys inside dialogs are not intercepted: Ctrl/Cmd+Enter is left to the browser, so on a link it opens the link and the focus stays where it is.
3. A `keydown` carrying a single latin character, `-` or `'` is handled immediately and cancelled with `preventDefault`. This is the primary desktop path. A repeated `keydown` (`event.repeat`, a held key) is cancelled and is not input: it is not a keystroke and is not counted. A typed character that is not input (a digit, a space, a mark) is left to the browser.
4. A `keydown` with `key` = `Unidentified` or `Process` (mobile keyboards) is skipped; characters arrive via `beforeinput` (`insertText`, `data` field), one intent per character.
5. When `beforeinput` is not cancelable (Gboard composition), an `input` fallback compares `value` with the last value seen and processes only the added characters. The field is not cleared during composition; it is cleared on `compositionend`. Character duplication on Gboard is a known risk and is part of the P2 device-matrix check.
6. A non-latin letter is rejected without counting as an error; a "switch your keyboard layout to English" notice appears and hides after the next latin character.
7. The "turn off the Japanese IME: Nekotype converts romaji itself" notice is shown only when composition data contains kana or kanji. Composition events with latin data (Gboard on Android) do not show it. Latin text of a composition is held back until the IME is shown to be off: a consonant waits (with the IME on it is only the placeholder of a kana), a latin vowel releases it (an IME that is on would have made kana of it) and so does a composition that ends without kana, or a key typed directly. Kana drop whatever is held, so a Japanese IME that is on never starts a test or counts a mistake with its first letter. A latin vowel in a composition also hides the notice; a consonant does not. The only cost on Gboard is that the first consonant of a word is processed together with the vowel after it.
8. The `handleIntent({kind:'char', char})` seam for an on-screen keyboard is retained.
9. The hidden field belongs to the page, not to the screen inside it, and keeps the focus through a session.
10. The field takes keys in introduction and recall tasks; in a recognition task the keys 1–4 choose an option, and on the chart and the summary a key is left to the controls there. "Continue" and "Review" focus the field in their click handler, and it keeps the focus through a session, so a phone keeps its keyboard open between tasks.

## Keyboard

| Key                  | Action                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Esc                  | Recall: shows the romaji of the kana and counts as an error. A touch screen has no Esc: there a "Show the romaji" button stands in its place and does the same                                                                                |
| 1–4                  | Choose an option in a recognition task, from the digit row or the numeric keypad                                                                                                                                                              |
| Enter, Space         | After a wrong recognition choice: the next task                                                                                                                                                                                               |
| Enter on the summary | "Continue": the next learning session, wherever the focus is except on a link, a control or in a dialog, which keep Enter for themselves; modifiers and a held key do nothing. Tab is never intercepted, so keyboard navigation is unaffected |

Keys in hints and documentation are written as in the design system (ADR 059): `+` joins keys pressed together (`ctrl + enter`), `→` joins keys pressed in turn (`tab → enter`).

## Hot path (D16)

- Signals are passed into JSX as text nodes or written to the DOM via `useSignalEffect` and refs. State classes are toggled via `classList` on refs, without re-rendering.
- No IndexedDB write happens inside a keystroke handler.
- A keystroke that does not finish the answer of a recall task: **0** component renders. The keystroke that finishes it: at most **1** render. The next task, shown after the pause, renders once. Verified by a test using `options.diffed` (`session-screen.test.tsx`).
- A task of a learning session is drawn by the design system's `KanaTask`. Its controller, `createTaskController`, is the task's DOM writer: `setBuffer` (recall), `type` (introduction), `reject`, `finish`, `reset` (hidden tab), `setWindowFocus` and `setInputFocus`. It changes classes, text and transforms only, with positions measured on layout, not on a keystroke (ADR 059).
- Animations use `transform` and `opacity` only; `prefers-reduced-motion` disables them, as in the baseline.
- A rejected key flashes the caret in `miss` for 120 ms through a separate layer animated with `opacity`. With `prefers-reduced-motion` the colour changes for 120 ms without a transition.
- Noto Sans JP is loaded with `<link rel="preload">` (absent in the baseline).

## Loading

After the first render, on `requestIdleCallback`, the client prefetches all lazy route chunks, the session runtime, the session summary and both dictionaries. This keeps the application usable when the network drops after load.

- The session summary, the Russian dictionary and the strings that only one lazy screen uses (a dictionary part per screen and language, loaded with the screen) are chunks of their own, fetched on idle with the others ([ADR 057](../adr/057-lazy-results-screen-and-russian-dictionary.md), [ADR 067](../adr/067-initial-chunk-before-p4.md)). A screen is not shown before its strings: a part that fails to load fails the screen, with Retry. If a session ends before its summary chunk is there, a loading notice stands in its place (an error with Retry on a failure), and Continue and Enter work meanwhile.
- A saved Russian language holds the first render until its dictionary has loaded; if it cannot be loaded the interface is in English and the choice stays saved. The language switch loads the dictionary first (with the parts of the screens opened so far) and changes the language only then.
- Leaving a learning session keeps its recorded answers ([Learning](learning.md)).

## UI architecture

From P2 the interface follows the [Nekotype design system](../design/README.md) (A31, [ADR 031](../adr/031-adopt-the-nekotype-design-system.md)); no separate redesign is planned. Views stay separated from logic, so a later visual change does not touch behaviour.

- **Logic stays out of components.** Components in `ui/` read `ReadonlySignal` state and call exported actions. They MUST NOT call the engine, `Clock`, `Scheduler`, storage or `fetch`, and hold only local presentation state such as an open dialog. Everything else lives in `model/` and `lib/`.
- **One exception for the hot path:** DOM writes through refs and `useSignalEffect` stay in hooks in the slice's `lib/`, with a small interface the view binds to, so a new view reuses them and keeps the render budget.
- **Tests target behaviour.** Logic is tested at the `model/` and `lib/` level without rendering. e2e and DOM tests select by role, label or `data-testid`, never by class name or DOM structure. The DOM carries no answers for tests: a test works out the expected input from what the page shows (ADR 045). Replacing a view MUST NOT require changing a model test.
- **Styling** uses only the CSS-variable tokens and `shared/ui` primitives; a page defines no colours or one-off components of its own.

**Slices** (a starting point; ADR 015 still merges a slice with a single consumer into it):

| Layer      | Slices                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pages`    | `learn` (`/`; also the learning session, task choice, the kana table and the engine binding), `stats`, `settings`, `about` |
| `features` | `sync`                                                                                                                     |
| `entities` | `learn` (learning state, confidence, unlocking, boxes, streak), `user`, `settings`                                         |

Slices on one layer do not import each other, so a flow crossing features, such as sign-out running a sync first, is composed in the page or in `app`. The input source is in `shared` ([Architecture](architecture.md)).

**Screens in the MVP:**

| Route       | Basic content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`         | Learning: kana chart, progress, learning and review sessions, session summary; see [Learning](learning.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/stats`    | See [Metrics and statistics](metrics.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/settings` | Learning: learning strictness, target answer time, sound (P10). "Reset progress" for guests (a Data section, not rendered for a signed-in user). Account section, last: for a guest one line on what signing in gives and the Google and GitHub sign-in buttons (hidden on previews); for a signed-in user, a lazy chunk with the profile (display name, else email, else "Account"; the provider; no avatar image), sync status (synced, pending, offline, session expired with "Sign in again", blocked), sign-out and account deletion with a confirmation dialog, both disabled without a connection and deletion also with an expired session ([Storage and sync](storage-sync.md)) |
| `/about`    | Sources and licences, Nekotype's terms, phrase credits in pages of 25 ([ADR 066](../adr/066-about-page-design.md)); see [Content pipeline](content.md); kana audio credit in P10, stored data in P14                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

The navigation holds the logo, links to `/` (learn), `/stats` and `/settings`, the `en`/`ru` switch and a sign-in link to `/settings`, hidden on previews and after sign-in; while the session is expired the link is back on every screen as "Sign in again" ([ADR 079](../adr/079-account-and-report-states.md)); `/about` is linked from the page footer. During a learning session the navigation and the footer are not rendered; the session line holds "Leave session" instead ([Learning](learning.md)). "Reset progress" is on `/settings`, for guests only (A33).

**Sign-in notice on `/`** ([ADR 079](../adr/079-account-and-report-states.md)). After an OAuth failure ([Storage and sync](storage-sync.md), "Guest, sign-in and sign-out") the reserved notice line of `/` shows "Sign-in was cancelled" (`auth_error=denied`) or, as an error, "Sign-in failed. Try again in settings." (`auth_error=failed`), until the next navigation. The line shows one notice at a time, in this order: the progress load error, storage unavailable, the sign-in notice. The dialog for signing in to another account with unsent data also opens on `/`; the screen behind it stays in its loading state until the user chooses.

## Interface

- All strings, including `aria-label` values and chart titles, come from the i18n dictionaries. Exception: kana row names are the romaji labels from the kana table, identical in every language ([ADR 044](../adr/044-row-names-are-romaji.md)).
- The layout is responsive: every feature works on a phone; the primary layout target is desktop.
- One dark theme; colours remain CSS-variable tokens so that themes can be added without structural changes.
