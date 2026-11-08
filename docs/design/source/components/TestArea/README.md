# TestArea

The typing test's text stream (`/type`): kana, caret, romaji buffer, counter, live indicators and the bottom line. Renders once per prompt; every keystroke goes through the controller, without renders.

Learning tasks (introduction, recall, recognition) are not `TestArea`: they use `KanaTask`, which keeps the same controller approach for one centred kana. `mode="kana"` stays for the record and is not used.

**The consumer provides:** `words` (prompts in kana), `mode` (`words` · `phrase` — ADR 058 removed the kana mode; `jp-solo` belongs to learning tasks), the initial `counter` and its static `counterSuffix`, `labels` from i18n. The input engine gets the controller from `onReady` and calls only its methods on every keystroke.

**The controller (`createTestController`)** — framework-free; move it to `shared/ui` almost as is:
- `mark(i, state)` — the character's `className`; colour changes instantly (no transition).
- `moveTo(i)` — caret through `transform`, positions come from the cache; passed skip tokens get `is-done`.
- `setBuffer(s)` — the remainder of `engine.view()` under the caret. The buffer does not move the text and is clamped to the right edge of the line.
- `reject()` — rejected key: the caret layer flashes `miss` for `dur-reject` (WAAPI, `opacity` only). Under `prefers-reduced-motion` — no smooth transition.
- `setCounter`, `setLive(kpm, acc)` — `textContent` only.
- `setInputFocus(on)` — the page's hidden input lost focus while the window kept it: shows `click to focus` / `нажмите для ввода`. Called on focus events, never per key.
- Character positions are cached after layout and recalculated on `ResizeObserver` and `document.fonts.ready`. After a relayout the caret snaps into place without a transition (ADR 047). No layout read on the hot path.

**Rules**
- Typed text — `fur`, error — `miss` with a `miss-dim` underline, future text — `untyped`, the current position is the `eye` caret. Punctuation inside a phrase (`、。・` etc.) is a skip token: the caret passes it without input; once passed it is `fur-dim`.
- Lines (ADR 047, as changed after the v10 review): a word or phrase that fits a line is never broken — each prompt is one run (`.nk-prompt`) and a line breaks between prompts. A prompt wider than the whole line (a long phrase at 360px) gets `is-long` in `measure()` and breaks between tokens only: chars are grouped into tokens (`.nk-tok`, never broken) — `きょ`, `っ` + the next kana, a kana + `ー`, a kana + the punctuation after it, an opening bracket + the next kana. The check runs on relayout, never on a keystroke. After every prompt there is a 0.35em gap; it is a margin, not a space character. Text leaves by whole lines; the caret line stays second from the bottom; scrolling is instant.
- Sizes: at width ≥ 640 — `jp-test` (3 lines); narrower — `jp-test-sm` (2 lines), buffer in `mono-small`.
- Visible window: height = lines × line height + room for the buffer.
- Live line: the counter (`mono-counter`, number in `eye`, unit in `fur-dim`) — time `42 s` / `42 с`, count `7 / 25`, zen the number of finished prompts; then KPM and accuracy `92 kpm · 94%` (`mono-small`, `fur-dim`); during a repeat the `repeat` mark. Strictness is not shown. `·` in Mono is on "Glyphs to add to subsets".
- Repeat (ADR 033): `repeat` puts a `repeat` / `повтор` mark (`labels.repeat`) after the indicators: `fur-dim`, `mono-small`, `stroke-hair` outline, `radius-xs`. Static, set once per test; the controller has no method for it. Red is not used: next to accuracy it reads as an error.
- Bottom line (`hints`, on by default): the permanent hint — `Kbd` `esc` + `show the romaji` / `показать ромадзи` (one string with recall); under `pointer: coarse` a `show the romaji` text button (`onShow`) instead, since an on-screen keyboard has no Esc — and the reserved `click to focus` / `нажмите для ввода` caption (`ui-caption`, `fur-dim`), which appears through `opacity` only.
- Blur (`is-blurred`) turns on only when the window loses focus. Focus on Restart or a link does not interrupt the test.
- Do not add: colour transitions, shake, fills, borders, green.

**Strings (en / ru):** `return to the window to continue` / `вернитесь в окно` · `show the romaji` / `показать ромадзи` · `click to focus` / `нажмите для ввода` · `repeat` / `повтор`.
