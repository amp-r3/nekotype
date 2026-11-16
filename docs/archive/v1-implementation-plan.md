> **Archived.** This is the v1 implementation plan the baseline code was built from. It is superseded by the [MVP specification](../spec/README.md) and is no longer maintained. Paths it mentions (`ARCHITECTURE.md`, `docs/DECISIONS.md`) now live in [`docs/architecture/`](../architecture/README.md) and [`docs/adr/`](../adr/README.md).

# Kana Flow — Implementation Plan (v1)

Rewrite the single-file prototype `index.html` into a production-grade, tiny, fast, long-term-maintainable web app: a Monkeytype-style hiragana/katakana typing trainer.

The three priorities, in order: **(1) light and fast, (2) stable architecture that will not need restructuring, (3) correct romaji input semantics.**

---

## 0. How to work

- Read this whole document and the prototype before writing code. First step: `git mv index.html legacy/index.html` (Vite needs the root `index.html`). Delete `legacy/` only in the final phase, after feature parity is verified.
- Work phase by phase (section 12). After each phase run `npm run verify`, fix everything, then commit. One commit per phase.
- Do not add dependencies outside the allowlist in section 2. If you believe one is needed, write the justification (size, alternatives) in `docs/DECISIONS.md` first, and add it only if it fits the budget.
- If something is ambiguous and not covered here: choose the smallest reasonable option, record it in `docs/DECISIONS.md`, continue. Do not stop to ask.
- Code rules (enforced by lint, section 3): no `any`; no `as T` assertions (`as const` and `satisfies` are fine); no `@ts-ignore` / `@ts-expect-error` / `eslint-disable`; no non-null `!`; no default exports (except tool configs); no `export *`; exhaustive `switch` on unions. Narrow with discriminated unions, type predicates and runtime guards.
- If a library's types clash with `exactOptionalPropertyTypes`, fix it at the boundary with a small typed wrapper. Never loosen the tsconfig.
- Every user-visible string goes through i18n (section 10). Comments explain _why_, not _what_.

---

## 1. Product scope

**What it is:** a typing test. The user sees kana (a single kana, a word, or a short phrase) and types its romaji. Practice is organised as **tests** (like Monkeytype), followed by a results screen.

### In v1

- Content kinds: single kana, words, phrases.
- Scripts: hiragana / katakana / both (mixed).
- Kana set: gojūon, dakuten/handakuten, yōon (including voiced: gya, ja, bya, pya), **extended katakana** (ファ ティ ヴ …).
- Two input strictness modes, switchable in settings: **learner** and **ime** (section 5).
- Tests: time-limited (15/30/60/120 s) or count-limited (10/25/50/100 prompts), then a results screen.
- **Weak-kana tracking:** record mistakes/time per kana, persist them, and weight prompt selection towards weak kana (toggle).
- UI languages: `ru` and `en`.
- Desktop with a physical keyboard.

### Not in v1 (do NOT build; leave the extension points listed in section 14)

Mobile soft-keyboard input, themes other than the one default, PWA/offline, accounts/backend/sync, analytics, audio, kanji, heatmap view, JLPT word lists.

### Non-goals (permanent)

No SSR, no router, no UI kit, no chart library, no i18n library, no state-management library other than `@preact/signals`.

---

## 2. Stack, dependencies, budgets

| Area        | Choice                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Build       | Vite, static SPA, `build.target: 'es2022'`, no polyfills                                                                                |
| UI          | Preact (`@preact/preset-vite`), TSX with `jsxImportSource: "preact"`                                                                    |
| State       | `@preact/signals`                                                                                                                       |
| Language    | TypeScript, maximum strictness (below)                                                                                                  |
| Styles      | Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first config: `@import "tailwindcss"`, `@theme`). No `tailwind.config.ts`, no autoprefixer |
| Tests       | Vitest (+ `happy-dom` only for the input-adapter tests)                                                                                 |
| Lint/format | ESLint flat config + `typescript-eslint` (strict, type-checked) + FSD boundary enforcement; Prettier + `prettier-plugin-tailwindcss`    |

**Runtime dependencies: exactly `preact` and `@preact/signals`.** Everything else (class joiner, icons, SVG chart, dialog, i18n, storage) is hand-written and small. Icons = inline SVG.

