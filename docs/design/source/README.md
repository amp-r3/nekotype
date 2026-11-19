Nekotype teaches hiragana and katakana from scratch, one kana at a time, and shows how fast and how reliably you recall each one. It is a learning app: the typing trainer is gone (ADR 093, decision 128), and words join learning in P10. There is no kanji in any form.

The product's symbol is a white fluffy cat with blue eyes, and the palette comes from her: the fur is the text, the eyes are the only accent, the night around her is the background.

## Principles

1. **The kana is the hero.** On any screen with kana, the largest and highest-contrast element is the kana of the task. During a learning task, the screen holds only what the task needs: navigation and the footer are not rendered (see "Learning session").
2. **One accent.** `eye` marks "where you are now": the caret, the romaji buffer, the counter, the selected item (segments, the track switch), focus, the revealed romaji and the mastered-kana mark. It never fills an area larger than a switch knob. The due mark is not `eye`.
3. **Structure through spacing.** Blocks are separated by `space-12` or more, not by cards, borders or fills. A line appears only where groups would otherwise run together (table rows). Exceptions with a surface: fields, dialogs and the kana table's details panel (`bg-raised`, decision 94).
4. **Nothing without a function.** Every element either shows a state or performs an action. There is no confetti, no colour-coded judgement of results, no praise for a correct answer, and unlocking a kana is not celebrated: progress shows as state, not as words.

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

- Background: `bg` (page) → `bg-raised` (fields, dialogs, switch track, the kana details panel) → `bg-hover` (hover). `scrim` sits under a modal dialog.
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

Kana table states (`KanaChart`):

| state | marker | contrast |
| --- | --- | --- |
| locked | no border, no fill, `fur-faint` kana | 2.78:1 — disabled, exempt |
| learning | `line-strong` border | kana 13.82:1, border 3.31:1 |
| confident | `heat-fur-3` fill | kana `fur` 5.28:1 |
| mastered | `heat-fur-4` fill + 2px `eye` mark under the cell | kana `on-fur` 6.10:1, mark 9.47:1 |

Over confident or mastered a kana can carry the **review due** mark — a folded corner in the cell's ink (5.28:1 on confident, 6.10:1 on mastered). It is a mark, not a fifth state: learning and locked kana never carry it.

- The chart (`/stats` only): day bars `heat-fur-3`, the median tick `chart-median`, grid `chart-grid`, cursor `chart-cursor`. One y scale.
- Heat scale (`/stats` only, decision 108): `heat-fur-1…5` — answers of a day in the activity map. A value is never colour alone: an empty cell is an outline, and the number is in the tooltip and the `aria-label`.
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
- Kana in the interface: `jp-test-sm` 32/48 (a recognition option, the kana table details panel), `jp-cell` 22/28 (one kana in a table cell), `jp-cell-sm` 18/24 (two-character kana in a 44px cell: きゃ, ティ), `jp-body` 16/28 (lists, mixups).
- Numbers and prompts: `mono-hero` 72 (the romaji prompt of recognition, the current streak on `/stats`; `mono-hero-sm` 56 on a narrow screen) — one per screen; `mono-stat` 32 — the `Stat` numbers of `/stats`; `mono-counter` 24 — the ghost hint.
- Romaji: `mono-romaji` 16 (buffer, revealed romaji, numbers inside labels), `mono-small` 12 (keys, axes, session progress `7 of 25`).
- Interface: `ui-title` 24 → `ui-heading` 17 → `ui-body` 15 → `ui-label` 14 → `ui-caption` 12. Weights 400 and 500 only.

## Grid, spacing, shapes

- 4px step: `space-1` … `space-24`. Between the blocks of a screen — `space-12` (`space-8` below 640px).
- Centred column: content up to `layout-max` (1120); a learning task up to 640px. Page padding `space-8`, `space-4` on a narrow screen.
- Narrow screen — below `bp-narrow` (640px): `*-sm` styles, a settings control under its text, navigation in two rows, the kana table in one column.
- Touch targets under `pointer: coarse` — at least `touch-min` (44px).
- Radii: `radius-xs` (2) — caret, indicators, cells; `radius-sm` (4) — buttons, fields, tooltip; `radius-md` (6) — dialogs. Never more than 6px.
- Lines: `stroke-hair` (1px) — dividers and borders; `stroke-mark` (2px) — caret, selection indicator, mastered-kana mark, focus. The caret and the selection mark are one and the same shape: this is the system's signature.
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

