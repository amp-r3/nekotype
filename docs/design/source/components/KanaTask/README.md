# KanaTask

One task of a learning or review session on `/` (ADR 058): the session line, the prompt, the options (recognition), one reserved notice line and the key-hint line. Three kinds: `introduction`, `recall`, `recognition`. New in v10 — why not `TestArea`: see decisions.md, After ADR 058 · 41; recall colour — 58.

**The consumer provides:** `kind`, `kana` (introduction, recall), `romaji` (introduction ghost hint, recognition prompt), `session` (`{ kind: 'learning' | 'review', n, total }`), `notice` (the content of the notice line), `children` (four `OptionCard`s in recognition), `onLeave`, `onShow`, `labels` from i18n. The input engine takes the controller from `onReady` and calls only its methods while the user answers.

**Session line** — `mono-small`, words `fur-dim`, numbers `fur`: `learning · 7 of 25` / `обучение · 7 из 25`, `review · 3 of 5` / `повторение · 3 из 5`. `n` grows after every task, introduction included. No clock, no countdown, no answer time on screen. On the right: `leave session` / `выйти` (`Button text`): returns to `/` without confirmation — answers are kept, the summary is lost.

| kind | prompt | input |
| --- | --- | --- |
| introduction | `new kana` / `новая кана` (`ui-caption`, `fur-dim`); the kana in `jp-solo` (`jp-solo-sm` below 640px), `fur`; under it the romaji as a ghost hint — `mono-counter` 24px, `untyped` | the user types the romaji once. Typed letters turn `fur`, like typed text in the stream; the `eye` caret stands before the next letter. A rejected key flashes the caret. Nothing is timed, no errors are recorded. |
| recall | the kana in `jp-solo` / `jp-solo-sm`, `fur` — the question, the most contrasting element on screen (principle 1); the answer time runs from its display, so it is never dimmed. The `eye` caret and buffer show that no answer has been given yet | caret before the kana; the romaji buffer under it from the caret (`eye`, `mono-romaji`; `mono-small` below 640px). The buffer's line is reserved — the kana never moves. ぬ: `n` → buffer `n`; `nu` → done. きゃ: `k`, `ky`, `kya`. A rejected key (`m` for ぬ) flashes the caret `miss`; the error is recorded, the answer goes on until the kana is typed in full. |
| recognition | the romaji in `mono-hero` (`mono-hero-sm` below 640px), `fur` | four `OptionCard`s in one row; keys `1`–`4` (number row and numeric keypad), click or tap |

**After the answer** (`finish`):

- Recall without an error: the kana stays `fur`, the caret moves past it and the buffer clears; held 400ms, then the next task. No words, no "correct" marks.
- Recall with an error: when the kana is typed in full it turns `miss` with a `miss-dim` underline for 400ms (as a mistyped kana in the stream), then the next task.
- Recognition — see `OptionCard`: correct holds 400ms; wrong waits for `Enter`, `Space` or a click, and the notice line shows `Kbd enter` + `next` / `дальше` (a `next` text button under `pointer: coarse`).
- 400ms is a hold, not an animation: colours switch instantly; it is the engine's constant, not a token.
- **Keys pressed before the next task appears are ignored.** This is behaviour, not a visual state: nothing on screen shows it.
- No green, no praise. An unlocked kana is not celebrated: the signal is the next task — its introduction.

**Notice line** (one at a time, reserved, `control-h-sm` high): the revealed romaji after `Esc` — `Notice reveal`, `revealed: nu` / `ответ: nu` (counts as an error); `Kbd enter` + `next`; layout and IME notices as on the test screen; `the task started over: the tab was hidden` / `задание заново: вкладка была скрыта`.

**Hint line:** recall — `Kbd esc` + `show the romaji` / `показать ромадзи`. Under `pointer: coarse` there is no Esc on the on-screen keyboard: the line holds a `show the romaji` text button instead — same effect, counts as an error. The same button replaces the `esc` hint on `/type`. On the right, reserved: `click to focus` / `нажмите для ввода`.

**Focus and tabs** — as on the test screen: when the window loses focus the prompt dims to 25% and `return to the window to continue` appears; when the hidden input loses focus while the window keeps it, `click to focus` appears. If the tab is hidden during a task, the task starts over (`reset`): input cleared, time reset; an error made before stays recorded.

**Phone with the on-screen keyboard open** (360 × 640 → about 280–330px visible; designed for 280). `continue` and `review` hand focus to the hidden input in their click handler; it keeps focus for the whole session, so the keyboard stays open, recognition included. Below 640px everything fits above it: session line, prompt, four options in one row (76 × 56px), notice line, hint line — 236px for recall and 260px for recognition, measured with `pointer: coarse` targets (every target ≥ `touch-min`). See `ScreenLessonKeyboard`.

**Controller** (`createTaskController`) — classList / textContent / transform only, positions cached after layout and on `ResizeObserver` / `document.fonts.ready`; the component renders once per task:

| method | does |
| --- | --- |
| `setBuffer(s)` | recall: the pending romaji |
| `type(n)` | introduction: `n` letters of the ghost hint typed |
| `reject()` | the 120ms `miss` flash of the caret (`dur-reject`, opacity layer, WAAPI) |
| `finish('correct' \| 'miss')` | the answer is complete: kana colour, caret after the kana, buffer cleared |
| `reset()` | the task starts over (hidden tab) |
| `setWindowFocus(on)`, `setInputFocus(on)` | as `TestArea` |

Only `transform` and `opacity` animate (caret move `dur-caret`, flash `dur-reject`, dimming `dur-fade`); no layout changes on a keystroke.

The sound of the kana after each task (from P6) has no UI here: no button, no indicator; only the setting in `/settings`. A task never waits for the sound.
