> **Scope.** Describes the code as it stands after phase P3 (learning): the application in `apps/web/src/` and the two packages it uses, `packages/engine` and `packages/shared`. Where it disagrees with the [MVP specification](../spec/README.md), the specification applies; this document is rewritten as the MVP phases land (spec item D21). The name `baseline-v1` is historical.

> **Direction.** [ADR 058](../adr/058-learning-first.md) made learning the core of the MVP. Since P3, `/` is the learning screen and the typing trainer (words and phrases) lives on `/type`; single kana and the row selection were removed. Words and phrases from the content pipeline come in P4, sync in P5.

# Nekotype Architecture Documentation

Nekotype is a high-performance, keyboard-first Japanese kana speed trainer engineered around a Non-deterministic Finite Automaton (NFA) romaji engine, fine-grained Preact signals, and strict Feature-Sliced Design (FSD) architecture.

---

## 1. Repository Layout, Layers & Import Boundaries

### Workspace (ADR 027)

```
apps/web/          @nekotype/web: the Preact SPA, Feature-Sliced Design (below)
packages/engine/   @nekotype/engine: NFA romaji engine, kana tables, track composition (`kanaOf`, `kanaRows`) and the visually-similar kana table (`similarKana`); imports nothing
packages/shared/   @nekotype/shared: /types (Clock, Rng, Scheduler, Valid* types), /runtime (type guards)
```

Packages are consumed as TypeScript source (no build step). Each package has its own `tsconfig.json`, ESLint config, scripts and tests; the root holds Prettier, `tsconfig.base.json`, `eslint.base.js` (`createBaseConfig`) and scripts that run `pnpm -r`. Enforced by lint:

- `packages/engine/src` may use only relative imports and no browser globals (`window`, `document`, `localStorage`, …), so it runs in the browser and in a Worker.
- `apps/web` must not import `@nekotype/shared/schemas`, `@nekotype/content` or `@nekotype/api`; `shared/runtime` must not import schemas or valibot. These targets do not exist yet; the rules are in place for P3 onwards.

### Application layers (FSD)

`apps/web` strictly adheres to **Feature-Sliced Design (v2.1)** conventions and is continuously validated by `steiger` alongside TypeScript compiler checks:

```
apps/web/src/
├── app/                  # Application root: shell (navigation, footer), routes, initialization, styles
├── pages/                # Full-page views: trainer, learn, stats, settings, about
├── features/             # User interaction workflows (training)
├── entities/             # Core domain models and business state (kana, session, progress, learn)
└── shared/               # Reusable primitives, UI components, i18n, storage, and utility libraries
```

`shared/lib/idb` holds the IndexedDB layer (P3, ADR 061): a promise wrapper, `getDatabase()` (one connection per page load, or an in-memory store with a "data will not be saved" notice when the database cannot be opened) and the schema reset on a `SCHEMA_VERSION` mismatch. Settings are stored there (`settings` store, key `current`); `app/init.ts` deletes the legacy `kanaflow:settings:v1` key once the database has opened. Typing progress stays in `localStorage` (`kanaflow:progress:v1`) until P4, and so does `nekotype:locale`.

### Import Rules & Layer Hierarchy

1. **Unidirectional Dependency Flow:** Slices in higher layers may import slices from lower layers only (`app` → `pages` → `features` → `entities` → `shared`). Lower layers NEVER import from higher layers.
2. **No Same-Layer Cross-Slice Imports:** Slices within the same layer (e.g. `entities/prompt` and `entities/settings`) must never import from each other. They interact through compositional coordination in higher layers (`features/training` or `pages/trainer`).
3. **Public API Facades:** All inter-slice imports must resolve through the target slice's root `index.ts` public re-export file. Deep internal imports (e.g. `@/entities/prompt/lib/picker`) are forbidden and rejected by lint checks.
4. **Zero-Assertion TypeScript:** The entire codebase operates under maximum strictness: zero `any`, zero `as T` type assertions, zero non-null assertions (`!`), and zero `@ts-ignore` or `eslint-disable` directives.

### Widgets Layer Consolidation

Under standard FSD, the `widgets/` layer hosts multi-slice compositional blocks. The FSD linter (`steiger`) enforces `fsd/insignificant-slice`, requiring slices to have more than one consumer across the application. Each screen is a separate page slice and the trainer is the only one with several components, so all trainer-specific widgets (`ModePanel`, `TestStage`, `ResultsPanel`, `LiveStatsStrip`, `SpeedChart`, `WeakestKanaList`) were consolidated into `apps/web/src/pages/trainer/ui/` as page-internal UI components.

