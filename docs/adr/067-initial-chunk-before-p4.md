# ADR 067: One Initial Chunk, Per-Screen Dictionary Parts and a Compact Kana Table

- **Status:** In force. Amends [ADR 057](057-lazy-results-screen-and-russian-dictionary.md).
- **Context:** Before P4 the initial JS stood at 33.97 KB of the 35 KB budget (32.33 KB at the end of P3; the `/about` footer and design added the rest). P4 adds the results screen, typing statistics, the `/about` page and the content manifest, and every new string went into `en.ts`, which is in the initial chunk. Measuring the build showed where the first load paid for code it did not run:
  - Barrels (`@/shared/lib`, `@/shared/ui`) made modules that only lazy screens use (the keyboard input source, the dialog, the switch, the icons) reachable from the entry, and Rolldown placed them in initial chunks.
  - The entry was split into six initial chunks: six gzip streams and export lists between them.
  - The English dictionary held the strings of every screen; about half belong to `/type`, `/stats` and `/settings`.
  - The Vite `modulepreload` polyfill, the learning summary screen (shown only after a session) and the kana tables, written out in full, were in the first load.
- **Decision:**
  1. **Own modules are side-effect free.** `apps/web/package.json` declares `"sideEffects": ["**/*.css", "./src/app/main.tsx"]`. Dependencies keep their own setting: `@preact/signals` hooks into Preact when it is imported and must stay.
  2. **One initial chunk.** `vite.config.ts` groups every module the entry loads statically (`codeSplitting.groups`, Rolldown's `$initial` tag) into the entry chunk. A barrel that holds code of its own keeps every module it re-exports in that chunk, so barrels stay re-exports only (`packages/engine/src/data/index.ts`; the tables built from the rows moved to `tables.ts`).
  3. **No `modulepreload` polyfill.** Safari 16, the one target without `modulepreload`, still loads every chunk, only without the parallel prefetch.
  4. **Per-screen dictionary parts.** `shared/i18n` keeps the core dictionary (shell, `/`, the learning session and everything more than one screen uses) in `en.ts` and `ru.ts`. The strings only one lazy screen uses are a part of their own per language (`shared/i18n/parts/{type,stats,settings,about}/{en,ru}.ts`). `loadDictionaryPart(part)` loads a part in the current language; each route in `app/routes.tsx` awaits its page chunk and its part together, so a screen never renders before its strings, and a failed part is a failed route with Retry. A language switch loads the core and every part asked for so far before it changes the language (ADR 057 holds for parts). The idle prefetch loads both whole dictionaries. `TranslationKey` is the union of all parts; `t()` falls back to the key for a part that is missing.
  5. **The summary screen travels with the session.** `SummaryScreen` is exported by the session runtime chunk, which is loaded before a session can end; its own panel stays a chunk of its own.
  6. **Compact kana table.** The rows in `packages/engine/src/data/` are written one string per row (`'しシ shi,si|…'`) and expanded by `notation.ts` into the same `KanaRow` and `StandaloneRow` shapes when the module loads; a row's name is derived from its canonical spellings unless it gives its own. The engine, the content build and the font subset see the same tables.
- **Justification:**
  - Each step keeps behaviour: no screen, string or table entry changed, and every step is measured on its own (below).
  - Per-screen parts were chosen over loading both whole dictionaries lazily: English users would wait for a request before the first render. Parts cost a request per screen, made together with the screen's own chunk.
  - The strings a screen needs follow the screen, so P4 strings no longer grow the first load.
- **Consequences:**
  - Initial JS: 33.97 → 28.24 KB gzip (side effects −1.33, polyfill and summary −0.62, dictionary parts −0.93, one chunk −2.23, kana notation −0.62).
  - `check-budget.mjs` fails when the initial JS is more than one file, when a lazily imported module is folded into it, or when it lacks the Preact integration of `@preact/signals` (a wrong `sideEffects` setting would drop it).
  - A key of a part may be used only by its screen; `shared/i18n/dictionary-parts.test.ts` checks it, and the en/ru parity test runs per part. Unit tests that render a lazy screen without its route load its part first.
  - A change to the kana table changes `packages/engine/src/data/fixtures/kana-table.json` in the same commit: a golden test compares the expanded tables with it.
  - Two unused keys were removed (`stage.typePlaceholder`, `results.title`).
