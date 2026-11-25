Nekotype teaches hiragana and katakana from scratch, one kana at a time, and shows how fast and how reliably you recall each one. It is a learning app; words join learning in P12. There is no kanji in any form.

The product's symbol is a white fluffy cat with blue eyes, and the palette comes from her: the fur is the text, the eyes are the only accent, the night around her is the background.

## Principles

1. **The kana is the hero.** On any screen with kana, the largest and highest-contrast element is the kana of the task. During a learning task, the screen holds only what the task needs: navigation and the footer are not rendered (see "Learning session").
2. **One accent.** `eye` marks "where you are now": the caret, the romaji buffer, the counter, the selected item (segments, the track switch, the open page in the navigation), the current row of the path and the current task's tick, focus, the revealed romaji and the mastered-kana mark. It never fills an area larger than a switch knob. The due mark is not `eye`.
3. **Structure through spacing.** Blocks are separated by `space-12` or more, not by cards, borders or fills. A line appears only where groups would otherwise run together (table rows). Exceptions with a surface: fields and dialogs (`bg-raised`); the kana details are a dialog (decision 147).
4. **Nothing without a function.** Every element either shows a state or performs an action. There is no confetti, no colour-coded judgement of results, no praise for a correct answer, and a new kana is not celebrated: progress shows as state, not as words.

## Tone and copy

- The interface is in English and Russian. Every string, including `aria-label`, comes from i18n; components take strings through `labels`. Examples in this system come in pairs: `continue` / `продолжить`.
- Lower case in buttons, segments, navigation and metric labels — in both languages: `continue` / `продолжить`, `answer time` / `время ответа`. Screen titles take a capital: `Settings` / `Настройки`.
- Russian strings are 20–30% longer, so no width is ever fixed to fit text — only padding.
- Calm and short, no exclamation marks, no praise: `No answers yet` / `Ответов пока нет`, `the task started over: the tab was hidden` / `задание заново: вкладка была скрыта`. No emoji in the interface.
- Descriptions address the user politely (Russian «вы»); labels are impersonal.
- Numbers up to 10 000 are written without a separator (`1050 ms` / `1050 мс`): the subsets have no non-breaking spaces.
- Keys go through `Kbd`, in lower case: `enter`, `esc`, `1`–`4`.

## Colour

One theme — dark (`dark`). Every colour is a token; pages define no colours of their own, so themes can be added without changing the structure.

- Background: `bg` (page) → `bg-raised` (fields, dialogs, switch track) → `bg-hover` (hover). `scrim` sits under a modal dialog.
- Lines: `line` — decorative divider; `line-strong` — control boundary and learning kana (≥ 3:1).
- Text: `fur` (main, the kana of a learning task, a typed letter) → `fur-dim` (secondary, placeholders, loading) → `untyped` (the ghost hint of an introduction task — only ≥ 24px) → `fur-faint` (disabled and locked only).
- Error — `miss`, the underline under an error — `miss-dim`. `miss` means only an error or a blocked action. There is no green in the system.

States of a learning task (`KanaTask`):