> [!NOTE]
> **When to Extract Widgets:** If a second full-page view is introduced (such as a historical stats dashboard, custom word list editor, or flashcard review page) that reuses these UI blocks, extract them back into `apps/web/src/widgets/<widget-name>/` with their own public APIs.

### The test screen (ADR 041)

- `pages/trainer/ui/test-stage.tsx` is the screen: the stage; the hidden field that takes the keyboard lives one level up in `trainer-page.tsx`, so it stays when the screen changes (`useTestInput` in `features/training/lib/use-test-input.ts` creates and binds the input source and keeps the focus; `useFinishButton` enables Finish; ADR 055), `LiveLine` (counter, kana per minute, kana accuracy), `TextStream`, one line for notices (layout, IME, the revealed romaji), the translation (two lines reserved; empty when `showTranslation` is off) and the hints. Every line whose text a keystroke changes is a signal passed as a text node, so the screen renders once.
- `lib/weakest-kana.ts` computes the weakest kana of the results screen; the default time and count tests are `DEFAULT_TIME_TEST` and `DEFAULT_COUNT_TEST` in `entities/settings`.
- `features/training/ui/text-stream.tsx` renders the tokens of `session.stream` and has no child component; `lib/use-stream-binding.ts` gives the elements to the writer (`lib/stream-dom.ts`) and writes the rest to the DOM through signal effects.
- While a test runs `useTestChrome` sets `data-testing` on the document; the stylesheet turns it into `opacity` and `visibility` for everything marked `data-chrome` (navigation, mode panel, footer). Restart has `nk-on-focus`: it shows when focused or hovered, and always on a touch screen. Tab and Shift keep the interface shown. `useEnterForNext` handles Enter on the results screen.
- The page switches to the results on a `finished` computed value, so the start of a test (idle to running) does not render it. The render test counts every component render of the page from the first key: none for a key inside a prompt, the stream for a key that completes one.

### Routing and the application shell (ADR 037)

- `shared/lib/router.ts` is a router on the History API: `currentPath` (a signal), `navigate()`, `startRouter()` for the back button. It knows paths only.
- `app/route-paths.ts` lists the screens (`/`, `/type`, `/stats`, `/settings`, `/about`); `app/routes.tsx` maps each to a loader. `/` is the learning screen and is in the initial chunk; the typing trainer is the lazy route `/type`; `/learn` answers 404 (P3 PR 14); the others are dynamic imports (separate chunks, checked by `check-budget.mjs` as route chunks). `app/route-state.ts` holds the loaded screens and the failed ones; `RouteView` renders the screen, a loading line, a retry notice or the not-found screen.
- `app/App.tsx` is the shell: `Nav` and `Footer` from `shared/ui` (they take their strings and the navigation handler as props), the language switch, `<main>`. The pages carry no frame of their own.
- `public/_redirects` rewrites the four non-root routes (with and without a trailing slash) to `/` with status 200 (not `/index.html`, ADR 039); `redirects.test.ts` keeps it equal to `ROUTE_PATHS`. There is no catch-all, so `404.html` still answers unknown paths and missing assets.
- `app/prefetch.ts` fetches the lazy screens and the content chunks on `requestIdleCallback` (a timer where it is missing) after the first render. The same pass loads the results screen and the Russian dictionary, which are chunks of their own (ADR 057). The tab title follows the screen and the language (`initApp`).

### Styles and design tokens (ADR 034)

- `shared/styles/tokens.css` holds the design-system tokens by hand (colours under `[data-theme='dark']`, scales and text styles in `@theme`); `tokens.test.ts` compares it with `docs/design/source/tokens.json`. The Tailwind default scales are cleared, so only token-based classes (`text-fur`, `text-ui-label`, `font-jp`, `h-control`, …) produce CSS.
- `shared/styles/fonts.css` declares the five faces (Golos Text 400/500, JetBrains Mono 400/500, Noto Sans JP 400); `font-synthesis: none`.
- E2E and DOM tests select by `data-testid` and by the attributes the stream keeps on `prompt-arena` (`data-phase`, `data-rejected`), not by class. `prompt-text` is a visually hidden element with the text of the prompt on display, which is also what assistive technology reads; e2e tests work out the canonical answer from it with the engine (`e2e/lib/prompt.ts`, ADR 045).

---

## 2. Two-Tier Romaji Spelling Model

Typing Japanese romaji involves substantial ambiguity between formal IME keystrokes and intuitive learner romanizations. Nekotype solves this with a deterministic two-tier model:

