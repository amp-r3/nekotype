# KanaTask

One task of a learning session on `/` (decision 41; the frame of P9, decisions 159–162): the session line with its ticks, the task on a card — a caption naming the kind, the prompt, the options — the feedback lines, one reserved notice line and the key line. Kinds: `introduction`, `recall`, `recognition`, `word` (a typed task whose stage the consumer draws with `KanaWord` or `KanaParts`) and `break` (a screen of its own: the round, the closing word). Recall colour — decision 58.

**The consumer provides:** `kind`; `kana`, `romaji`, `promptKana` (a kana prompt of a choice); `caption` (default: `new kana` for an introduction, `which kana is it?` for recognition, none for recall); `row` (an introduction's row: `{ kana, known }`); `stage` (a custom stage); `session` (`{ kind: 'learning', n, total, misses, round: { n, size, misses } }`) or `progress` (the session line's text, for a break); `answered` (`right` | `slip` | `wrong`); `compare` (`{ yours, yoursRomaji, romaji, label }` — a recall answered wrong); `feedback` (the lines under the card), `promise`; `held` (the answer waits for `Enter`); `footEnd` (`report a problem`); `options` (`{ count, large, find }`); `notice`; `children` (the `OptionCard`s); `onLeave`, `onShow`, `onNext`, `labels` from i18n. The input engine takes the controller from `onReady` and calls only its methods while the user answers.

**Session line** — `mono-small`, words `fur-dim`, numbers `fur`: `learning · 7 of 30` / `обучение · 7 из 30`; in the round `round · 1 of 3` / `повтор · 1 из 3`; on the round's screen `round · 3 kana` / `повтор · 3 каны`. No clock, no countdown, no answer time on screen. On the right: `leave session` / `выйти` (`Button text`): returns to `/` without confirmation — answers are kept, the summary is lost.

**Ticks** (decision 149) — under the session line, one 2px tick per task, `stroke-mark` apart: done `fur-dim`, current `eye`, the rest `line-strong`, a task with the verdict `wrong` `miss`. The round's ticks follow after a `space-3` gap. A word or a run is one tick. The current tick turns `miss` when the task is answered, never on a keystroke. Decorative for screen readers: the session line says `7 of 30`.

**The card** (decision 159) — `bg-raised`, a `line` border, `radius-md`, `space-8` `space-6` padding; a `miss-dim` border once the task is answered wrong. It slides in from the right when the task appears (`dur-reveal`; none under reduced motion). The caption's line (`ui-caption`, `fur-dim`) is reserved even when empty, so the prompt stands in one place for every kind; the stage holds 184px for a typed task, and a choice's options follow its prompt.

| kind | caption | prompt | input |
| --- | --- | --- | --- |
| introduction | `new kana · the m row` / `новая кана · ряд m` | the kana in `jp-solo` (`jp-solo-sm` below 640px), `fur`; under it the romaji as a ghost hint — `mono-counter` 24px, `untyped`; under that the kana's row (`jp-cell`: the new one `fur` underlined `eye`, the known `fur-dim`, the rest `fur-faint`) | the user types the shown romaji once; **only the shown spelling is accepted** (decision 96). Typed letters turn `fur`, the `eye` caret stands before the next letter; a rejected key flashes it. Nothing is timed, no errors are recorded. A rule (166), a transfer (169) and a build (170) introduce the same way with their own stage |
| recall | — (reserved) | the kana in `jp-solo` / `jp-solo-sm`, `fur` — the question, the most contrasting element on screen (principle 1); never dimmed | caret before the kana; the romaji buffer under it (`eye`, `mono-romaji`; `mono-small` below 640px). The buffer's line is reserved — the kana never moves. A rejected key flashes the caret `miss`; the error is recorded, the answer goes on until the kana is typed in full |
| recognition | `which kana is it?` / `какая это кана?`; contrast, transfer, find the error, hiragana or katakana? have their own (168–172) | the romaji in `mono-hero` (`mono-hero-sm`), or a kana (`promptKana`, `jp-solo`; 48px on a 56px line below 640px) | `OptionCard`s; keys `1`–`4` (`1`–`2`, `1`–`9`), click or tap |
| word | `word` / `слово`, `a word of today's kana`, `run: type them in a row`, `type the kana they make` | `KanaWord` or `KanaParts` | romaji in one stream, one buffer under the current kana (163, 173, 170) |
| break | — | the cat, a title, kana, one line, `start` (`primary`, `lg`, `Kbd enter`) | `Enter` (162, 165) |

