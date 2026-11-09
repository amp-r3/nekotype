Nekotype teaches hiragana and katakana from scratch, one kana at a time, and shows how fast and how reliably you recall each one. Typing Japanese words and phrases in romaji is the second part of the product. There is no kanji in any form.

The product's symbol is a white fluffy cat with blue eyes, and the palette comes from her: the fur is the text, the eyes are the only accent, the night around her is the background.

## Principles

1. **The kana is the hero.** On any screen with kana, the largest and highest-contrast element is the kana of the task or of the text stream. During a typing test, navigation and the config bar step back (see "Test screen"). During a learning task, the screen holds only what the task needs (defined with the learning session).
2. **One accent.** `eye` marks "where you are now": the caret, the romaji buffer, the counter, the selected item (segments, the track switch), focus, the revealed romaji, the personal best badge and the mastered-kana mark. It never fills an area larger than a switch knob. The due mark is not `eye`.
3. **Structure through spacing.** Blocks are separated by `space-12` or more, not by cards, borders or fills. A line appears only where groups would otherwise run together (table rows). Exceptions with a surface: fields, dialogs and the kana table's details panel (`bg-raised`, decision 94).
4. **Nothing without a function.** Every element either shows a state or performs an action. There is no confetti, no colour-coded judgement of results, no praise for a correct answer, and unlocking a kana is not celebrated: progress shows as state, not as words.

## Tone and copy

- The interface is in English and Russian. Every string, including `aria-label`, comes from i18n; components take strings through `labels`. Examples in this system come in pairs: `next test` / `новый тест`.
- Lower case in buttons, segments, navigation and metric labels — in both languages: `continue` / `продолжить`, `kana accuracy` / `точность по кане`. Screen titles take a capital: `Settings` / `Настройки`.
- Russian strings are 20–30% longer, so no width is ever fixed to fit text — only padding.
- Calm and short, no exclamation marks, no praise: `No results yet` / `Пока нет результатов`, `test ended: 5 seconds without input` / `тест завершён: 5 секунд без ввода`. No emoji in the interface.
- Descriptions address the user politely (Russian «вы»); labels are impersonal.
- Numbers up to 10 000 are written without a separator (`1050 ms` / `1050 мс`): the subsets have no non-breaking spaces.
- Keys go through `Kbd`, in lower case: `tab`, `enter`, `esc`, `ctrl + enter`.

## Colour

One theme — dark (`dark`). Every colour is a token; pages define no colours of their own, so themes can be added without changing the structure.

- Background: `bg` (page) → `bg-raised` (fields, dialogs, switch track, the kana details panel) → `bg-hover` (hover). `scrim` sits under a modal dialog.
- Lines: `line` — decorative divider; `line-strong` — control boundary and learning kana (≥ 3:1).
- Text: `fur` (main, correctly typed, the kana of a learning task) → `fur-dim` (secondary, translation, placeholders, live indicators, loading) → `untyped` (not typed yet, ghost hint — only ≥ 24px) → `fur-faint` (disabled and locked only).
- Error — `miss`, the underline under an error — `miss-dim`. `miss` means only an error or a blocked action. There is no green in the system.

Character states in the text stream:

| what | token |
| --- | --- |
| not typed yet | `untyped` |
| correct | `fur` |
| error | `miss` + `miss-dim` underline |
| current position | `eye` caret |
| skip token (`、。` inside a phrase) once passed | `fur-dim` |
| rejected key | caret flashes `miss` for `dur-reject` |
| revealed romaji (line under the stream) | `eye` |

Kana table states (`KanaChart mode="state"`):

| state | marker | contrast |
| --- | --- | --- |
| locked | no border, no fill, `fur-faint` kana | 2.78:1 — disabled, exempt |
| learning | `line-strong` border | kana 13.82:1, border 3.31:1 |
| confident | `heat-fur-3` fill | kana `fur` 5.28:1 |
| mastered | `heat-fur-4` fill + 2px `eye` mark under the cell | kana `on-fur` 6.10:1, mark 9.47:1 |

Over confident or mastered a kana can carry the **review due** mark — a folded corner in the cell's ink (5.28:1 on confident, 6.10:1 on mastered). It is a mark, not a fifth state: learning and locked kana never carry it.