| Level      | Name             | Description                                                                                                                                                         |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier 1** | **Strict IME**   | Exact keystroke sequences accepted by Microsoft IME and Google Japanese Input on Japanese keyboard layouts. Rejects invalid shortcuts (e.g. `koohii` for コーヒー). |
| **Tier 2** | **Learner Mode** | Accepts all Strict IME spellings **plus** common phonetic romanizations (Hepburn, Kunrei-shiki, Nihon-shiki, digraph variants, and vowel-lengthening alternatives). |

### Ambiguous Romaji Resolution Table

| Kana                           | Strict IME Keystrokes                          | Learner Mode Additional Keystrokes                               | Design Rationale                                                                           |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **を**                         | `wo`                                           | `o`                                                              | Standard IME requires `wo` to produce を; `o` produces お. Learners frequently expect `o`. |
| **ぢ**                         | `di`                                           | `ji`, `zi`, `dzi`                                                | In standard IME, `ji` produces じ. `di` produces ぢ.                                       |
| **づ**                         | `du`                                           | `zu`, `dzu`                                                      | In standard IME, `zu` produces ず. `du` produces づ.                                       |
| **ティ**                       | `thi`                                          | `ti`, `texi`                                                     | In standard IME, `ti` produces ち. `thi` produces digraph ティ.                            |
| **ディ**                       | `dhi`                                          | `di`, `dexi`                                                     | In standard IME, `di` produces ぢ. `dhi` produces digraph ディ.                            |
| **トゥ**                       | `twu`                                          | `tu`, `toxu`                                                     | In standard IME, `tu` produces つ. `twu` produces digraph トゥ.                            |
| **ドゥ**                       | `dwu`                                          | `du`, `doxu`                                                     | In standard IME, `du` produces づ. `dwu` produces digraph ドゥ.                            |
| **ウォ**                       | `who`                                          | `wo`, `uxo`                                                      | In standard IME, `wo` produces を. `who` produces extended digraph ウォ.                   |
| **シェ**                       | `she`                                          | `sye`, `sixe`                                                    | Standard IME input for extended Katakana シェ.                                             |
| **ジェ**                       | `je`                                           | `zye`, `jye`, `zixe`                                             | Standard IME input for extended Katakana ジェ.                                             |
| **チェ**                       | `che`                                          | `tye`, `cye`, `tixe`                                             | Standard IME input for extended Katakana チェ.                                             |
| **ファ, フィ, フェ, フォ**     | `fa, fi, fe, fo`                               | `fua, fui, fue, fuo`                                             | Standard IME shortcuts vs decomposed kana combinations.                                    |
| **ヴァ, ヴィ, ヴ, ヴェ, ヴォ** | `va, vi, vu, ve, vo`                           | `buxa, buxi, buxe, buxo`                                         | Extended Katakana voiced labiodental series.                                               |
| **じゃ, じゅ, じょ**           | `ja, ju, jo`, `zya, zyu, zyo`, `jya, jyu, jyo` | _(None; `dya/dyu/dyo` removed as they represent ぢゃ/ぢゅ/ぢょ)_ | Prevents conflation with dakuten ぢ digraphs.                                              |

### Chōonpu (ー) Dual-Tier Rules

- **Strict IME:** Accepts only `-` (hyphen/minus). Phonetic repeats like `koohii` are rejected.
- **Learner Mode:** Accepts `-` and the final vowel of the nearest kana token to the left, looking through other `ー` (`koohii` and `ko-hi-` for `コーヒー`). After ん, a standalone っ, a skip token or at the start of a prompt only `-` is accepted.

### Sokuon (っ / ッ) Consonant Doubling

- **Merged っ:** `っ` followed by a kana becomes one token with the following kana's key. Every spelling that starts with a consonant other than `n` or `y` is doubled (`ch` gives `tch` and `cch`), and the `xtu`/`ltu`/`xtsu`/`ltsu` prefix is accepted before any spelling (spec D5, D22).
- **Standalone っ:** At the end of a prompt, before `ん`, `ー`, another `っ` or a skip token, `っ` is its own token with the four prefix spellings. It never merges across a prompt boundary.

### Syllabic ん / ン Contextual Lookahead (spec D2, D3, A15)

- `nn` and `n'` are always accepted. A bare `n` is stored as a spelling that may only precede certain spellings of the next token: those starting with a consonant other than `n` or `y`, and in learner mode also those starting with `n`.
- The next token is looked up across prompt boundaries. At a boundary, learner mode accepts a bare `n` before any spelling of the next prompt. At the end of the stream and before a skip token a bare `n` is always accepted.

### Skip tokens (spec D8)

Punctuation and spaces (`SKIP_CHARACTERS`) are tokens that need no input; the matcher passes over them and statistics ignore them.

### Reading Hints (`readingHints`)