The 400ms hold after an answer in a learning task is not motion: colours switch instantly and stay. Loading text does not pulse. Under `prefers-reduced-motion: reduce` there is no animation: durations are 0, the reject flash holds for 120ms without a transition. The caret does not blink (the idle blink was the typing stream's, decision 128). `/` has no animations, charts or new illustrations: it is in the initial JS chunk (32.67 of 35 KB gzip).

## Stats (`/stats`, lazy route)

One section: learning (decision 130). There is no section switch, and `/stats#typing` opens the same page. Levels: the screen title (`ui-title`), block titles (`ui-heading`), captions (`ui-caption`, `fur-dim`). Blocks are `space-12` apart (`space-8` below 640px); a block's title, caption, controls and content are `space-4` apart. No lines, no cards.

**A fixed grid** (decision 137). The page stands on four equal columns across `layout-max` (two below 640px), `space-12` apart. Every block takes whole columns, so its width comes from the screen, never from the data: a short history leaves no unpredictable empty space, only empty cells inside a frame of fixed size.

Under the title `Stats` / `Статистика`, top to bottom:

1. **`streak and activity` / `серия и активность`**, caption `fill: answers of the day · dot: a day of the current streak` / `заливка: ответы за день · точка: день текущей серии`. Column 1 is the streak: `current streak` / `текущая серия` (`ui-caption`), the number in `mono-hero` (`mono-hero-sm` below 640px), `days in a row` / `дней подряд` (`ui-label`, `fur-dim`), then two `ui-label` lines with the numbers in `mono-romaji` `fur`: `best: 15 days` / `лучшая: 15 дней` and `active days in the last 30: 21` / `активных дней за последние 30: 21` (a fixed window, so the number never depends on how many weeks the map shows). Columns 2–4 hold the `ActivityMap`, which fills them: up to 26 weeks, cells up to 28px; the days of the current streak carry a dot. Below 640px the streak is one row — the number on the left, the two lines on the right — and the map takes the full width under it.
2. **The totals:** four `Stat`s, one per column (two by two below 640px) — `mastered · hiragana` `7` `of 104`, `mastered · katakana` `0` `of 125`, `sessions started` / `сессий начато` `41`, `sessions finished` / `сессий закончено` `36`. Both tracks always, nothing switches them.
3. **`answer time` / `время ответа`** across all four columns (`ResultChart`: one bar per day, the target line, `lower is better`).

The track switch belongs to `answer time` only (decision 102): it is the first control under that block's title and caption, at the left, followed by the period (`7 days` · `30 days` · `all` / `7 дней` · `30 дней` · `всё`; 30 by default). It is drawn only when both tracks have answers; with one track the caption starts with its name (`hiragana · median recall answer time of a day, ms…`) and there is no switch. A period without answers: `no answers in this period` / `за этот период ответов нет` with `show all time` / `показать всё время`.

**Before the first answer** (decision 130). No answer and no started session: one `EmptyState` (`sleep`) under the title — `No answers yet` / `Ответов пока нет`, `Finish a learning session: the streak, the activity and the answer times will appear here.` / `Закончите сессию обучения: здесь появятся серия, активность и время ответа.`, one action `to learning` / `к обучению` (`primary`, to `/`). No zeros and no controls over nothing. While the data loads the place under the title holds `loading…` / `загрузка…`; on failure the error with `retry`.

Keyboard: `Tab` goes through the activity map (one stop, arrows inside), the controls of `answer time` and the chart (one stop: ← → `Home` `End` between bars, `Esc`). No global keys. No mixups on this screen.

## Settings (`/settings`)

Rows: label and consequence-description on the left, the control on the right (below 640px: the control under the text). Three sections (decision 131):

- **Learning:** `learning strictness` / `строгость в обучении` (`Segmented` relaxed / strict IME; relaxed accepts `si` for し and `tu` for つ, strict IME accepts only what a Japanese IME accepts), target answer time (`Select`, 1000–3000 ms, step 250, default 1500). Sound appears in P8.
- **Data:** a guest resets progress in this browser (`danger` → `Dialog`): the hint `Erases learning progress stored in this browser.` / `Стирает прогресс обучения в этом браузере.`; the dialog `Learning progress in this browser will be erased. This cannot be undone.` / `Прогресс обучения в этом браузере будет стёрт. Это нельзя отменить.` A signed-in user's `reset learning` on every device stays deferred to v1.1 (decision 91, spec decision A45).
- **Account:** Google and GitHub sign-in (hidden on preview), profile, sync status in a `Notice` (`synced`, `pending`, `offline`, `session expired` + `sign in again`, blocked in `miss`), sign out (a `Dialog` only with unsent data: `Some progress has not been sent yet. If you sign out now, it will be lost.`, decision 133), delete account (`Dialog`, disabled until the word is typed; `Your account and learning progress will be deleted on every device.` / `Аккаунт и прогресс обучения будут удалены на всех устройствах.`).

Account details (decisions 121–123). The profile is the cat mark, one name line and `via GitHub` / `через GitHub` or `via Google` / `через Google`; no avatar image. The name line is the display name; without one, the email (it wraps, it is never cut); without both, `account` / `аккаунт`. `sign out` and `delete account` need the server. Offline both are disabled and one `ui-caption` `fur-dim` line under them says `Needs a connection.` / `Нужна сеть.` With an expired session `sign out` works (the dialog about unsent data as usual) and `delete account` is disabled with `Sign in again to delete the account.` / `Войдите снова, чтобы удалить аккаунт.` The line's place is reserved. While the account is being deleted the dialog's field and both actions are disabled, the button reads `deleting…` / `удаление…` and the dialog cannot be closed; a failure shows in the dialog's reserved `Notice` line in `miss`. While the session is expired the navigation shows `sign in again` / `войти снова` on every screen (decision 120).

## About (`/about`, lazy route)

Reached only from the `Footer` link `about` / `о проекте`. Title `About` / `О проекте`, then one section (decision 132):

**Nekotype**, rows separated by `line`: `code` / `код` — AGPL-3.0-only, under it `Copyright (C) 2026 amp-r3 · source code: github.com/amp-r3/nekotype` (the link is the offer of the source, AGPL section 13); `name, logos and cat` / `название, логотипы и кошка` — `all rights reserved` / `все права защищены` (plain text, `fur-dim`); `fonts` / `шрифты` — OFL-1.1, under it Golos Text, JetBrains Mono, Noto Sans JP. A row: the name (`ui-label`) on the left, the licence as a link to its text on the right, the holder under both (`ui-caption`, `fur-dim`).

Reserved, not rendered: *Kana audio* / *Звук каны* — P8 (the recordings, their author and licence); *Data on this device* / *Данные на устройстве* — P12 (what is stored in the browser and, after sign-in, on the server; how to erase it). Sources and licences of words and phrases, and the phrase authors, come back with the phase that ships content (P10). They use the same rows.

No lazy content chunk, no cat, no primary button, no global keys. Keyboard: `Tab` goes through the licence links, the source code link and the footer.

## Loading and errors

Loading and errors (ADR 046, 057). The session summary is a lazy chunk; `/stats`, `/settings` and `/about` are lazy routes. While a chunk loads, its place shows `loading…` / `загрузка…`; on failure `failed to load. check the connection and try again.` / `не удалось загрузить. проверьте соединение.` with a `retry` button. The primary button (`continue`) and `Enter` work in both states; a screen without a primary button (`/about`) keeps its title.

## Learning home (`/`)

Top to bottom:

1. The track switch — `Segmented`: `hiragana` / `хирагана`, `katakana` / `катакана`. The choice is saved. On desktop the progress line sits on the same row, on the right: `mastered 7 of 104` / `освоено 7 из 104` · `streak: 6 days` / `серия: 6 дней` (numbers in `mono-romaji`, `fur`; the words `fur-dim`). Below 640px the two lines stack under the switch. The streak is shared by both tracks; it does not change when the track changes. Until the user's first answer the streak is not shown; after that a zero shows as it is: `streak: 0 days` / `серия: 0 дней`. Russian forms: `1 день`, `3 дня`, `6 дней`, `0 дней`.
2. First visit only — while the user has no answers: one line above the actions, `ui-body`, `fur-dim`, kana in `fur`, the kana never split across lines: `the first session introduces the vowels あ い う え お` / `первая сессия — гласные あ い う え お` (ア イ ウ エ オ on the katakana track).
3. Actions: `continue` / `продолжить` — `primary`, `lg`, the only primary on the screen; `review (5)` / `повторение (5)` — `secondary`, `lg`, disabled at 0. Both are disabled until the progress has loaded.
4. A reserved `Notice` line: while loading — `loading your progress…` / `загрузка прогресса…` (static); `progress cannot be saved in this browser` / `прогресс не сохраняется в этом браузере`; on a load error — `failed to load your progress. check the connection and try again.` / `не удалось загрузить прогресс. проверьте соединение.` in `miss` with `retry` / `ещё раз`; after a sign-in that did not finish (decision 119) — `sign-in was cancelled` / `вход отменён`, or in `miss` `sign-in failed. try again in settings.` / `вход не удался. повторите в настройках.`, until the next navigation. One at a time, in this order: the load error, storage unavailable, the sign-in notice.
5. The kana table of the selected track — `KanaChart mode="state"`, drawn once the progress has loaded. While loading the progress line keeps its height, so the actions do not move. On a desktop its blocks (basic · voiced · combinations · extended) stand side by side across the page width (`layout-max`), with the legend under them; below 640px they stack (decision 93). An activated cell opens its details panel under its row (decision 94).

Signing in to another account (decision 118). When a sign-in returns as a different user and the device holds unsent data of the previous account, a `Dialog` opens on `/` before anything of either account is shown: `Sign in to another account?` / `Войти в другой аккаунт?`, with `cancel` (focused; `Esc` and `✕` do the same) and `discard and continue` / `удалить и продолжить` (`danger`). Behind it the screen is in its loading state.

Keyboard: no global keys on `/` (`Enter` on a table cell opens its details). When the screen is ready, `continue` takes focus, so `Enter` starts the session. `Tab` order: the track switch, `continue`, `review`, then into the table — one entry point, arrows inside; `Shift + Tab` from `continue` reaches the track switch.

## Learning session (`/`)

`continue` starts a learning session, `review (N)` a review session (ADR 058). Both hand focus to the hidden input in their click handler; it keeps focus for the whole session, so a phone keeps its on-screen keyboard open.

- **Learning session** — 25 tasks of the selected track. Every unlocked kana that has not been introduced gets an introduction task: at the start in table order, or as the next task if it unlocks during the session. An introduction is one of the 25. The rest: two thirds recall, one third recognition; weak and new kana (fewer than 10 recall answers) come up more often; the same kana never comes twice in a row if there is another.
- **Review session** — one recall task per due kana, at most 20, the most overdue first. Due means the table's due mark: confident or mastered and the review date has come; `review (N)` counts the marks (decision 95). Answers in a learning session move no boxes and no review dates.
- No session timer: no clock, no countdown, no answer time during a task.
- A session cannot be resumed. Leaving keeps every recorded answer (state is written after each answer) but loses the summary.
- From P8 the kana sounds after each task. There is no sound UI on the task screen — no button, no indicator — only the setting in `/settings`. A task never waits for the sound.

Layout (`KanaTask`), top to bottom: the session line `learning · 7 of 25` / `обучение · 7 из 25` (`mono-small`; numbers `fur`) with `leave session` / `выйти` on the right (back to `/`, no confirmation); the prompt; four options (recognition); one reserved notice line; the hint line. Navigation and footer are not rendered during a session; they return on the summary. The tasks, their feedback and the phone layout over the on-screen keyboard are described in the `KanaTask` and `OptionCard` READMEs.

Feedback: recall without an error — the kana in `fur` for 400ms; with an error — `miss` + `miss-dim` underline for 400ms; recognition correct — `is-correct` for 400ms; wrong — `is-wrong`, the right one `is-reveal`, then wait for `Enter`, `Space` or a click. 400ms is a hold (the engine's constant), not an animation. Keys pressed before the next task appears are ignored.

Strictness is set in `/settings`: `relaxed` (default) accepts `si` for し and `tu` for つ; `strict IME` accepts only what a Japanese IME accepts.

## Session summary

After the last task of a learning or review session. A lazy chunk: while it loads — `loading…` / `загрузка…`; on failure — `failed to load. check the connection and try again.` / `не удалось загрузить. проверьте соединение.` with `retry`. `continue` works in both states. Navigation and footer are back.

Title `session summary` / `итог сессии` (`ui-heading`). Sections — an empty one is not shown; titles in `ui-caption`, `fur-dim`; separated by spacing, no cards:

| section | content | example |
| --- | --- | --- |
| `unlocked` / `открыты` | kana unlocked in the session, `jp-cell` | み |
| `now confident` / `стали уверенными` | not confident at the start, confident at the end | ま ぬ |
| `faster` / `быстрее`, `slower` / `медленнее` | only kana with 10 recall answers at the start; the median of the last 10 answers at the start → at the end; changes from 100ms, at most 5 each way, largest first. Kana `jp-body`, times `mono-romaji`, the difference apart in `fur-dim` with `−` (U+2212) or `+` | `ぬ 1720 → 1380 ms  −340` |
| `confused` / `путаницы` | kana picked instead of the right one in recognition, and kana typed with errors in recall | `ぬ → め` picked instead / выбрана вместо; `ね ち` typed with errors / с ошибками |

Faster and slower carry no colour: no green, and `miss` is for errors only. If every section is empty — one line: `no changes in this session. your answers are saved.` / `изменений нет. ответы сохранены.`

Actions: `continue` / `продолжить` — `primary`, `lg`, `Kbd enter`; starts a new learning session. `to the table` / `к таблице` — `secondary`, `lg`; back to the kana table on `/` (the `learn` link goes to the same address but does not read as a way out). `Enter` = `continue` wherever focus is, except a link, a control or a dialog. No cat, no praise.

## Keyboard

Every screen can be completed with the keyboard alone.

- `Tab` is never intercepted.
- `Esc` in recall — shows the romaji; counts as an error.
- `1`–`4` — the option in recognition, from the number row and from the numeric keypad (`Digit1`–`4`, `Numpad1`–`4`).
- `Enter` or `Space` after a wrong choice — on to the next task.
- `Enter` on the session summary — `continue`, wherever focus is, except a link, a control or a dialog.
- Keys pressed during the 400ms hold after an answer are ignored.
- Under `pointer: coarse` the on-screen keyboard has no `Esc`: recall shows a `show the romaji` / `показать ромадзи` text button instead; the option cards show no key numbers.
- Typing during a task while focus is outside the field returns focus to the field and counts the character.

The interface labels every key in this list with `Kbd` or `hint`.

## Cat

One style — `geometry`. She appears in three places: the logo and favicon; empty states (`sleep`); 404 (`neutral`; drawn twice: the app's screen and the static `404.html` that Pages serves for unknown paths, ADR 077). She is not on a learning task, not on `/` and not on `/about`. Two moods are drawn and wait for a place: `content` (closed, smiling eyes), whose only place was a typing personal best (decision 136), and `grumpy` (half-closed eyes) — an error or a failure (decision 98).

## Prohibitions

- Japanese decoration: sakura, torii, Fuji, waves, the red circle, maneki-neko, kanji as ornament, paper textures. No kanji at all.
- Gradients, glassmorphism, glow, shadows under blocks, radii of 8px and more, sparkle icons, emoji, hero blocks, confetti, shimmering skeletons, pulsing loaders.
- Cards for the sake of cards: borders and fills instead of spacing.
- A second accent colour, green for "correct", colour-coded judgement of results, praise for a correct answer, celebrating an unlock.
- Animating anything other than `transform` and `opacity`; colour transitions on the hot path.
- Decorative elements without a function.

## Iconography

One icon, from the code (ADR 055): `reset` (reset progress); `restart` left with the typing trainer (decision 128). Linear SVG on a 24 grid, stroke 2, round caps, colour inherited from the text, drawn at `space-4` next to a label — never alone. Everything else is text: navigation and actions are words, keys are `Kbd`, pagination arrows are the characters `←` `→`. A new icon follows the same rules and is recorded in decisions.md.