- Charts: one line `chart-kpm`, grid `chart-grid`, cursor `chart-cursor` — on `/stats` only.
- `heat-miss-1…5` and `heat-fur-1, 2, 5` are not used in the MVP (heatmaps are out, ADR 058); they stay in the token set.
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

**Other glyphs outside the subsets** — `↑ ↓ ✓ ≤ ≥ ± Δ`, `！ ？` (phrase skip tokens), curly quotes `“ ” ‘ ’`: avoid them in interface strings. Any new glyph is named in decisions.md (which glyph, which font, why).

Styles:
- Learning task: `jp-solo` 72/96; below 640px `jp-solo-sm` 48/72.
- Typing stream: `jp-test` 48/72 (words, phrases); below 640px `jp-test-sm` 32/48.
- Kana in the interface: `jp-cell` 22/28 (one kana in a table cell), `jp-cell-sm` 18/24 (two-character kana in a 44px cell: きゃ, ティ), `jp-body` 16/28 (lists, mixups).
- Results: `mono-hero` 72 (KPM; `mono-hero-sm` 56 on a narrow screen) — one number per screen; `mono-stat` 32 — other metrics; `mono-counter` 24 — counter and ghost hint.
- Romaji: `mono-romaji` 16 (buffer, revealed romaji, numbers inside labels), `mono-small` 12 (live indicators, keys, axes, session progress `7 of 25`).
- Interface: `ui-title` 24 → `ui-heading` 17 → `ui-body` 15 → `ui-label` 14 → `ui-caption` 12. Weights 400 and 500 only.
- Vertical writing (`jp-vertical`, `VerticalLabel`) — not used in the MVP: mode labels come from i18n without Japanese (decision 85).

## Grid, spacing, shapes

- 4px step: `space-1` … `space-24`. Around the text stream — `space-24` on desktop and `space-8` on a phone; between sections — `space-12`.
- Centred column: content up to `layout-max` (1120), text stream `layout-test` (960). Page padding `space-8`, `space-4` on a narrow screen.
- Narrow screen — below `bp-narrow` (640px): `*-sm` styles, `test-lines-sm` (2) stream lines, config bar groups in a column, navigation in two rows, the kana table in one column.
- Touch targets under `pointer: coarse` — at least `touch-min` (44px).
- Radii: `radius-xs` (2) — caret, indicators, cells; `radius-sm` (4) — buttons, fields, tooltip; `radius-md` (6) — dialogs. Never more than 6px.
- Lines: `stroke-hair` (1px) — dividers and borders; `stroke-mark` (2px) — caret, selection indicator, mastered-kana mark, focus, KPM line. The caret and the selection mark are one and the same shape: this is the system's signature.
- No shadows. Layers differ by background lightness, the tooltip by inverted colour.
- New sizes, colours and durations exist only as tokens: the code generates classes from tokens alone.

## Motion

Micro-animations only, no springs or bounces. Only `transform` and `opacity` animate; a colour on the hot path changes instantly.

| what | duration | curve |
| --- | --- | --- |
| caret and buffer to the next character | `dur-caret` 90ms | `ease-out` |
| caret after a relayout (resize, fonts) | none — it snaps | — |
| rejected key: caret flash | `dur-reject` 120ms | `ease-in` |
| hover, focus, tooltip, Restart, `click to focus` | `dur-hover` 120ms | `ease-out` (leaving — `ease-in`) |
| typing chrome leaves/returns | `dur-fade` 200ms | `ease-in` / `ease-out` |
| result blocks, dialog | `dur-reveal` 240ms + `dur-stagger` 40ms | `ease-out`, 4px rise |
| chart line (`/stats`) | `dur-draw` 320ms | `ease-out` |
| caret blink while idle | `dur-blink` 1000ms | `ease-inout` |

The 400ms hold after an answer in a learning task is not motion: colours switch instantly and stay. Loading text does not pulse. Under `prefers-reduced-motion: reduce` there is no animation: durations are 0, the caret does not blink, the reject flash holds for 120ms without a transition. `/` has no animations, charts or new illustrations: it is in the initial JS chunk (32.67 of 35 KB gzip).