In vocabulary words, certain particles and irregular kanji readings deviate from base kana tables. For example, the topic marker `は` in `こんにちは` is pronounced `wa`.

- `compile()` inspects `prompt.readingHints`.
- In `learner` mode, the specified token index receives the hint spelling (e.g. `wa` for `は` in `こんにちは`).
- Without a hint, `は` strictly requires `ha` in both modes (e.g. `はな` rejects `wana`).

---

## 3. NFA Romaji Engine Contract

The romaji engine (`packages/engine/src/matcher/`) is a pure, immutable Non-deterministic Finite Automaton (NFA) evaluator over a **stream of prompts** (spec [Input engine rules](../spec/engine.md)). It does not touch the DOM, timers, or storage, and holds no module-level state: it is created from a kana table. `apps/web/src/entities/prompt/lib/engine.ts` binds it to the app's table (`createEngine(engineTable)`) and re-exports the functions, so the rest of the app imports them from `@/entities/prompt`.

A position is `(token, spelling, offset)` plus the keystroke indices of the path that led to it. A token whose spelling is typed in full is _done_ and waits for the first key of the next token; the spelling's `next` set limits which spellings of that token may follow (this is how a bare `n` is tied to its context). Positions of several readings live side by side, so `hon` in relaxed mode keeps both the bare `n` and the first half of `nn`.

### Public Engine API

```ts
export function createEngine(table: EngineTable): Engine;

type Engine = {
  compile(prompts: readonly PromptItem[], strictness: Strictness): Matcher;
  extend(matcher: Matcher, prompts: readonly PromptItem[]): Matcher; // old states stay valid
  start(matcher: Matcher): MatchState;
  step(matcher: Matcher, state: MatchState, char: string): MatchState | null; // null = rejected
  isComplete(matcher: Matcher, state: MatchState): boolean; // end of the stream reached
  committedPrompts(matcher: Matcher, state: MatchState): number;
  committedTimings(matcher: Matcher, state: MatchState): readonly TokenTiming[];
  settledPrompts(matcher: Matcher, state: MatchState): number; // committed, timings agreed
  extensions(matcher: Matcher, state: MatchState): ReadonlySet<string>;
  view(matcher: Matcher, state: MatchState): EngineView; // live conversion
  errorTarget(matcher: Matcher, state: MatchState): number;
  compact(matcher, state): { m: Matcher; s: MatchState; droppedTokens: number };
  canonical(matcher: Matcher, promptIndex: number): string;
  spellingsFor(key: KanaKey, strictness: Strictness): readonly string[];
  canonicalFor(key: KanaKey): string;
};
```

`createErrorLog()` is a separate pure helper for per-token mistakes and "expected kana → typed character" pairs. `Engine` members are function-typed properties, so they can be destructured. The spec's [API section](../spec/engine.md) is normative; this list only names what the app uses.

- **`step(matcher, state, char)`**: Returns a new `MatchState` if `char` advances at least one position. If rejected, returns `null` without modifying the existing state. The state counts accepted keystrokes only.
- **`committedPrompts`**: Prompts finished in every active position. A prompt ending in ん is not committed until the next key settles whether the ん was a bare `n` or `nn`.
- **`view` and `errorTarget`**: `view` gives the display position for the input field; `errorTarget` charges a rejected key or a hint to the earliest token any position is typing, but never before the prompt on display (D10, A34).
- **`compact`**: Drops the prompts counted by `settledPrompts` and rebases indices; the session calls it after every 20 committed prompts.
- `shouldAbsorb` and the 250 ms absorption window are gone (spec D3): a surplus `n` is resolved by matching the stream.

### `createSession()` and `createTrainer()` (`features/training`)

`createSession({ nextPrompt, config, stats?, clock?, scheduler?, … })` returns a `Session`: the signals a view reads (`currentPrompt`, `stream`, `caret`, `romajiBuffer`, `mistake`, `phase`, `metrics`, `promptResults`, `completedPrompts`, `correctKeystrokes`, `liveKpm`, `liveAccuracy`, …) and the actions `loadPrompt`, `handleIntent`, `finish`, `reset`. Everything is held by the instance, so two sessions share no state (D17). `config` is read once per `loadPrompt`, and the test runs by that snapshot; `stats` (`record`, `flush`; a no-op by default, `createTrainer` passes the `entities/stats` functions) receives the token outcomes (ADR 049). `createTrainer()` composes one session with the prompt source (pool, weights, `Rng`) and the loading of vocabulary content; the trainer page creates it, calls `start()` (first prompt, following the settings, content loading) and reads its signals. Vocabulary loads are tracked per kind (ADR 046): while the selected kind loads the session ignores keys (`inputBlocked`) and no prompt is shown; a failure keeps the setting and offers `retryContent()`; the function returned by `start()` also resets the session, so no timer outlives the screen. Keystrokes are counted by `lib/key-tally.ts` (totals plus accepted keys per second), never stored; `lib/metrics.ts` computes `SessionMetrics` from it when a test ends. `liveKpm` and `liveAccuracy` count the tokens before `view().activeToken`, which are committed in every position, once each.