**tsconfig (required flags):** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `isolatedModules`, `moduleResolution: "bundler"`, `allowJs: false`. Alias `@/*` → `src/*` (tsconfig + vite + vitest).

**Size budgets (gzip, first load).** Enforced by `scripts/check-budget.mjs`, which is part of `npm run verify` and fails the build when exceeded:

- JavaScript total ≤ **35 KB**
- CSS ≤ **10 KB**
- each font file ≤ **45 KB** (woff2)
- all first-load assets ≤ **160 KB**

Report the actual numbers at the end. Words/phrases content must be a separate lazily loaded chunk (section 4.4).

**Scripts:** `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test`, `fonts`, `verify` (= typecheck && lint && test && build && budget). The `base` path must be configurable (`--base` / `VITE_BASE`) so the static `dist/` can be hosted at a domain root or a subpath.

---

## 3. Architecture (Feature-Sliced Design, lean)

Layers, top → bottom. Imports go **down only**:

```
app → pages → widgets → features → entities → shared
```

### 3.1 Structure

```
src/
  app/                      main.tsx, App.tsx, init.ts (locale detect, store hydrate), styles/index.css
  pages/
    trainer/                TrainerPage: switches idle/running ↔ finished
  widgets/
    top-bar/                brand, locale toggle, rows-dialog trigger
    config-bar/             script, content, strictness, test length, weak-focus toggle
    test-stage/             prompt glyph row, typed mirror, input sink, live stats, reveal/restart hints
    results-panel/          final metrics, speed-over-time SVG, weakest kana, "next test"
    rows-dialog/            kana row matrix (native <dialog>)
  features/
    type-prompt/            input adapter, typing controller, <PromptInput/>
    practice-settings/      script / content / strictness switches, weak-focus toggle, row matrix
    test-settings/          test kind + length switch
    change-locale/          locale toggle
    reset-progress/         confirm + wipe progress
  entities/
    kana/                   data, types, romaji engine, prompt picker, practice-settings store, content loader
    session/                test config, run state machine, metrics (pure), results
    progress/               per-kana stats, persistence, weight computation (pure)
  shared/
    lib/                    storage (KeyValueStore), rng, clock, guards, cx
    ui/                     Button, Dialog, Segmented, Toggle, Kbd, icons
    i18n/                   en.ts, ru.ts, translate, locale signal
    styles/  assets/        tokens.css, fonts.css, woff2 files
```

Slice layout inside a slice uses standard FSD segments only: `model/` (types, stores, static data tables in `model/data/`), `lib/` (pure logic), `api/` (async loading, e.g. `loadContent`), `ui/`, `index.ts` (public API).

### 3.2 Rules

1. A slice is imported **only through its `index.ts`**. `index.ts` uses explicit named re-exports (no `export *`).
2. **No imports between slices of the same layer.** `entities/session` and `entities/progress` must not import `entities/kana`: they work on plain data (string keys, numbers) handed to them by a higher layer. This is deliberate.
3. **Pure domain logic has no framework.** `entities/*/lib` and `entities/*/model/*pure*` files (engine, picker, weights, metrics) must not import `preact` or `@preact/signals`. Signals appear only in `model/store.ts` files and in `ui/`.
4. **Side effects live in exactly two places:** `features/*/model/controller.ts` (timers, DOM listeners) and `app/`. Entity stores expose plain actions; they never touch timers, DOM, or `localStorage` directly (persistence goes through the `KeyValueStore` from `shared/lib`).
5. Randomness and time are injected (`Rng`, `Clock` from `shared/lib`). `Math.random` and `Date.now` are referenced only in the default implementations.
6. State that more than one feature reads lives in an **entity**, never in a feature (features cannot import each other). Practice settings live in `entities/kana`, test config in `entities/session`. Features contain UI and thin actions only. Domain rules on that state (e.g. "at least one row stays selected") are store actions in the entity, not UI checks.

### 3.3 Enforcement (required, not optional)

- ESLint: `@typescript-eslint/no-explicit-any`, `ban-ts-comment`, `consistent-type-assertions` (`assertionStyle: 'never'`), `no-non-null-assertion`, `switch-exhaustiveness-check`, `consistent-type-imports`, `no-unnecessary-condition`, `no-restricted-syntax` for `export *` and `export default` (except `*.config.*`), and `eslint-comments/no-use`-style ban on `eslint-disable`.
- FSD rules (layer direction, no same-layer slice imports, public-API-only imports) via the official FSD linter (steiger) **or** `eslint-plugin-boundaries`, whichever integrates cleanly.
- Prove it works: add a temporary violating import, confirm `npm run lint` fails, remove it. Mention this in the final report.