## Text stream performance

- A keystroke renders no components. `TestArea` renders once per prompt; the input engine calls the controller's methods (`createTestController`): `mark`, `moveTo`, `setBuffer`, `reject`, `setCounter`, `setLive`.
- States switch through `className`, the caret position through `transform` from a position cache. Layout is never read on the hot path.
- The cache is recalculated on `ResizeObserver` and `document.fonts.ready`. Porting to Preact: the controller moves as is, the component is rewritten in `shared/ui`.

## Test screen (`/type`)

| element | during a typing test |
| --- | --- |
| text stream, caret, counter | always; counter — time `42 s` / `42 с`, count `7 / 25`, zen the number of finished prompts |
| KPM and accuracy | next to the counter: `92 kpm · 94%`, `mono-small`, `fur-dim` |
| slot above the stream | reserved, one height: `loading vocabulary…` / `загрузка словаря…` or the load error with `retry`; hidden with the chrome during the test |
| translation, `source`, `report a problem` | under the stream, `fur-dim` (`TranslationLine`); two lines reserved. Setting off (ADR 056): the translation and `report a problem` go, the phrase `source` (Tatoeba attribution, required by the licence) stays |
| revealed romaji, layout and IME notices | one line under the stream, one at a time: `revealed: kotoba` / `ответ: kotoba` in `eye`, notices in `fur-dim` |
| bottom line | always: `Kbd` `esc` + `show the romaji` / `показать ромадзи` (a text button under `pointer: coarse`); reserved `click to focus` / `нажмите для ввода` |
| `finish` in zen | visible, after Restart in focus order, disabled until the first key, `ctrl + enter` / `⌘ + enter` |
| Restart | appears on `Tab` focus, on hover (hover devices), always under `pointer: coarse`; stays in the layout |
| repeat mark | only during a repeat: `repeat` / `повтор` in `fur-dim`, `mono-small`, `stroke-hair` outline, after KPM and accuracy |
| navigation, config bar, footer | hidden (see below) |

Chrome during a test (ADR 041, 055). Navigation, the config bar, the footer and the slot above the stream fade over `dur-fade`, then get `visibility: hidden` and leave the focus order. Their space is kept; nothing shifts. They return when the mouse moves more than 8px and stay until the next key. `Tab` and `Shift` do not hide them again, so navigation can be reached from the keyboard; any other key hides them. Every keystroke resets the mouse's reference point, so slow drift over a whole test shows nothing.

The input field belongs to the page (ADR 055). Restart, finish, next test and, from P3, continue and review hand focus to the hidden input inside their click handler — the only way a phone keeps its keyboard open — so they are always real buttons. `Enter` on results is `next test` wherever focus is, except on a link, a control or in a dialog.

Focus. When the hidden input loses focus but the window keeps it, `click to focus` appears in the bottom line (reserved space, `opacity` only). When the window loses focus, the stream dims and `return to the window to continue` / `вернитесь в окно` appears.

Stream lines (ADR 047, as changed after the v10 review). A word or phrase that fits a line is never broken; a line breaks between prompts. Only a prompt wider than the whole line (a long phrase on a phone) breaks inside — and only between tokens: a token is a kana with what belongs to it (`きょ`, `っ` + the next kana, a kana + `ー`, a kana + the punctuation after it, an opening bracket + the next kana). After every prompt there is a 0.35em gap — a margin, not a space character. Text leaves by whole lines; the caret line stays second from the bottom. After a relayout the caret snaps into place without a transition.

Loading and errors (ADR 046, 057). Typing results and the session summary are lazy chunks; `/type`, `/stats` and `/settings` are lazy routes. While a chunk loads, its place shows `loading…` / `загрузка…`; on failure `failed to load. check the connection and try again.` / `не удалось загрузить. проверьте соединение.` with a `retry` button. The primary button (`next test` or `continue`) and `Enter` work in both states.

## Typing results (lazy chunk)