The session keeps the displayed prompt and, after it, up to 72 tokens of prompts in the matcher (`AHEAD_TOKENS`) (`extend` in batches as the caret moves on, no more than a count test needs), so the stream can draw the lines ahead and the context of a non-final ん is known long before it is typed. The stream the view draws is a separate window (ADR 040): `stream` lists the prompts around the caret with their tokens and changes in steps (ADR 043: only when fewer than 44 tokens are left ahead, or when 60 or more tokens can leave the head; what leaves is whole lines, from the first prompt of the line above the caret, which the view reports through `setTrimPoint` (ADR 047); not on every completed prompt); `caret`, `romajiBuffer` and `mistake` change on a keystroke and are meant to be written to the DOM without a render by `lib/stream-dom.ts`. Tokens are numbered from the start of the test, so `compact()` renumbers nothing the view holds. The view wraps the tokens of a prompt in `nowrap` groups (`lib/token-groups.ts`: a yōon and `っ` with its kana are one token already; `ー` and closing punctuation join the token before, an opening bracket and a lone `っ` the token after), and `lib/stream-dom.ts` marks a prompt wider than the line `is-long` when it measures, so only such a prompt breaks, and only between groups (ADR 060). On a touch screen the test screen shows a "show the romaji" button in place of the Esc hint, and below 640 px `ModePanel` folds into a one-line summary with a button that opens it. The next prompt is shown as soon as `view()` reaches its first token; a prompt's result (`recordPromptResult`, `recordTokenOutcomes`) is recorded when `settledPrompts()` includes it, with `endedAt` the time of the keystroke that committed it; when a zen test is finished by hand or a time test runs out, every prompt before the displayed one is recorded, a final ん included, and `completedPrompts` (the live counter) holds that number (ADR 050). `compact()` also lets go of the keystroke times no remaining token needs, and `promptResults` is copied only when read. Token times come from `committedTimings` and the times of accepted keystrokes; the first token of a test has no preceding keystroke and reports `ms` 0, which `updateKanaStats` treats as no measurement. A rejected key and Esc are charged to `errorTarget()`. `handleIntent(intent)` takes no strictness: it is fixed by `loadPrompt`, and a settings change makes the trainer restart the session.

---

## 4. Extension Recipes

### Recipe A: Adding a New Kana Row / Table

1. Define the row identifier in `packages/engine/src/types.ts`:
   ```ts
   export type CustomRowId = 'my_custom_row';
   export type RowId = BasicRowId | ... | CustomRowId;
   ```
2. Add the data table in `packages/engine/src/data/`:
   ```ts
   export const customRows: readonly KanaRow[] = [ ... ];
   ```
3. Re-export it in `packages/engine/src/data/index.ts`, include it in `allKanaRows`, and export a new group from `packages/engine/src/index.ts` and `apps/web/src/entities/prompt/model/data/index.ts` if the app needs it.
4. Run `pnpm --filter @nekotype/web run fonts` (downloads the pinned sources, ADR 034) so `glyphs.txt` and the font subset include the new glyphs (a test fails while `glyphs.txt` is out of sync).
5. Run `pnpm test`: the row-count and `RowId` tests in `packages/engine/src/data.test.ts` need updating, and the property tests cover the new entries in both strictness modes.

### Recipe B: Adding Vocabulary Words or Phrases

> These files are test fixtures from P4 on: content is generated by the content pipeline, not edited by hand (spec D19).

1. Open `apps/web/src/entities/prompt/model/data/words.ts` or `phrases.ts`.
2. Append a new `ContentItem`:
   ```ts
   {
     id: 'word:arigatou',
     text: 'ありがとう',
     script: 'hiragana',
     meaning: { en: 'thank you', ru: 'спасибо' },
     // Optional: readingHints: [{ tokenIndex: 0, learner: ['...'] }]
   }
   ```
3. Run `pnpm --filter @nekotype/web run fonts` to refresh `glyphs.txt` (a test checks it is in sync).
4. The content loader (`loadContent`) dynamically chunks words and phrases on demand, preserving the initial JS budget; `check-budget.mjs` limits a content chunk to 40 KB gzip.

### Recipe C: Adding a New Language Locale