---

## 4. Domain data (`entities/kana`)

### 4.1 Rows

Stable literal-union `RowId`s (they are persisted — never rename later). Extended rows are prefixed `ext_` so they can never collide with other ids.

| Category                          | Rows                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `basic` (10)                      | `vowels, k, s, t, n, h, m, y, r, w_n`                                                                                                                        |
| `dakuten` (5)                     | `g, z, d, b, p`                                                                                                                                              |
| `yoon` (11)                       | `ky, sh, ch, ny, hy, my, ry, gy, j, by, py`                                                                                                                  |
| `extended` (5, **katakana only**) | `ext_fa` ファ フィ フェ フォ · `ext_va` ヴァ ヴィ ヴ ヴェ ヴォ · `ext_wi` ウィ ウェ ウォ · `ext_ti` ティ トゥ ディ ドゥ テュ デュ · `ext_che` シェ ジェ チェ |

Total 31 rows. Extended rows have no hiragana counterpart: they are unavailable when `script = hiragana` (disabled in the matrix with a hint) and only produce katakana in `both`.

### 4.2 Entry format

Each entry: `{ hiragana?: string; katakana: string; ime: readonly string[]; learner: readonly string[] }`.

- `ime` — spellings a real Japanese IME (Microsoft IME / Google Japanese Input romaji tables) converts to exactly this kana. **First element is the canonical spelling.**
- `learner` — extra spellings accepted only in learner strictness (Kunrei/ambiguous/pronunciation-based).
- When unsure whether an IME accepts a spelling, put it in `learner`, not `ime`. Verify the extended-katakana spellings against the IME tables (e.g. ティ = `thi`, ファ = `fa`, ウィ = `wi`, ウォ = `who`, ヴ = `vu`).

Examples: し ime `shi, si`; ち ime `chi, ti`; つ ime `tsu, tu`; ふ ime `fu, hu`; じ ime `ji, zi`; ぢ ime `di`, learner `ji, zi`; づ ime `du`, learner `zu`; を ime `wo`, learner `o`; しゃ ime `sha, sya`; じゃ ime `ja, zya, jya`; ちゃ ime `cha, tya`.

`ん/ン` is **not** a table entry with fixed spellings; the engine resolves it by context (section 5.3).

### 4.3 Defects in the prototype — do not copy

- `ど` has primary romaji `'to'` → must be `do`.
- Hand-written per-word romaji `alts` → delete. The engine derives all spellings from the kana text.
- Yōon rows were incomplete (no voiced yōon) → added above.

### 4.4 Words & phrases

Migrate all 30 words and 7 phrases from the prototype, and add ~10 extended-katakana words (e.g. パーティー, ファイル, フォーク, ヴァイオリン, ウィンドウ, ディスク, チェック, ティッシュ …).

```ts
type ContentItem = {
  readonly id: string; // stable, e.g. 'word:neko'
  readonly text: string;
  readonly script: 'hiragana' | 'katakana';
  readonly meaning: { readonly en: string; readonly ru: string };
  readonly readingHints?: readonly { tokenIndex: number; learner: readonly string[] }[];
};
```

- `readingHints` carries pronunciation-only spellings in learner mode, e.g. こんにちは: final は → `wa`. In `ime` strictness は is only `ha`.
- Meanings live **here**, not in the i18n dictionaries. i18n holds UI strings only.
- Access is async: `loadContent(kind: 'words' | 'phrases'): Promise<readonly ContentItem[]>`, implemented with dynamic `import()` so these are separate chunks. Callers must not assume synchronous availability.
- The hint (meaning) is shown in the current UI locale. Romaji is **never** shown during a prompt — only via reveal (section 6).

### 4.5 Keys