**Romaji shown to the learner** (introduction hint, recognition prompt, `revealed: …`, the table's tooltip and details): the kana table's first IME spelling, except ん / ン, shown as `n` — decision 96. Recall accepts every spelling of the learning strictness.

**After the answer** (decision 160):

- Right: recall stays `fur`, the caret moves past the kana, the buffer clears; held 400ms, then the next task. A choice marks its card. No words, no "correct" marks. A **slip** (one wrong key, answered quickly) looks right.
- Wrong: the card's border turns `miss-dim`; the task is `held` until `Enter`, `Space` or a click. Recall compares in the stage: the right kana in its place, `fur`, with its romaji under it; the learner's kana on its left, `jp-solo-sm` (`jp-test-sm` below 640px), `miss`, `you typed` / `вы ввели` over it and its romaji under it; after `Esc` only the right kana and its romaji. A choice keeps its cards' marks.
- **Feedback lines** under the card (`role="status"`): the pair as a sentence (`me is め · this is ぬ nu`) for a screen reader only (`sr-only`); the difference of a similar pair (`ui-body`, `fur`); the promise `ぬ comes back at the end of the session` / `ぬ вернётся в конце сессии` (`ui-label`, `fur-dim`) while the round has room. A word, a rule error, find the error, transfer and hiragana or katakana? write their own line (164, 171, 172).
- 400ms is a hold, not an animation; it is the engine's constant, not a token. **Keys pressed before the next task appears are ignored.**
- No green, no praise. A new kana is not celebrated: the signal is the next task.

**Notice line** (one at a time, reserved, `control-h-sm` high): `revealed: nu` / `ответ: nu` (`Notice reveal`, counts as an error); the layout and IME notices; `the task started over: the tab was hidden` / `задание заново: вкладка была скрыта`. While an answer is held the line is not shown: the feedback takes its place.

**Key line:** recall, a word, a build, a run — `Kbd esc` + `show the romaji` / `показать ромадзи` (a text button under `pointer: coarse`, same effect, counts as an error). A held answer — `Kbd enter` + `next` / `дальше` (a `next` button under `pointer: coarse`). At its end `footEnd` (`report a problem`) or the reserved `click to focus` / `нажмите для ввода`.

**Focus and tabs:** when the window loses focus the prompt dims to 25% and `return to the window to continue` appears; when the hidden input loses focus while the window keeps it, `click to focus` appears. If the tab is hidden during a task, the task starts over (`reset`): input cleared, time reset; an error made before stays recorded.

**Phone with the on-screen keyboard open** (360 × 640 → about 280px visible; decision 161). `continue` hands focus to the hidden input; it keeps focus for the whole session. Below 640px every state fits 280px (the highest, 277): the card loses its frame and fill; recall drops the empty caption line; the promise moves into the key line left of `next`; the difference line is 12px; the pair of an error stands centred as a group; `report a problem` stands left of `next`. Every target ≥ `touch-min`. See `ScreenLessonKeyboard`.

**Controller** (`createTaskController`) — classList / textContent / transform only, positions cached after layout and on `ResizeObserver` / `document.fonts.ready`; the component renders once per task and once per answer:

| method | does |
| --- | --- |
| `setBuffer(s)` | recall: the pending romaji |
| `type(n)` | introduction: `n` letters of the ghost hint typed |
| `reject()` | the 120ms `miss` flash of the caret (`dur-reject`, opacity layer, WAAPI) |
| `finish('correct' \| 'miss')` | the answer is complete: kana colour, caret after the kana, buffer cleared |
| `reset()` | the task starts over (hidden tab) |
| `setWindowFocus(on)`, `setInputFocus(on)` | the window or the hidden input lost or regained focus |

A word and a run move the caret from token to token and write the typed tokens' class the same way; the code's controller gains that for `KanaWord` (PR 7).

The sound of the kana after each task (from P10) has no UI here. A task never waits for the sound.

**Later task types** (decision 152): `later` replaces the prompt and the options with the place of a task type of P10 in the previews; the session line, its ticks and the notice line stay.