Top to bottom: the end reason, if any (`Notice`: `test ended: 5 seconds without input` / `тест завершён: 5 секунд без ввода`, `test ended: the tab was hidden` / `тест завершён: вкладка была скрыта`; none after a manual zen finish); the mode line (`ui-caption`, from i18n via `modeLine`: `words · hiragana · relaxed · 60 s`, `phrases · hiragana · relaxed · 25` / `фразы · хирагана · мягкая · 25`, `words · hiragana · relaxed · zen`; no Japanese label) and KPM (`Stat size="hero"`, label `kpm`) with the comparisons `+8 vs average (84)` / `−9 vs personal best (101)` — number always `fur`; kana accuracy and time; `mistyped kana` / `каны с ошибками` (`WeakKanaList`); `next test` / `новый тест` (`primary`, `lg`, `Kbd enter`) and `repeat` / `повторить` (`secondary`, `lg`, no key).

A personal best adds `PersonalBestBadge`, the `content` cat and `+3 vs previous best (101)`. It is possible only for a test that ended normally (not by inactivity, a hidden tab or a manual zen finish), not a repeat, with kana accuracy ≥ 80%. The average: the last 10 tests with the same mode, repeats excluded, before this one; no earlier tests — no comparison. Not on the screen: per-second chart, IPM, keystroke accuracy, best streak, reaction time. Loading and error of the chunk — see "Loading and errors".

## Stats (`/stats`, lazy route)

Sections through `space-12`. **Learning:** current and best streak, mastered per track (`hiragana 7 of 104`), the daily median answer time (`ResultChart`, one track at a time via a switch, gaps for days without answers, the target answer time as a dashed line, `lower is better` / `меньше — лучше`). **Typing:** personal bests by "content · script · strictness · mode", `kpm per test` (repeats excluded), history (`HistoryTable` + `Pagination`). **Counters:** started / finished for learning sessions and typing tests. No heatmap, no mixups. A guest without data sees `EmptyState` (`sleep`) with one action to `/`.

## Settings (`/settings`)

Rows: label and consequence-description on the left, the control on the right (below 640px: the control under the text). **Learning:** `learning strictness` / `строгость в обучении` (`Segmented` relaxed / strict IME — a separate setting from the typing strictness in the `/type` config bar), target answer time (`Select`, 1000–3000 ms, step 250, default 1500). **Typing:** `show the translation under the text` (`Switch`, on). **Data:** a guest resets progress in this browser (`danger` → `Dialog`); a signed-in user resets learning on every device, typing statistics stay (`reset learning` / `сбросить обучение`, needs a connection — proposal, decision 91). **Account:** Google and GitHub sign-in (hidden on preview), profile, sync status in a `Notice` (`synced`, `pending`, `offline`, `session expired` + `sign in again`, blocked in `miss`), sign out (a `Dialog` only with unsent data), delete account (`Dialog`, disabled until the word is typed). Sound appears in P6.

## Learning home (`/`)

Top to bottom:

1. The track switch — `Segmented`: `hiragana` / `хирагана`, `katakana` / `катакана`. The choice is saved. On desktop the progress line sits on the same row, on the right: `mastered 7 of 104` / `освоено 7 из 104` · `streak: 6 days` / `серия: 6 дней` (numbers in `mono-romaji`, `fur`; the words `fur-dim`). Below 640px the two lines stack under the switch. The streak is shared by both tracks; it does not change when the track changes. Until the user's first answer the streak is not shown; after that a zero shows as it is: `streak: 0 days` / `серия: 0 дней`. Russian forms: `1 день`, `3 дня`, `6 дней`, `0 дней`.
2. First visit only — while the user has no answers: one line above the actions, `ui-body`, `fur-dim`, kana in `fur`, the kana never split across lines: `the first session introduces the vowels あ い う え お` / `первая сессия — гласные あ い う え お` (ア イ ウ エ オ on the katakana track).
3. Actions: `continue` / `продолжить` — `primary`, `lg`, the only primary on the screen; `review (5)` / `повторение (5)` — `secondary`, `lg`, disabled at 0. Both are disabled until the progress has loaded.
4. A reserved `Notice` line: while loading — `loading your progress…` / `загрузка прогресса…` (static); `progress cannot be saved in this browser` / `прогресс не сохраняется в этом браузере`; on a load error — `failed to load your progress. check the connection and try again.` / `не удалось загрузить прогресс. проверьте соединение.` in `miss` with `retry` / `ещё раз`.
5. The kana table of the selected track — `KanaChart mode="state"`, drawn once the progress has loaded. While loading the progress line keeps its height, so the actions do not move. On a desktop its blocks (basic · voiced · combinations · extended) stand side by side across the page width (`layout-max`), with the legend under them; below 640px they stack (decision 93). An activated cell opens its details panel under its row (decision 94).