1. In `apps/web/src/shared/i18n/`, create `es.ts` with the same keys as `en.ts` (`ru.ts` shows the form; a test checks key parity).
2. Add the locale code to `Locale` and to the checks in `initLocale` in `apps/web/src/shared/i18n/locale.ts`.
3. Load it like `ru` in `apps/web/src/shared/i18n/dictionary.ts`: a dictionary other than `en` is a lazy chunk, and `t()` reads the `dictionary` signal (ADR 057).
4. Add the language toggle option in `apps/web/src/app/App.tsx` (the `Segmented` in the navigation).

### Recipe D: Adding a Test Mode (e.g. Sudden Death)

Zen (ADR 042) is the worked example: a test with no length that is ended by hand.

1. Add the member to `ValidTestConfig` in `packages/shared/src/types.ts` and to `isTestConfig` in `packages/shared/src/runtime.ts`. `TestConfig` in `apps/web/src/entities/settings/model/types.ts` derives from it. Stored settings are validated with the guard, so an unlisted mode is discarded on load; adding a member keeps what was saved before valid, so no migration is needed. Test it with a settings value from before the change.
2. Let the compiler list the places that switch on `kind`. In the session (`features/training/model/session.ts`) a mode decides whether a deadline timer is armed (`time`), whether the stream has an end (`count`) and how the test can end (zen: `finish()`); `LiveLine` (counter) and `ModePanel` (selector, length group) follow.
3. If the mode ends in a new way, add a key intent (`finish` in `shared/lib/input/input-adapter.ts`), let the input source pass it (`shared/lib/input/input-source.ts`) and handle it in `handleIntent`. Decide what a test that ends with nothing to keep does, and say it in `docs/spec/metrics.md` ("Test end").
4. Add tests at each level: the guard, the session (without rendering), the key, and an e2e of the whole flow.

---

## 5. Mobile & On-Screen Input Seam

The input layer feeds one stream of `KeyIntent`s from several sources (ADR 038, spec [Frontend](../spec/frontend.md)). `shared/lib/input/input-adapter.ts` classifies a key or a character; `shared/lib/input/input-source.ts` listens to the DOM:

```
[ keydown (desktop) ]──────────┐
[ beforeinput insertText ]─────┤
[ input diff (Gboard) ]────────┼─► [ input-source ] ─► KeyIntent { kind: 'char', char: 'k' }
[ On-Screen Touch Pad ]────────┘          │                              │
                                  notices │ (IME, layout)                ▼
                                          ▼                         [ Session ]
                                   [ TestStage ]                         │
                                                                         ▼
                                                                 [ NFA Engine.step ]

- `keydown` with a Latin letter, `-` or `'` is handled at once and cancelled. `Unidentified` (mobile) and `Process` (IME) are skipped.
- `beforeinput` of type `insertText` is handled and cancelled; when it cannot be cancelled (Gboard composition), `input` compares the field with the last value and processes only the characters added at its end. The field is cleared when a composition ends and after every input that is not part of one.
- A letter outside the Latin alphabet is not translated by `event.code`: it is dropped without a mistake and asks for the layout. Kana or kanji ask to turn the IME off.
- Latin text of a composition is held until the IME is shown to be off (a latin vowel, the end of a composition without kana, or a key typed directly); kana drop it (ADR 051). A latin vowel in a composition also hides the IME notice.
- A repeated `keydown` is cancelled and is not input. Ctrl/Cmd+Enter is cancelled only when `Session.canFinish()` says it would end a test.
- Typing outside the field returns the focus to it, except in another text field or while a dialog is open.
```

### Implementing a Mobile / On-Screen Touch Keyboard

1. Create a touch keyboard component in `apps/web/src/features/training/ui/touch-keyboard.tsx`.
2. When the user taps a virtual key button (e.g. `'k'`, `'a'`, or `Esc`), dispatch the intent directly:
   ```ts
   controller.handleIntent({ kind: 'char', char: 'k' });
   ```
3. No DOM `<input>` refocusing or composition hooks are needed for virtual keys; the session processes the intent directly.

---

## 6. Verification Gates & Quality Guarantees

Every commit and pull request must satisfy `pnpm run verify`, which CI also runs. The root script runs each step in every package that defines it (`pnpm -r --if-present`):

1. **`pnpm run typecheck` (`tsc --noEmit`)**: Maximum strictness TypeScript checks. Zero `any`, zero `as T`, zero `!`.
2. **`pnpm run lint`**: ESLint AST inspection in every package; in `apps/web` also Steiger FSD architectural boundaries and the import restrictions of section 1.
3. **`pnpm run format:check` (`prettier --check .`)**: Formatting of the whole repository.
4. **`pnpm run test` (`vitest run`)**: Unit, integration, property and render-isolation tests. `packages/engine` runs with a v8 coverage threshold of 95% for statements, branches, functions and lines (the spec target; the package measures 100%).
5. **`pnpm run build` (`vite build`)**: Production client bundle into `apps/web/dist`, with the Vite manifest.
6. **`pnpm run budget` (`node scripts/check-budget.mjs`)**: Reads the manifest and enforces hard budget limits (gzip unless stated; brotli is reported next to it). Figures from the design-foundation build (ADR 034):
   - Initial HTML: ≤ 5 KB (actual 0.44 KB)
   - Initial JS, the entry and its static imports: ≤ 35 KB (actual 32.67 KB)
   - Initial CSS: ≤ 10 KB (actual 6.03 KB)
   - Fonts (woff2, read from `dist`): ≤ 45 KB per file (actual 20.77 KB Noto Sans JP 400, 10.66 and 10.69 KB JetBrains Mono 400/500, 9.38 and 9.55 KB Golos Text 400/500)
   - Total first load: ≤ 160 KB, including the SVG of the initial chunk, the logo (actual 102.39 KB)
   - Lazy route chunk: ≤ 25 KB; content chunk (`words`/`phrases` modules): ≤ 40 KB (actual 1.60 KB and 2.05 KB; the largest route chunk is the Russian dictionary, 1.98 KB)
7. **`pnpm run e2e` (`playwright test`)**: Chromium and WebKit (iPhone 13 emulation) against the production bundle (`vite build` into `dist-e2e`, served by `vite preview` on a port of its own, 5273; ADR 045), then the latency test (`playwright.latency.config.ts`): it runs a probe build (`pnpm run build:probe`, `vite preview`) with 4× CPU throttling and checks, for Words and Phrases, the keystroke p95 budgets and a ceiling on the worst keystroke (ADR 043, 048). `check-budget` fails when `dist` contains the probe.

Git hooks run the same checks earlier (`pre-commit`: staged formatting, typecheck, lint, unit tests; `pre-push`: `verify`).

---

## 7. Public Domain API Signatures & Contract Specifications

### `entities/stats`

- `updateKanaStats(prev: KanaStats | undefined, mistakes: number, ms: number): KanaStats`: Completely pure function; calculates new attempt count `a`, mistake count `m`, EMA response latency `t` ($\alpha = 0.3$; `ms` 0 is no measurement and keeps `t`), and applies `decayStats` (halving `a` and `m` when $a > 50$). Returns a fresh `KanaStats` object without mutating `prev`.
- `ProgressMap`: Defined as `ReadonlyMap<string, KanaStats>`, guaranteeing immutable consumption by weights calculators.
- `computeItemWeight(tokenKeys: readonly string[], weights: ReadonlyMap<string, number>): number`: Evaluates prompt weight for words/phrases by computing the arithmetic mean over all constituent token kana keys (unseen keys defaulting to weight 3.0, per section 8 of the [archived v1 plan](../archive/v1-implementation-plan.md)). Since D20 it is used: `createPromptWeights()` in `features/training` maps each word or phrase to the `KanaKey`s of its tokens and weighs it by their mean; a single kana key weighs what it did before.

### `entities/settings`

- Holds the practice settings (`script`, `content`, `strictness`, `weakFocus`), the display setting `showTranslation` (not a practice setting, so it does not reset a test, ADR 056), the test length `testConfig` and the learning settings (`learnStrictness`, `learnTrack`, `learnTargetMs`; the sound flag is stored only) as `ReadonlySignal`s, and the actions that change them (`setScript`, `setTestConfig`, `setLearnStrictness`, `setTrack`, `setTargetMs`, …). `initSettings(db)` reads the `settings` record (`current`) from IndexedDB, replaces a value that fails `isSettings` with the defaults and sets `settingsReady`; `app/route-view.tsx` shows the loading line until then. Each action writes the whole `Settings` document at once (no debounce, nothing waits for `pagehide`) and sets `updatedAt` from the `Clock`. It does not import `entities/prompt`: its `ScriptMode` and `ContentKind` derive from `ValidSettings`.
- `content` defaults to `words`. A saved value that fails validation (for example the removed `single`) is replaced by the defaults, with no conversion (ADR 061); a stored `rowIds` is ignored.
- Changing a setting does not reset the session here (a slice cannot import another); `setupSettingsResetWatcher` in `features/training` does.

### `entities/learn`, `pages/learn` and the learning widgets (P3)

- `entities/learn/lib` is the learning logic with no UI: track composition and dependencies (`tracks`), recall answer time with K (`answer-time`), confidence (`confidence`), one-at-a-time unlocking (`progress`), boxes and due dates on the local calendar day (`boxes`, `day`), streak (`streak`), 100 ms buckets and the daily median (`buckets`), and the cell state of the chart (`chart`). `entities/learn/model/store` holds the learning state as a `ReadonlySignal`; it loads the `delta` record when `/` loads (`status`: `loading`, `ready`, `error`; a missing or invalid record gives the initial state, a failed read gives `error`, and after an error nothing is written, so the stored record is never replaced by the initial state; `retryLearn()` reads again), applies an answer, and writes once per answer after the keystroke handler through the injected `Scheduler` (a failing database means memory mode). Merge functions for `delta` are in `packages/shared` (`learn-runtime.ts`); property tests for them come in P5.
- `pages/learn` is the learning screen: the chart of the selected track (`KanaChart`: blocks side by side with captions, a legend, a details panel per kana — `KanaChartPanel`), `mastered X of N` and the streak on one row with the track switch (the streak is hidden until the first answer; a first-visit line takes its place), `continue` (focused when the screen is ready) and `review (N)`, then one reserved `Notice` line (loading, a failed read with `retry`, or progress that cannot be saved), where N counts the due kana — confident, box 1 or higher, `dueAt` passed (`isDueKana`, ADR 062) — exactly the due marks of the chart. `model/session.ts` is `createLearnSession(deps)` (`Clock`, `Scheduler`, `Rng`, the learning store, `AudioProvider`), a session of 25 tasks, and a review session of at most 20 recalls. The romaji shown to the learner is `displayRomaji` (`lib/romaji`): the table's canonical spelling, except ん and ン, shown as `n`; an introduction takes only the romaji it shows (another spelling is a rejected key), recall takes every spelling of the learning strictness. After a wrong choice the screen draws the hint to go on: `enter` and `next`, or a `next` button under `pointer: coarse`. `lib` holds task choice, distractors, the review queue, the summary and the hook binding the session to the input source. The session runtime and the summary are lazy chunks. ADR 015 keeps the session in the page, which is its only consumer.
- `shared/ui` holds `KanaTask`, `createTaskController`, `OptionCard` and `KanaChart` as presentational components: data, states and strings come as props, and they import nothing from `entities` or `pages`. The input source (`shared/lib/input`) serves both the trainer and the learning session.
- `pages/stats` (a lazy route) shows the learning statistics: current and best streak and mastered kana of both tracks as `Stat`s, the daily median answer time of one track at a time (`ResultChart`: a gap for a day without answers, a dot per point, the target answer time as a dashed line, a cursor on the pointer and ← →; the switch is local and does not change `settings.learn.track`), the learning counters, and the empty state (`EmptyState`, the sleeping `Cat`) before the first answer. `Stat`, `Cat` and `EmptyState` are in `shared/ui` and out of its barrel, so they stay in the lazy chunk. The typing section comes in P4.
- SVG attributes are written in kebab-case (`stroke-width`, `text-anchor`): Preact core writes JSX names as they are, and the browser ignores a camelCase one. `app/svg-attributes.test.ts` fails on a camelCase attribute.
- Learning and typing data are separate: typing code does not import `entities/learn`, a learning session does not write `kanaflow:progress:v1`, and no IndexedDB write happens inside a keystroke handler.
- `packages/engine` also holds the table of visually similar kana and the track composition helpers (`kanaOf`, `kanaRows`) used for distractors and the chart.

### `entities/prompt`

- `buildPool(settings: PoolSettings, content?: readonly ContentItem[]): readonly PromptItem[]`: Builds the prompt pool from the loaded words or phrases, filtered by the script mode. It is empty while the vocabulary is not loaded or when nothing matches the script; the trainer then shows no prompt and blocks input (a loading notice, or the load error with Retry). There is no kana fallback pool since P3 (ADR 019, 028 are superseded).
- `pickPrompt(pool: readonly PromptItem[], weights: ReadonlyMap<string, number>, rng: Rng, previousKey: string | null): PromptItem`: Selects the next prompt using weighted distribution. Throws an invariant Error on an empty pool, which `buildPool` no longer produces.

### End-to-End Browser Certification (`e2e/`)

- `@playwright/test` is a `devDependency` of `apps/web`, invoked via `pnpm run e2e` and run as the last step of `pnpm run verify`, locally and in CI (Chromium, and WebKit in mobile emulation; CI installs and caches the browser).
- The tests in `apps/web/e2e/` cover browser-native focus restoration, click coordinate physics, cross-reload local storage synchronization and the results panel animation.