- `KanaKey` = `` `${'hiragana' | 'katakana'}:${glyph}` `` (e.g. `hiragana:し`). It is a type of `entities/kana` only: `session` and `progress` treat keys as opaque `string`s and never import `KanaKey`.
- **Token → key assignment:** a plain kana or digraph/extended combo → its own key (`hiragana:きゃ`, `katakana:ティ`, `hiragana:ん`). A sokuon-merged token (`っち`) → the key of the **following** kana (`っ` is not tracked separately). `ー` and a standalone `っ` → `null` (not tracked).
- `PromptItem` = `{ key: string; text: string; meaning?: {en; ru}; readingHints?: … }`. For single kana `key` is the `KanaKey`; for content `key` is the item `id`.

---

## 5. Romaji engine (`entities/kana/lib`)

Pure, framework-free, fully unit-tested. This is the heart of the app: spend the most care here.

### 5.1 Two strictness levels = a filter over spelling tiers

- `ime`: only `ime`-tier spellings.
- `learner`: `ime` ∪ `learner` tiers.
  The matcher logic is identical for both; strictness only changes which spellings are loaded at compile time.

### 5.2 Compile

`compile(prompt: PromptItem, strictness: Strictness): Matcher`

Tokenise the text into `Token { glyph; kanaKey: KanaKey | null; spellings: readonly string[] }`. Longest match first (digraphs/extended combos before single kana). The digraph logic must be **table-driven** (look up base+small-kana combos in the data tables), not hard-coded per row, so new rows need no engine change. Text not representable by the tables is a programmer error (throw); the data-integrity test guarantees it never happens.

Rules resolved at compile time:

1. **Sokuon っ/ッ** attaches to the next token and doubles the first consonant of each of its spellings (`か → kka`, `し → sshi, ssi`, `ちゃ → tcha, ttya`, `tchi, tti` for ち). `ch → tch` is `ime`-tier; `cch` is `learner`-tier. If the next token starts with a vowel, `n`, `y`, or there is no next token, `っ` becomes its own token with `xtu`, `ltu`, `xtsu`.
2. **Chōonpu ー**: `-` is `ime`-tier. In learner tier it additionally accepts the preceding spelling's final vowel repeated (`ko-hi-` and `koohii` both valid; in `ime` only `ko-hi-`).
3. **ん/ン** (context lookahead on the _next token's spellings_):
   - `ime`: `nn` and `n'` always. Bare `n` only when **every** spelling of the next token starts with a consonant other than `n`/`y`. At the end of a prompt only `nn`/`n'`. (Examples: パン → `pa` `nn`; こんにちは → `konnnichiha`.)
   - `learner`: `n`, `nn`, `n'` accepted everywhere.
4. **Particles/readings:** apply `readingHints` (learner tier) at their `tokenIndex`.

### 5.3 Matching = NFA simulation, not a per-token buffer

A per-token buffer with "advance on first complete" is wrong (breaks on `n` vs `nn`, ー, sokuon). Instead the matcher keeps a **set of live positions** `(tokenIndex, spellingIndex, charOffset)`.

```ts
start(m: Matcher): MatchState
step(m: Matcher, s: MatchState, ch: string): MatchState | null   // null = rejected
isComplete(m: Matcher, s: MatchState): boolean
activeTokenIndex(s: MatchState): number     // furthest-progress live position
extensions(m: Matcher, s: MatchState): ReadonlySet<string>  // chars that could still extend a complete state
canonical(m: Matcher): string               // single string for reveal: first spelling per token
```

- A rejected `step` leaves the caller's state untouched.
- A prefix reachable by `step` is always completable (no dead ends).
- There is no `generateAllValidCombinations` in production code (exponential). A capped enumerator may exist as a **test utility only**.

### 5.4 Trailing-extension absorption

When a prompt completes while `extensions()` is non-empty (typical: learner-mode `pa` `n` at the end, user continues with habitual second `n`), the prompt completes immediately (no waiting). The controller remembers those extension chars and the completion timestamp (injected `Clock`). If the **first key of the next prompt** is one of those chars **and arrives within 250 ms** of the completion, it is swallowed silently — even when it would also be a valid first char of the new prompt (e.g. `パン` followed by `ねこ`) — and is not counted as a mistake or a keystroke. A habitual double-tap arrives in ~100 ms, while reading a new prompt takes longer, so after 250 ms the key is processed normally.

### 5.5 Prompt picker (pure)

```ts
buildPool(settings, content): readonly PromptItem[]
pickPrompt(pool, weights: ReadonlyMap<string, number>, rng: Rng, previousKey: string | null): PromptItem
```

- Never returns the same item twice in a row when `pool.length > 1`.
- Weighted random by `weights` (default weight 1). For content items the weight is the mean weight of their tokens' `KanaKey`s (passed in as part of `weights` by the caller).
- Single-kana pool: for each selected row, each entry yields hiragana and/or katakana per `script`; extended entries yield katakana only.
- Content pool (`words` / `phrases`): items are filtered by `script` (`hiragana` → hiragana items, `katakana` → katakana items, `both` → all); rows are ignored. A data test asserts every script × kind pool has ≥ 3 items (add pure-katakana phrases/compounds if needed — the prototype has only 2). If a pool is empty at runtime anyway, fall back to the single-kana pool.
- `romajiForKey(key: string): string | null` — canonical `ime` spelling of one tracked kana key, `null` for unknown/untracked keys. The results panel uses it for "weakest this run".

---

## 6. Typing interaction (`features/type-prompt`)

### 6.1 Flow

`idle` (prompt shown, clock not started) → first key of any valid letter starts the test → `running` → `finished` (results). Correct completion of a prompt advances to the next **instantly** (≤120 ms CSS success flash allowed, but never block input).

### 6.2 Keys

- Letters `a–z`, `-`, `'` → typing.
- **Wrong key:** rejected — it does not enter the buffer; shake animation (CSS, ~280 ms) on the stage; counts as a mistake attributed to the active token. (Backspace is never needed — the no-dead-ends invariant of 5.3 guarantees every accepted prefix can still be completed — so it is ignored in both strictness modes.)
- `Esc` → reveal the canonical romaji for the current prompt. The prompt is then `assisted`: counts as 1 mistake on the active token; typing the revealed answer still completes it. There is no "skip" (reveal + type is the way forward).
- `Tab` then `Enter` → restart the test. Implement with natural focus order (the restart button is the first focusable after the input). Do not trap Tab.
- Everything else (Enter, Space, Backspace, arrows, modifier combos) is ignored. While a dialog is open the arena ignores all keys. Focus returns to the input when the dialog closes.
- Clicking the arena focuses the input. A letter / `-` / `'` key pressed anywhere outside a dialog (including while a settings button has focus) moves focus to the input and is processed normally. When the input is blurred, show a non-interactive "click to focus" hint (`pointer-events: none`, `aria-hidden`) that never blocks keyboard navigation: Tab from the input must reach the restart button.

### 6.3 Input adapter (mobile-ready seam)

`features/type-prompt/lib/input-adapter.ts` turns raw DOM events into `KeyIntent`, and **nothing else in the codebase reads DOM key events**:

```ts
type KeyIntent =
  | { readonly kind: 'char'; readonly char: string } // already normalised: [a-z-'], lower case
  | { readonly kind: 'reveal' }
  | { readonly kind: 'ignore' };
```

v1 implements the desktop path via `keydown`:

- Ignore when `isComposing`, or `ctrl/meta/alt` is held.
- If `event.key` is a single Latin letter / `-` / `'` → `char`.
- Otherwise (Cyrillic or other layout, `Unidentified`) fall back to `event.code`: `KeyA…KeyZ` → `a…z`, `Minus` → `-`, `Quote` → `'`. (Russian-layout users must still be able to type.)
- On `compositionstart` (Japanese IME is active): ignore input and show an i18n hint "switch keyboard to English / turn IME off".
- The `<input>` is an **event sink**: always empty (`preventDefault` on handled keys), with `autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="en"` and an `aria-label`. The typed text is rendered from state in a mirror element.
- Mobile later = adding a `beforeinput`/`input`-based adapter producing the same `KeyIntent`. Do not implement now, but document it in `ARCHITECTURE.md` and cover the interface with tests.

### 6.4 Controller (`model/controller.ts`)

Owns: current prompt + `Matcher` + `MatchState`, typed string, shake flag, reveal flag; calls the entities' actions; owns the deadline timer for time tests and the 1 Hz ticker for live stats. Transient typing state is kept in signals **local to this feature**; it must never live in the settings or session stores. Components bind to signals so that a keystroke updates only the typed mirror / active-token highlight, not the config bar, top bar or dialogs.

---

## 7. Session, metrics, results (`entities/session`)

### 7.1 Config & phases

```ts
type TestConfig =
  { kind: 'time'; seconds: 15 | 30 | 60 | 120 } | { kind: 'count'; prompts: 10 | 25 | 50 | 100 }; // default: time 30
type Phase = 'idle' | 'running' | 'finished';
```

Changing any setting (script, content, strictness, rows, test config) or restarting resets to `idle` with a fresh prompt. A time test ends at the deadline even mid-prompt (the partial prompt does not count as completed, its keystrokes do). A count test ends on completion of the last prompt.

### 7.2 Events (append-only) and derived metrics

The store keeps an append-only list of `KeystrokeEvent { at: number; accepted: boolean }` and `PromptResult { key; startedAt; endedAt; mistakes; assisted; tokenOutcomes: { kanaKey: string | null; mistakes: number; ms: number }[] }`. **All displayed numbers are pure functions of these events** (`lib/metrics.ts`):

- `elapsedMs` = end − first keystroke (end = deadline, or the last prompt's completion).
- `correct` = accepted keystrokes; `mistakes` = rejected keystrokes (+ 1 per reveal).
- `wpm` = (correct / 5) / minutes; `rawWpm` = ((correct + mistakes) / 5) / minutes; `accuracy` = correct / (correct + mistakes), 100 % when no keystrokes; `kanaPerMin` = completed kana tokens / minutes; `bestStreak` = longest run of prompts completed with zero mistakes.
- Guard `elapsedMs = 0`.
- Series for the chart: cumulative `wpm` per second.

`tokenOutcomes` are derived from `activeTokenIndex` transitions: when the active token index advances from _i_ to _j_, tokens _i…j−1_ completed at that timestamp.

### 7.3 Results screen (`widgets/results-panel`)

wpm (large), accuracy, rawWpm, kana/min, time, prompts completed, mistakes, best streak; speed-over-time as an inline SVG polyline (no chart library); "weakest this run" (up to 5 kana with mistakes > 0, shown with their canonical romaji; hidden when none); primary button "Next test" (autofocused, `Enter` activates). Results are computed once on finish and are not recomputed live.

---

## 8. Progress & weak kana (`entities/progress`)

- Stats per opaque string key (the `KanaKey` value, see 4.5): `{ a: attempts, m: mistakes, t: avgMs (EMA, α = 0.3) }`. Attempts are incremented per completed token occurrence (also inside words/phrases); mistakes are attributed to the active token at the time of the wrong key or reveal.
- **Decay:** when `a > 50`, halve `a` and `m` (keeps the stats recent).
- **Weight (pure):** `weakness = (m + 1) / (a + 2)`; `weight = 1 + 4 × weakness` (range 1–5; unseen kana ≈ 3 so new material is introduced). `avgMs` is stored but unused in v1 (extension point).
- `computeWeights(stats, keys): Map<string, number>` is pure. Entities do not know about the picker; the `type-prompt` controller builds the map and passes it to `pickPrompt`.
- UI: a "Focus weak kana" toggle in the config bar (default **on**, persisted), "weakest this run" on results, and a "Reset progress" action in the top bar with confirmation (`features/reset-progress`).
- Progress is written after each finished test and on `pagehide` / `visibilitychange`, never per keystroke.

---

## 9. Persistence

- `shared/lib/storage`: `interface KeyValueStore { get(key): string | null; set(key, value): void; remove(key): void }` with a `localStorage` implementation that **never throws** (private mode / quota) and a memory implementation for tests. A future backend (e.g. Go API) replaces it behind this interface.
- Keys: `kanaflow:settings:v1`, `kanaflow:progress:v1`, `kanaflow:locale`.
- Every persisted document has a schema `v`. Reading = `JSON.parse` in try/catch → **runtime guard** (type predicate) → on failure or version mismatch fall back to defaults silently. No casts. A `migrate(vN → vN+1)` function pattern is documented.
- Persisted settings: `{ v:1, script, content, strictness, rowIds, weakFocus, test: TestConfig }` with `script: 'hiragana' | 'katakana' | 'both'` and `content: 'single' | 'words' | 'phrases'`. Not persisted: dialog open state, phase, typed buffer.
- Defaults: script `both`, content `single`, strictness `learner`, rows = the 10 `basic` rows, weakFocus on, test `time 30`.
- Writes are debounced (≤ 1 per 300 ms) and flushed on `pagehide`.

---

## 10. i18n (`shared/i18n`)

- `en.ts` is the source of truth (a plain object `as const`-style via `satisfies`); `ru.ts` is `satisfies Record<keyof typeof en, string>` so a missing key is a compile error.
- `t(key, params?)` with typed keys and `{name}` interpolation; no pluralisation (phrase strings to avoid it).
- Locale is a signal; default from `navigator.language` (`ru*` → `ru`, otherwise `en`), persisted; update `document.documentElement.lang` on change.
- There is no SSR, so no hydration concerns: the first render already uses the resolved locale.

---

## 11. UI, styling, fonts, accessibility

### 11.1 Layout (desktop-first, but nothing breaks at 360 px width)

Top bar (brand, locale toggle, rows button, reset progress) → config bar (script · content · strictness · test length · weak-focus) → test stage (live stats strip, prompt, typed mirror, feedback line, reveal/restart hints) ↔ results panel (replaces the stage when `finished`).

### 11.2 Theme tokens

Semantic CSS variables in `shared/styles/tokens.css`, applied under `[data-theme="matte"]` on `<html>` (the only theme in v1, `color-scheme: dark`): `--bg`, `--surface`, `--surface-2`, `--border`, `--border-strong`, `--text`, `--text-dim`, `--accent`, `--accent-dim`, `--ok`, `--error`. Map them in Tailwind via `@theme inline` (`--color-bg: var(--bg)` …). Components use semantic classes only (`bg-surface`, `text-dim`), **never raw hex**. Initial palette from the prototype: bg `#121316`, surface `#181a1f`, surface-2 `#20232a`, border `#2e333d`, border-strong `#383e4a`, accent `#fbbf24` / `#eab308`. Adding a theme later = one more variable block, zero component changes.

### 11.3 Fonts (the biggest bundle lever)

- Two self-hosted woff2 families only: (a) **kana font** — Noto Sans JP, subset to exactly the glyphs used by the data (+ `ー っ ッ ゃ ゅ ょ ャ ュ ョ ァ ィ ゥ ェ ォ`); (b) **UI/mono font** — JetBrains Mono (or similar OFL monospace), subsets `latin` + `cyrillic`. One or two weights total.
- No Google Fonts requests at runtime. `scripts/subset-fonts.mjs` (`npm run fonts`) uses a Node-based subsetter with woff2 output (e.g. the `subset-font` npm package; dev-dependency only, **no Python**) to derive the glyph list from the data into a committed `glyphs.txt` and to output the woff2 files. The committed woff2 files are what the build uses; the build never runs the subsetter. Keep the large source fonts out of git (gitignored `scripts/font-src/`) and document where to download them (both are OFL).
- A unit test asserts `glyphs.txt` equals the set of characters in the data files (fails when data changes and fonts are not regenerated).
- `font-display: swap`, preload both fonts from `index.html`, reserve the glyph box height to avoid layout shift.

### 11.4 Dialog and a11y

- The rows dialog uses native `<dialog>` + `showModal()` (Esc, focus trap, backdrop for free); wrap it in `shared/ui/Dialog`.
- Visible focus rings; all controls reachable by keyboard; `aria-pressed`/`role="radiogroup"` on segmented controls; results announced via a polite live region; honour `prefers-reduced-motion` (disable shake/flash).
- Row matrix: categories basic/dakuten/yoon/extended, per-row toggle, Select all / Clear / "Gojūon only" preset. At least one row must stay selected (reject clearing the last one with a visible message). In words/phrases mode the matrix is disabled with an explanatory hint.

---

## 12. Phases and acceptance criteria

**P0 — Scaffold & gates.** Vite + Preact + strict TS + Tailwind v4 + Vitest + ESLint (+FSD rules) + Prettier + budget script + `verify`; move prototype to `legacy/`; empty app builds. _Done when:_ `npm run verify` passes; the deliberate-violation lint check fails as expected.

**P1 — Domain (no UI).** Kana data (31 rows), types, engine (section 5), picker, content loader, data migrated with `{en, ru}` meanings. _Done when:_ all engine/data tests in section 13 pass.

**P2 — State & persistence.** `entities/session`, `entities/progress`, practice-settings store, `KeyValueStore`, guards, i18n. _Done when:_ metrics, weights, persistence (including corrupted storage) tests pass.

**P3 — Typing feature.** Input adapter, controller, absorption, reveal, deadline/ticker. _Done when:_ adapter tests and a controller test with fake clock + seeded RNG pass (a scripted keystroke sequence yields exact metrics).

**P4 — UI.** `shared/ui`, widgets, page, results, dialogs, styling, fonts subset. _Done when:_ manual checklist in section 13 is green and the budget is met.

**P5 — Hardening & docs.** a11y pass, reduced motion, README, `ARCHITECTURE.md`, `docs/DECISIONS.md`, delete `legacy/`. _Done when:_ `verify` is green and the final report (section 15) is written.

---

## 13. Testing

**Vitest, committed to the repo** (no throw-away scripts). Table-driven where possible.

Engine:

- `きゃ` → `kya`; `ちょっと` → tokens `ちょ` + `っと`: `chotto`, `tyotto` valid; `っち` → `tchi`, `tti` (`cchi` only in learner); `し` → `shi`/`si`; `つ` → `tsu`/`tu`.
- ん: `パン` → ime `pann` only; learner `pan` and `pann` (with absorption); `かんじ` → `kanji`/`kannji` valid in both; `こんにちは` → ime `konnnichiha`; learner also `konnnichiwa` and `konnichiwa`; `ほんや` (ん before `y`) → ime requires `nn`.
- ー: `コーヒー` → ime `ko-hi-` only; learner also `koohii`, `ko-hii`, `koohi-`.
- Extended: `パーティー` → ime `pa-thi-`; `ファイル` → `fairu`/`huairu`-style per table; `ヴァイオリン` etc.
- Per-strictness property tests: for every prompt in the data, every enumerated spelling (test-only enumerator, capped) is accepted fully by `step` and ends `complete`; `canonical` is among them; every proper prefix is non-null and not-complete-unless-valid; a random single-char mutation is either another valid prefix or `null`.
- No dead ends: from every reachable state at least one char is accepted unless complete.

Data integrity: ids unique; every row has ≥ 1 `ime` spelling per entry; hiragana/katakana parity for non-extended rows; `RowId` union matches the rows; content ids unique; every `meaning` has `en` and `ru`; `glyphs.txt` in sync.

Pure logic: metrics (fixed event lists → exact numbers, including `elapsed = 0`), weights (unseen/weak/strong, decay), picker (no immediate repeat, weighted distribution with a seeded RNG, extended rows excluded for hiragana-only), settings/progress persistence (valid, corrupted, wrong version, throwing storage), input adapter (desktop mapping incl. Cyrillic `code` fallback, composition ignored, modifiers ignored), absorption (a second `n` after `パン` within 250 ms is swallowed even when the next prompt is `ねこ`; the same key after 250 ms starts `ねこ`).

Manual checklist (P4): focus retention after clicking around and closing the dialog; shake on wrong key; Esc reveal; Tab+Enter restart; time test ends mid-prompt; count test ends on last prompt; strictness switch resets the test; ru/en switch; Cyrillic keyboard layout types correctly; Japanese IME shows the hint; throttled-CPU keystroke latency feels instant (no re-render of config/top bars while typing — verify with the Preact devtools or a render counter).

---

## 14. Documentation deliverables and backlog

- `README.md`: what it is, scripts, how to host (`base`), budgets.
- `ARCHITECTURE.md`: layer diagram, dependency rules, the two-tier spelling model, engine contract, and **extension recipes**: add a kana row / words / a locale / a theme / a storage backend; how to add the mobile input adapter; where heatmap, JLPT lists and PWA would plug in.
- `docs/DECISIONS.md`: log of every non-obvious choice (including: Vite+Preact instead of Next; signals instead of zustand; two-tier strictness; reveal counts as a mistake; no skip).

**Backlog (extension points exist, no implementation):** more themes (token blocks), PWA/offline (static build is already cache-friendly), mobile soft-keyboard adapter, per-kana heatmap using `progress` stats, lazy per-level JLPT word lists via `loadContent`, speed-based weighting using stored `avgMs`, backend sync behind `KeyValueStore`.

---

## 15. Final report (required)

1. Gate results: typecheck / lint / tests (count) / build.
2. Actual gzip sizes vs. budgets (JS, CSS, each font, total first load).
3. Proof the FSD lint rules fire.
4. List of deviations from this plan and every entry in `docs/DECISIONS.md`.
5. Known limitations (anything in section 1 "In v1" not fully done).