Keyboard: no global keys on `/` (`Enter` on a table cell opens its details). When the screen is ready, `continue` takes focus, so `Enter` starts the session. `Tab` order: the track switch, `continue`, `review`, then into the table — one entry point, arrows inside; `Shift + Tab` from `continue` reaches the track switch.

## Learning session (`/`)

`continue` starts a learning session, `review (N)` a review session (ADR 058). Both hand focus to the hidden input in their click handler; it keeps focus for the whole session, so a phone keeps its on-screen keyboard open.

- **Learning session** — 25 tasks of the selected track. Every unlocked kana that has not been introduced gets an introduction task: at the start in table order, or as the next task if it unlocks during the session. An introduction is one of the 25. The rest: two thirds recall, one third recognition; weak and new kana (fewer than 10 recall answers) come up more often; the same kana never comes twice in a row if there is another.
- **Review session** — one recall task per due kana, at most 20, the most overdue first. Due means the table's due mark: confident or mastered and the review date has come; `review (N)` counts the marks (decision 95). Answers in a learning session move no boxes and no review dates.
- No session timer: no clock, no countdown, no answer time during a task.
- A session cannot be resumed. Leaving keeps every recorded answer (state is written after each answer) but loses the summary.
- From P6 the kana sounds after each task. There is no sound UI on the task screen — no button, no indicator — only the setting in `/settings`. A task never waits for the sound.

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

Every screen can be completed with the keyboard alone (acceptance P7).

- `tab → enter` — restart (`Tab` is not intercepted).
- `Esc` in a typing test — shows the romaji of the current prompt; counts as an error.
- `Esc` in recall — shows the romaji; counts as an error.
- `Ctrl/⌘ + Enter` — finish zen.
- `Enter` on typing results — next test, wherever focus is, except a link, a control or a dialog.
- `1`–`4` — the option in recognition, from the number row and from the numeric keypad (`Digit1`–`4`, `Numpad1`–`4`).
- `Enter` or `Space` after a wrong choice — on to the next task.
- `Enter` on the session summary — `continue`, wherever focus is, except a link, a control or a dialog.
- Keys pressed during the 400ms hold after an answer are ignored.
- Under `pointer: coarse` the on-screen keyboard has no `Esc`: recall and `/type` show a `show the romaji` / `показать ромадзи` text button instead; the option cards show no key numbers.
- Typing while focus is outside the field returns focus to the field and counts the character.

The interface labels every key in this list with `Kbd` or `hint`.

## Cat

One style — `geometry`. She appears in four places: the logo and favicon; empty states (`sleep`); typing results — only on a personal best (`content` next to `PersonalBestBadge`); 404 (`neutral`). She is not on the typing test screen, not on a learning task and not on `/`. The `line` and `silhouette` styles stay in the **Cat** asset group as an archive.

## Prohibitions

- Japanese decoration: sakura, torii, Fuji, waves, the red circle, maneki-neko, kanji as ornament, paper textures. No kanji at all.
- Gradients, glassmorphism, glow, shadows under blocks, radii of 8px and more, sparkle icons, emoji, hero blocks, confetti, shimmering skeletons, pulsing loaders.
- Cards for the sake of cards: borders and fills instead of spacing.
- A second accent colour, green for "correct", colour-coded judgement of results, praise for a correct answer, celebrating an unlock.
- Animating anything other than `transform` and `opacity`; colour transitions on the hot path.
- Decorative elements without a function.

## Iconography

Two icons, both from the code (ADR 055): `restart` (Restart) and `reset` (reset progress). Linear SVG on a 24 grid, stroke 2, round caps, colour inherited from the text, drawn at `space-4` next to a label — never alone. Everything else is text: navigation and actions are words, keys are `Kbd`, pagination arrows are the characters `←` `→`. A new icon follows the same rules and is recorded in decisions.md.