| what | token |
| --- | --- |
| the kana of the task (introduction, recall) | `fur` |
| ghost hint letter not typed yet (introduction) | `untyped`; typed — `fur` |
| answer with an error, held 400ms | `miss` + `miss-dim` underline |
| current position, romaji buffer | `eye` caret and buffer |
| rejected key | caret flashes `miss` for `dur-reject` |
| revealed romaji (the task's notice line) | `eye` |
| a tick of the session line (decision 149) | done `fur-dim`, current `eye`, the rest `line-strong`, answered with an error `miss` |

Kana table states (`KanaChart`):

| state | marker | contrast |
| --- | --- | --- |
| locked | no border, no fill, `fur-faint` kana | 2.78:1 — disabled, exempt |
| learning | `line-strong` border | kana 13.82:1, border 3.31:1 |
| learned | `heat-fur-3` fill | kana `fur` 5.28:1 |
| mastered | `heat-fur-4` fill + 2px `eye` mark under the cell | kana `on-fur` 6.10:1, mark 9.47:1 |

Over learned or mastered a kana can carry the **review due** mark — a folded corner in the cell's ink (5.28:1 on learned, 6.10:1 on mastered). It is a mark, not a fifth state: learning and locked kana never carry it.

- The chart (`/progress` only): day bars `heat-fur-3`, the median tick `chart-median`, grid `chart-grid`, cursor `chart-cursor`. One y scale.
- Heat scale (`/progress` only, decision 108): `heat-fur-1…5` — answers of a day in the activity map. A value is never colour alone: an empty cell is an outline, and the number is in the tooltip and the `aria-label`.
- Hover lightens one step (`fur` → `fur-bright`, `eye` → `eye-bright`, transparent → `bg-hover`). Text on a `fur` fill is `on-fur`. Focus is a solid `stroke-mark` outline in `focus` with a 2px offset.

## Typography

Three families, set up as tokens — a font changes in one place (`type.families`). Font files live in `fonts/` (the production subsets, ADR 032, 034) and are connected through `type.fonts`; no font CDN.

| family | weights | subset | size |
| --- | --- | --- | --- |
| `jp` — Noto Sans JP | 400 | every kana of the table, every glyph of the words and phrases, plus `ーっッゃゅょャュョァィゥェォ、。・０–９`; no kanji | 20.77 KB |
| `mono` — JetBrains Mono | 400, 500 | U+0020–007E, Cyrillic А–я, Ёё, `← → ✕` | 10.66 + 10.69 KB |
| `ui` — Golos Text | 400, 500 | the same Latin and Cyrillic, plus `ū ō é ← → · … — – « » × №` | 9.38 + 9.55 KB |

61.05 KB of fonts in total; every file ≤ 45 KB; the whole first load ≤ 160 KB. Noto is the fallback in `ui` and `mono`, so kana inside interface text is drawn with it.

**Glyphs to add to the subsets** at implementation (decisions.md, "Glyphs to add to subsets"): `·` and `⌘` in Mono, `−` (U+2212), non-breaking spaces U+00A0 and U+202F. Until then they fall back to the system font; the system uses them as they are.

**Other glyphs outside the subsets** — `↑ ↓ ✓ ≤ ≥ ± Δ`, `！ ？`, curly quotes `“ ” ‘ ’`: avoid them in interface strings. Any new glyph is named in decisions.md (which glyph, which font, why).

Styles:
- Learning task: `jp-solo` 72/96; below 640px `jp-solo-sm` 48/72.
- Kana in the interface: `jp-test-sm` 32/48 (a recognition option, the title of the kana details), `jp-cell` 22/28 (one kana in a table cell), `jp-cell-sm` 18/24 (two-character kana in a 44px cell: きゃ, ティ), `jp-body` 16/28 (lists, mixups, the path's kana, words).
- Numbers and prompts: `mono-hero` 72 (the romaji prompt of recognition, the current streak on `/progress`; `mono-hero-sm` 56 on a narrow screen) — one per screen; `mono-stat` 32 — the `Stat` numbers of `/progress` and the forecast change of the summary; `mono-counter` 24 — the ghost hint.
- Romaji: `mono-romaji` 16 (buffer, revealed romaji, numbers inside labels), `mono-small` 12 (keys, axes, the session line `7 of 30`, the path's counts `31/46`).
- Interface: `ui-title` 24 → `ui-heading` 17 → `ui-body` 15 → `ui-label` 14 → `ui-caption` 12. Weights 400 and 500 only.

## Grid, spacing, shapes

- 4px step: `space-1` … `space-24`. Between the blocks of a screen — `space-12` (`space-8` below 640px).
- Centred column: content up to `layout-max` (1120); a learning task up to 640px. Page padding `space-8`, `space-4` on a narrow screen.
- Narrow screen — below `bp-narrow` (640px): `*-sm` styles, a settings control under its text, navigation in two rows, the home and the kana table in one column.
- Touch targets under `pointer: coarse` — at least `touch-min` (44px).
- Radii: `radius-xs` (2) — caret, indicators, cells; `radius-sm` (4) — buttons, fields, tooltip; `radius-md` (6) — dialogs. Never more than 6px.
- Lines: `stroke-hair` (1px) — dividers and borders; `stroke-mark` (2px) — caret, selection indicator, mastered-kana mark, the ticks of the path and of the session line, the memory stroke of the kana details, focus. The caret and the selection mark are one and the same shape: this is the system's signature.
- No shadows. Layers differ by background lightness, the tooltip by inverted colour.
- New sizes, colours and durations exist only as tokens: the code generates classes from tokens alone.

## Motion

Micro-animations only, no springs or bounces. Only `transform` and `opacity` animate; a colour on the hot path changes instantly.

| what | duration | curve |
| --- | --- | --- |
| caret to the next letter (introduction) | `dur-caret` 90ms | `ease-out` |
| caret after a relayout (resize, fonts) | none — it snaps | — |
| rejected key: caret flash | `dur-reject` 120ms | `ease-in` |
| hover, focus, tooltip, `click to focus` | `dur-hover` 120ms | `ease-out` (leaving — `ease-in`) |
| a task dims when the window loses focus | `dur-fade` 200ms | `ease-out` |
| dialog | `dur-reveal` 240ms | `ease-out`, 4px rise |

The 400ms hold after an answer in a learning task is not motion: colours switch instantly and stay. Loading text does not pulse. Under `prefers-reduced-motion: reduce` there is no animation: durations are 0, the reject flash holds for 120ms without a transition. The caret does not blink. `/` has no animations, charts or new illustrations: it is in the initial JS chunk.

## Progress (`/progress`, lazy route)

`/stats` leads here (decision 146). Levels: the screen title (`ui-title`), block titles (`ui-heading`), captions (`ui-caption`, `fur-dim`). Blocks are `space-12` apart (`space-8` below 640px); a block's title, caption, controls and content are `space-4` apart. No lines, no cards.

The title `Progress` / `Прогресс` with one track switch on its right (`track shown` / `показать дорожку`). It only shows a track: the learning track of `/` never changes from here. Under it, top to bottom:

1. **The kana table** of the shown track — `KanaChart`. On a desktop its blocks (basic · voiced · combinations · extended) stand side by side across `layout-max`, with the legend under them; below 640px they stack (decision 93). The tooltip stays; activating an introduced kana opens the kana details (below).
2. **The statistics on a fixed grid** (decision 137): four equal columns across `layout-max` (two below 640px), `space-12` apart. Every block takes whole columns, so its width comes from the screen, never from the data.
   - **`streak and activity` / `серия и активность`**, caption `fill: answers of the day · dot: a day of the current streak` / `заливка: ответы за день · точка: день текущей серии`. Column 1 is the streak: `current streak` / `текущая серия` (`ui-caption`), the number in `mono-hero` (`mono-hero-sm` below 640px), `days in a row` / `дней подряд` (`ui-label`, `fur-dim`), then two `ui-label` lines with the numbers in `mono-romaji` `fur`: `best: 15 days` / `лучшая: 15 дней` and `active days in the last 30: 21` / `активных дней за последние 30: 21` (a fixed window). Columns 2–4 hold the `ActivityMap`, which fills them: up to 26 weeks, cells up to 28px; the days of the current streak carry a dot. Below 640px the streak is one row and the map takes the full width under it.
   - **The totals:** four `Stat`s, one per column (two by two below 640px) — `mastered · hiragana` `7` `of 104`, `mastered · katakana` `0` `of 125`, `sessions started` / `сессий начато` `41`, `sessions finished` / `сессий закончено` `36`. Both tracks always.
   - **`answer time` / `время ответа`** across all four columns, for the shown track (`ResultChart`: one bar per day, `lower is better`); the caption starts with the track's name. Its one control is the period (`7 days` · `30 days` · `all` / `7 дней` · `30 дней` · `всё`; 30 by default). A track without answers: `no katakana answers yet` / `ответов по катакане пока нет`. A period without answers: `no answers in this period` / `за этот период ответов нет` with `show all time` / `показать всё время`.

**Before the first answer** (decision 130): the table with every kana locked (the first vowel opens next), and under it one `EmptyState` (`sleep`) — `No answers yet` / `Ответов пока нет`, `Finish a learning session: the streak, the activity and the answer times will appear here.` / `Закончите сессию обучения: здесь появятся серия, активность и время ответа.`, one action `to learning` / `к обучению` (`primary`, to `/`). While the data loads, the place under the title holds `loading…` / `загрузка…`; on failure the error with `retry`.

Keyboard: `Tab` goes through the track switch, the table (one stop, arrows inside, `Enter` or `Space` opens the details), the activity map (one stop, arrows inside), the period and the chart (one stop: ← → `Home` `End` between bars, `Esc`). No global keys.

### Kana details

A `Dialog` (decision 147), a lazy chunk, opened from a table cell on `/progress`, a kana of "since the last session" on `/` and a kana of the session summary; never during a session. The title is the kana (`jp-test-sm`) and its romaji (`mono-romaji`, `fur-dim`); a screen reader announces both. `Esc` and `✕` close it and give the focus back to the opener. The rows — a `ui-caption` caption on the left, the value in `ui-body` on the right:

| row | value |
| --- | --- |
| `state` / `состояние` | `learned · next review: 9 Nov` / `выучена · повторение: 9 нояб.`, `review due` / `пора повторить`; learning alone |
| `memory` / `память` | `holds about 12 days · mastered from 21 days` / `держится около 12 дней · освоена — от 21 дня`; under a day `holds less than a day` / `держится меньше дня`; under it a 2px stroke (`line-strong`, filled `fur-dim`) that is full at 21 days, `fur` once mastered. It is the model's stability |
| `recall` / `вспоминание` | `median 1720 ms · accuracy 70%` over the last 10 recall answers, with `6 of 10 answers` while fewer; or `no recall answers yet` |
| `mixed up with` / `путали с` | `め ×4, ね ×2`, most first; or `none yet` / `пока нет` |
| `recognition` / `узнавание` | `78% (14 of 18)`; or `no answers yet` / `ответов пока нет` |

From later phases the top of the dialog, over the rows, holds what is about the kana itself: the stroke order (P9), the mnemonic (P11) and `listen` / `послушать` (P10) — see "Later phases".

## Settings (`/settings`)

Rows: label and consequence-description on the left, the control on the right (below 640px: the control under the text). Three sections (decision 131):

- **Learning:** `learning strictness` / `строгость в обучении` (`Segmented` relaxed / strict IME; relaxed accepts `si` for し and `tu` for つ, strict IME accepts only what a Japanese IME accepts). Answer time has no setting: the line between good and hard answers follows the learner's pace on each device (ADR 115). From P10 a second row, `kana sound` / `звук каны` (`Switch`): `The kana is heard after each task and in listening tasks.` / `Кана звучит после каждого задания и в заданиях на слух.` It is not rendered before P10 (decisions 72, 151, 156).
- **Data:** a guest resets progress in this browser (`danger` → `Dialog`): the hint `Erases learning progress stored in this browser.` / `Стирает прогресс обучения в этом браузере.`; the dialog `Learning progress in this browser will be erased. This cannot be undone.` / `Прогресс обучения в этом браузере будет стёрт. Это нельзя отменить.` A signed-in user's `reset learning` on every device stays deferred to v1.1 (decision 91, spec decision A45).
- **Account:** Google and GitHub sign-in (hidden on preview), profile, sync status in a `Notice` (`synced`, `pending`, `offline`, `session expired` + `sign in again`, blocked in `miss`), sign out (a `Dialog` only with unsent data: `Some progress has not been sent yet. If you sign out now, it will be lost.`, decision 133), delete account (`Dialog`, disabled until the word is typed; `Your account and learning progress will be deleted on every device.` / `Аккаунт и прогресс обучения будут удалены на всех устройствах.`).

Account details (decisions 121–123). The profile is the cat mark, one name line and `via GitHub` / `через GitHub` or `via Google` / `через Google`; no avatar image. The name line is the display name; without one, the email (it wraps, it is never cut); without both, `account` / `аккаунт`. `sign out` and `delete account` need the server. Offline both are disabled and one `ui-caption` `fur-dim` line under them says `Needs a connection.` / `Нужна сеть.` With an expired session `sign out` works (the dialog about unsent data as usual) and `delete account` is disabled with `Sign in again to delete the account.` / `Войдите снова, чтобы удалить аккаунт.` The line's place is reserved. While the account is being deleted the dialog's field and both actions are disabled, the button reads `deleting…` / `удаление…` and the dialog cannot be closed; a failure shows in the dialog's reserved `Notice` line in `miss`. While the session is expired the navigation shows `sign in again` / `войти снова` on every screen (decision 120).

## About (`/about`, lazy route)

Reached only from the `Footer` link `about` / `о проекте`. Title `About` / `О проекте`, then one section (decision 132):

**Nekotype**, rows separated by `line`: `code` / `код` — AGPL-3.0-only, under it `Copyright (C) 2026 amp-r3 · source code: github.com/amp-r3/nekotype` (the link is the offer of the source, AGPL section 13); `name, logos and cat` / `название, логотипы и кошка` — `all rights reserved` / `все права защищены` (plain text, `fur-dim`); `fonts` / `шрифты` — OFL-1.1, under it Golos Text, JetBrains Mono, Noto Sans JP. A row: the name (`ui-label`) on the left, the licence as a link to its text on the right, the holder under both (`ui-caption`, `fur-dim`).

Reserved, not rendered: *Kana audio* / *Звук каны* — P10 (the recordings, their author and licence); *Data on this device* / *Данные на устройстве* — P14 (what is stored in the browser and, after sign-in, on the server; how to erase it). Sources and licences of words and phrases, and the phrase authors, come back with the phase that ships content (P12). They use the same rows.

No lazy content chunk, no cat, no primary button, no global keys. Keyboard: `Tab` goes through the licence links, the source code link and the footer.

## Loading and errors

Loading and errors (ADR 046, 057). The session summary and the kana details are lazy chunks; `/progress`, `/settings` and `/about` are lazy routes. While a chunk loads, its place shows `loading…` / `загрузка…`; on failure `failed to load. check the connection and try again.` / `не удалось загрузить. проверьте соединение.` with a `retry` button. The primary button (`continue`) and `Enter` work in both states; a screen without a primary button (`/about`) keeps its title.

## Learning home (`/`)

`/` answers "what now" (decisions 140, 153). On a desktop two bands over `layout-max`: on top the action (left half) and "since the last session" (right half), under them the path with the forecast across the whole width. The home takes the window between the navigation and the footer and stands at two fifths of the free height, so the free space falls above and below it, not under it alone. Below 640px one column: the action, the path, since the last session. No kana table here: it is on `/progress`.

1. **At the top:** the track switch — `Segmented`: `hiragana` / `хирагана`, `katakana` / `катакана`; the choice is saved and the reason, the path and the forecast follow it. On the right `streak: 6 days` / `серия: 6 дней` (the number in `mono-romaji`, `fur`); hidden until the first answer, after that a zero shows as it is. The streak is shared by both tracks. Russian forms: `1 день`, `3 дня`, `6 дней`, `0 дней`.
2. **The action.** The reason — what the session does first — in `ui-title`: `5 kana are due for review` / `5 кан ждут повторения`; `practise 1 weak kana: ぬ` / `потренировать 1 слабую кану: ぬ`; `finish learning 2 kana` / `доучить 2 каны`; `next: the m row` / `дальше: ряд m` (first visit: `next: the vowels` / `дальше: гласные`); `next: the vowels, katakana` / `дальше: гласные, катакана`. Under it `continue` / `продолжить` (`primary`, `lg`, `Kbd enter`; disabled until the progress has loaded) and the outline of the session, `about 30 tasks: 6 reviews, 2 new kana` / `около 30 заданий: 6 повторений, 2 новые каны` (`ui-label`, numbers `fur`; `about`, since `≈` is not in the subsets). **Nothing to do** (decision 141): the reason reads `nothing to review now` / `сейчас повторять нечего`, under it `next review: tomorrow at 9:15` / `следующее повторение: завтра в 9:15` (`at 18:40` today, `12 Nov, 9:15` later), and there is no `continue`; the cat sleeps over the reason (`sleep`, 96px; decision 154), as in the empty states.
3. **The katakana suggestion** (decision 145): once the basic hiragana are learned, while hiragana is selected and katakana has not started — over the reason, `The basic hiragana are learned. You can start katakana.` / `Основная хирагана выучена. Можно начинать катакану.` with `start katakana` / `начать катакану` (`secondary`, `sm`); with nothing to do it comes after the reason and its button is the primary action. No dismiss; it ends once katakana has an introduced kana.
4. **A reserved `Notice` line** under the action: while loading — `loading your progress…` / `загрузка прогресса…` (static); `progress cannot be saved in this browser` / `прогресс не сохраняется в этом браузере`; on a load error — `failed to load your progress. check the connection and try again.` / `не удалось загрузить прогресс. проверьте соединение.` in `miss` with `retry` / `ещё раз`; after a sign-in that did not finish (decision 119) — `sign-in was cancelled` / `вход отменён`, or in `miss` `sign-in failed. try again in settings.` / `вход не удался. повторите в настройках.`, until the next navigation. One at a time, in this order: the load error, storage unavailable, the sign-in notice.
5. **The path** (decisions 142, 143, 155) — `path · hiragana` / `путь · хирагана` (`ui-heading`). Under the title one forecast line: `the whole m row opens in 2–4 sessions` / `весь ряд m откроется через 2–4 сессии`, `in about 3 sessions` / `примерно через 3 сессии` when the range is one number; a forecast from the model or the learner's habits adds `A rough estimate for now. It gets more precise as you answer.` (`ui-caption`); `no forecast for the m row yet` / `для ряда m прогноза пока нет`; `every hiragana is open` / `вся хирагана открыта`; while the insights compute, the line keeps its height. Then the blocks as a chain of the kinds of kana, in the order they open: a `Segmented` (`blocks of the path` / `блоки пути`) whose items show the first kana of the block (`あ` basic, `が` voiced, `きゃ` combinations; katakana `ア ガ キャ ファ`) in `jp-test-sm` over the block's name and `31/46`, as the table names them; between two blocks `→` (Mono, `fur-faint`) in the middle of the gap. The kana is `fur` on the open block, `fur-dim` on a started one, `fur-faint` on a locked one; the open block has the `eye` mark of the switch, and `←` `→` move between blocks. Below 640px the kana is `jp-cell`, two blocks a line, no arrows. The open block (the current one by default) shows its rows as columns: the head over the kana, no line (current `eye`, done `fur-dim`, locked `fur-faint`); the kana downwards in `jp-cell` (`jp-body` below 640px; open `fur-dim`, locked `fur-faint`, the current row's open kana `fur`); the system's caret (`eye`, `stroke-mark`, `caret-h`) before the kana that opens next — where the learner is — and `1/5` under the current row. A row is done when every kana of it is introduced.
6. **Since the last session** (decision 144) — `since the last session` / `с прошлой сессии`: the kana as table cells under `new · learned · mastered · stronger` / `новые · выучены · освоены · окрепли`; each opens the kana details. Nothing changed: `no changes since the last session` / `с прошлой сессии изменений нет`. Not shown on the first visit.

Signing in to another account (decision 118). When a sign-in returns as a different user and the device holds unsent data of the previous account, a `Dialog` opens on `/` before anything of either account is shown: `Sign in to another account?` / `Войти в другой аккаунт?`, with `cancel` (focused; `Esc` and `✕` do the same) and `discard and continue` / `удалить и продолжить` (`danger`). Behind it the screen is in its loading state.

Keyboard: no global keys on `/`. When the screen is ready, `continue` takes focus, so `Enter` starts the session. `Tab` order is the order of the screen (decision 153): the track switch, `continue`, then on a desktop the kana of "since the last session" (`Enter` or `Space` opens the details) and the path's blocks (`←` `→` between them), below 640px the path's blocks and then the kana; `Shift + Tab` from `continue` reaches the track switch.

## Learning session (`/`)

`continue` starts a learning session; there is one kind of session. It hands focus to the hidden input in its click handler; the input keeps focus for the whole session, so a phone keeps its on-screen keyboard open.

- **Learning session** — up to 30 tasks. The knowledge model chooses each task when it is shown: a review of a due kana, a learning kana whose step has passed, an introduction of the next kana, or a learning kana whose step has not passed. A task on a learning kana is recognition one time in four and recall otherwise; a review is always recall. The session ends early, with its summary, when the model has nothing to offer.
- No session timer: no clock, no countdown, no answer time during a task.
- A session cannot be resumed. Leaving keeps every recorded answer (state is written after each answer) but loses the summary.
- From P10 the kana sounds after each task. There is no sound UI on the task screen — no button, no indicator — only the setting in `/settings`. A task never waits for the sound.
- The task types of later phases (P9, P10, P12) take the place of the prompt under the session line and its ticks (decision 152).

Layout (`KanaTask`), top to bottom: the session line `learning · 7 of 30` / `обучение · 7 из 30` (`mono-small`; numbers `fur`) with `leave session` / `выйти` on the right (back to `/`, no confirmation); under it a 2px tick per task of the session — done `fur-dim`, current `eye`, the rest `line-strong`, a task answered with an error `miss` (decision 149); the prompt; four options (recognition); one reserved notice line; the hint line. Navigation and footer are not rendered during a session; they return on the summary. The tasks, their feedback and the phone layout over the on-screen keyboard are described in the `KanaTask` and `OptionCard` READMEs.

Feedback: recall without an error — the kana in `fur` for 400ms; with an error — `miss` + `miss-dim` underline for 400ms; recognition correct — `is-correct` for 400ms; wrong — `is-wrong`, the right one `is-reveal`, then wait for `Enter`, `Space` or a click. 400ms is a hold (the engine's constant), not an animation. Keys pressed before the next task appears are ignored.

Strictness is set in `/settings`: `relaxed` (default) accepts `si` for し and `tu` for つ; `strict IME` accepts only what a Japanese IME accepts.

## Session summary

After the last task of a learning session. A lazy chunk: while it loads — `loading…` / `загрузка…`; on failure — `failed to load. check the connection and try again.` / `не удалось загрузить. проверьте соединение.` with `retry`. `continue` works in both states. Navigation and footer are back; `learn` is the open page.

Title `session summary` / `итог сессии` (`ui-heading`). Then, decision 148:

1. **The forecast change** of the current row, as medians: `the whole m row opens in about` / `весь ряд m откроется примерно через` (`ui-caption`, `fur-dim`), under it `3 → 2 sessions` / `3 → 2 сессии` — the numbers in `mono-stat`, the before and the arrow `fur-dim`, the unit `mono-romaji`. A screen reader reads `before the session: 3, now: 2 sessions`. A row opened in the session first says `the m row is fully open` / `ряд m открыт целиком`, then the next row's forecast; no forecast before the session — only the after; no forecast now — `no forecast for the m row yet`; the track open — `every hiragana is open`; while it computes, the place keeps its height. A forecast that grew carries no colour and no words. This one comparison shows medians (ADR 108); `/` keeps the range.
2. **What changed**, in sections — an empty one is not shown; titles in `ui-caption`, `fur-dim`; separated by spacing, no cards. Every kana is a button that opens its details.

| section | content | example |
| --- | --- | --- |
| `new` / `новые`, `learned` / `выучены` | table cells under the two captions, filled with the kana's state now (as "since the last session" on `/`) | み · ま ぬ |
| `faster` / `быстрее`, `slower` / `медленнее` | only kana with 10 recall answers at the start; the median of the last 10 answers at the start → at the end; changes from 100ms, at most 5 each way, largest first. Kana `jp-body`, times `mono-romaji`, the difference apart in `fur-dim` with `−` (U+2212) or `+` | `ぬ 1720 → 1380 ms  −340` |
| `confused` / `путаницы` | kana picked instead of the right one in recognition, and kana typed with errors in recall | `ぬ → め` picked instead / выбрана вместо; `ね ち` typed with errors / с ошибками |

Faster and slower carry no colour: no green, and `miss` is for errors only. If every section is empty — one line: `no changes in this session. your answers are saved.` / `изменений нет. ответы сохранены.`

Actions: `continue` / `продолжить` — `primary`, `lg`, `Kbd enter`; starts a new learning session. `home` / `на главную` — `secondary`, `lg`; back to `/`. **Nothing left to do:** no `continue`; the line `nothing to review now · next review: tomorrow at 9:15` and `home` as the primary action (`Kbd enter`). `Enter` = the primary action wherever focus is, except a link, a control or a dialog. No cat, no praise.

## Keyboard

Every screen can be completed with the keyboard alone.

- `Tab` is never intercepted.
- `Esc` in recall — shows the romaji; counts as an error.
- `1`–`4` — the option in recognition, from the number row and from the numeric keypad (`Digit1`–`4`, `Numpad1`–`4`).
- `Enter` or `Space` after a wrong choice — on to the next task.
- `Enter` on the session summary — its primary action (`continue`, or `home` when nothing is left to do), wherever focus is, except a link, a control or a dialog.
- `Enter` or `Space` on a kana of the table, of "since the last session" or of the summary opens its details; `Esc` closes them and the focus returns to the kana.
- Keys pressed during the 400ms hold after an answer are ignored.
- Under `pointer: coarse` the on-screen keyboard has no `Esc`: recall shows a `show the romaji` / `показать ромадзи` text button instead; the option cards show no key numbers.
- Typing during a task while focus is outside the field returns focus to the field and counts the character.

The interface labels every key in this list with `Kbd` or `hint`.

## Later phases

A state of a later phase is drawn only when a brief asks for it, switched off and named with its phase (decision 152). Every screen preview of P8 has a `later` select in its preview strip: `P8 · as shipped` (the default: what the app shows), one of P9–P12, or all of them. The phase then turns its element on without redrawing the screen. Small elements of existing screens are sketched in their place and size; a new task type is only a place — a dashed box (`line-strong`, `radius-sm`) with its phase, its name and one line. Texts of mnemonics and words in the previews are samples.

| phase | where | what |
| --- | --- | --- |
| P9 | kana details | the place of the stroke order (112px; 88px below 640px), left of the mnemonic |
| P9 | session | after an error the notice line says what tells the kana apart: `ぬ, not め: ぬ ends with a loop · it comes back later in this session` / `ぬ, а не め: у ぬ петля на конце · ещё раз — позже в этой сессии`; places of contrast, hiragana → katakana, build, the fluency run |
| P10 | kana details | `listen` / `послушать` (`secondary`, `sm`) |
| P10 | session, `/settings` | places of listening, dictation and minimal pairs; the `kana sound` setting (decision 151) |
| P11 | `/` | on the first visit, in the place of the action: `Do you already know some kana?` / `Вы уже знаете какие-нибудь каны?`, `start from zero` / `начать с нуля` (`primary`, `Kbd enter`) and `take the test` / `пройти тест`, then `The test goes row by row and stops at the rows you do not know yet.` / `Тест идёт по рядам и останавливается на рядах, которых вы ещё не знаете.` (`ui-caption`) |
| P11 | `/progress` | under the table: `Know more than the chart shows? A row-by-row test marks the kana you know.` / `Знаете больше, чем показывает таблица? Тест по рядам отметит знакомые каны.` with `take the test` |
| P11 | kana details, session | the mnemonic, one or two lines of `ui-body`: in the details over the rows, on an introduction in the notice line |
| P12 | `/` | `words you can read now` / `слова, которые уже можно прочитать` with their count, under "since the last session": the words in `jp-body`, the first 12, then `and 22 more` / `и ещё 22` |
| P12 | summary, session | `new words you can read` / `новые слова, которые можно прочитать` after `new · learned`; the place of a word task, from which the report dialog opens |

## Cat

One style — `geometry`. She appears in four places: the logo and favicon; empty states (`sleep`); `/` with nothing to do (`sleep`, over the reason; decision 154); 404 (`neutral`; drawn twice: the app's screen and the static `404.html` that Pages serves for unknown paths, ADR 077). She is not on a learning task, not on `/` in any other state and not on `/about`. Two moods are drawn and wait for a place: `content` (closed, smiling eyes; decision 136) and `grumpy` (half-closed eyes) — an error or a failure (decision 98).

## Prohibitions

- Japanese decoration: sakura, torii, Fuji, waves, the red circle, maneki-neko, kanji as ornament, paper textures. No kanji at all.
- Gradients, glassmorphism, glow, shadows under blocks, radii of 8px and more, sparkle icons, emoji, hero blocks, confetti, shimmering skeletons, pulsing loaders.
- Cards for the sake of cards: borders and fills instead of spacing.
- A second accent colour, green for "correct", colour-coded judgement of results, praise for a correct answer, celebrating a new kana.
- Animating anything other than `transform` and `opacity`; colour transitions on the hot path.
- Decorative elements without a function.

## Iconography

One icon, from the code (ADR 055): `reset` (reset progress). Linear SVG on a 24 grid, stroke 2, round caps, colour inherited from the text, drawn at `space-4` next to a label — never alone. Everything else is text: navigation and actions are words, keys are `Kbd`, pagination arrows are the characters `←` `→`. A new icon follows the same rules and is recorded in decisions.md.
