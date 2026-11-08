# Architecture Decision Records

Append-only log of architectural decisions, one file per decision.

- Entries are never deleted or rewritten. A decision that no longer holds gets a `**Status:**` line naming what superseded or amended it, and its row below is updated. An entry without a Status line is in force.
- The [MVP spec](../spec/README.md) defines the requirements; its [design decisions](../spec/decisions.md) table (A1…) holds the decisions made while writing the spec.
- Decisions made during implementation are added here, continuing the numbering.

## Adding a decision

1. Create `NNN-short-title.md` with the next number.
2. Use this structure:

   ```markdown
   # ADR NNN: Title

   - **Context:** the problem and the constraints.
   - **Decision:** what was decided.
   - **Justification:** why, and which alternatives were rejected.
   ```

3. Add a row to the index below. If the decision replaces an earlier one, add a Status line to the earlier file and update its row.

## Index

| ADR                                                                                  | Title                                                                                        | Status               |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------- |
| [001](001-preact-and-preact-signals.md)                                              | Preact and @preact/signals                                                                   | In force             |
| [002](002-tailwind-css-v4-css-first-configuration.md)                                | Tailwind CSS v4 CSS-First Configuration                                                      | In force             |
| [003](003-steiger-for-fsd-architecture-enforcement.md)                               | Steiger for FSD Architecture Enforcement                                                     | In force             |
| [004](004-node-based-font-subsetting-subset-font.md)                                 | Node-based Font Subsetting (`subset-font`)                                                   | In force             |
| [005](005-extended-katakana-row-prefix-ext.md)                                       | Extended Katakana Row Prefix (`ext_`)                                                        | In force             |
| [006](006-sokuon-doubling-and-standalone-fallback.md)                                | Sokuon Doubling and Standalone Fallback                                                      | Superseded           |
| [007](007-choonpu-dual-tier-matching.md)                                             | Chōonpu (ー) Dual-Tier Matching                                                              | In force             |
| [008](008-n-contextual-lookahead.md)                                                 | ん/ン Contextual Lookahead                                                                   | Superseded           |
| [009](009-extended-katakana-and-ambiguous-romaji-tier-placement.md)                  | Extended Katakana and Ambiguous Romaji Tier Placement                                        | In force             |
| [010](010-font-subsets-and-included-weights.md)                                      | Font Subsets and Included Weights                                                            | Superseded by 032    |
| [011](011-state-division-and-storage-isolation-entities-kana-vs.md)                  | State Division and Storage Isolation (entities/kana vs entities/session)                     | Superseded           |
| [012](012-pure-weight-decay-and-mistake-based-kana-mastery.md)                       | Pure Weight Decay and Mistake-Based Kana Mastery Model (entities/progress)                   | Superseded           |
| [013](013-trailing-extension-absorption-and-desktop-input-normalization-features.md) | Trailing Extension Absorption and Desktop Input Normalization (features/type-prompt)         | Superseded           |
| [014](014-deviation-audit-and-alignment-with-plan-v1-1.md)                           | Deviation Audit and Alignment with Plan v1.1                                                 | Partially superseded |
| [015](015-merging-widgets-layer-into-pages-trainer-ui.md)                            | Merging Widgets Layer into `pages/trainer/ui/`                                               | In force             |
| [016](016-unified-reactive-settings-reset-watcher-setupsettingsresetwatcher.md)      | Unified Reactive Settings Reset Watcher (`setupSettingsResetWatcher`)                        | In force             |
| [017](017-comprehensive-accessibility-pass.md)                                       | Comprehensive Accessibility Pass                                                             | In force             |
| [018](018-playwright-e2e-test-suite-for-real-browser-focus.md)                       | Playwright E2E Test Suite for Real Browser Focus Redirection and Layout Physics Verification | Amended              |
| [019](019-runtime-fallback-for-vocabulary-pools-in-buildpool.md)                     | Runtime Fallback for Vocabulary Pools in `buildPool`                                         | Superseded by 058    |
| [020](020-readonlysignal-export-pattern-for-store-state.md)                          | ReadonlySignal Export Pattern for Store State                                                | In force             |
| [021](021-global-keyboard-binding-decoupling-bindkeyboard.md)                        | Global Keyboard Binding Decoupling (`bindKeyboard`)                                          | Amended              |
| [022](022-key-intent-semantics-reveal-strictly-via-escape.md)                        | Key Intent Semantics: Reveal Strictly via Escape                                             | In force             |
| [023](023-local-git-hooks-complement-ci.md)                                          | Local Git Hooks Complement CI                                                                | In force             |
| [024](024-agents-md-as-the-single-agent-instruction-file.md)                         | AGENTS.md as the Single Agent Instruction File                                               | In force             |
| [025](025-rename-to-nekotype-and-new-pages-origin.md)                                | Rename to Nekotype and New Pages Origin                                                      | In force             |
| [026](026-pnpm-as-package-manager.md)                                                | pnpm as the Package Manager                                                                  | In force             |
| [027](027-pnpm-workspace-layout-for-the-monorepo.md)                                 | pnpm Workspace Layout for the Monorepo                                                       | In force             |
| [028](028-empty-pool-falls-back-to-basic-rows.md)                                    | Empty Kana Pool Falls Back to the Basic Rows                                                 | Superseded by 058    |
| [029](029-stream-engine-with-spelling-constraints.md)                                | Stream Engine with Spelling Constraints                                                      | In force             |
| [030](030-observers-and-compaction-of-the-stream-matcher.md)                         | Observers and Compaction of the Stream Matcher                                               | In force             |
| [031](031-adopt-the-nekotype-design-system.md)                                       | Adopt the Nekotype Design System from P2                                                     | Amended by 058, 059  |
| [032](032-font-weights-for-the-design-system.md)                                     | Font Weights for the Design System                                                           | In force             |
| [033](033-repeat-test.md)                                                            | Repeat Test                                                                                  | In force             |
| [034](034-design-tokens-and-font-build.md)                                           | Design Tokens and Font Build                                                                 | In force             |
| [035](035-entities-slice-layout.md)                                                  | Entities Slice Layout                                                                        | In force             |
| [036](036-session-factory-and-trainer.md)                                            | Session Factory and Trainer                                                                  | In force             |
| [037](037-router-and-application-shell.md)                                           | Router and Application Shell                                                                 | Amended by 058       |
| [038](038-hybrid-input-source.md)                                                    | Hybrid Input Source                                                                          | In force             |
| [039](039-redirects-rewrite-to-root.md)                                              | `_redirects` Rewrites to `/`                                                                 | In force             |
| [040](040-text-stream-window-and-dom-writer.md)                                      | Text Stream Window and DOM Writer                                                            | In force             |
| [041](041-test-screen-cutover.md)                                                    | The Test Screen on the Text Stream                                                           | In force             |
| [042](042-zen-test-and-finish-key.md)                                                | The Zen Test and Its Finish Key                                                              | In force             |
| [043](043-keystroke-latency-gate-and-stepwise-publishing.md)                         | Keystroke Latency Gate and Stepwise Stream Publishing                                        | In force             |
| [044](044-row-names-are-romaji.md)                                                   | Kana Row Names Are Romaji                                                                    | In force             |
| [045](045-e2e-on-production-bundle-and-gated-deploy.md)                              | e2e on the Production Bundle, and a Deploy Gated by a Smoke Test                             | In force             |
| [046](046-trainer-lifecycle-and-content-loading.md)                                  | Trainer Lifecycle and Vocabulary Loading                                                     | Amended by 058       |
| [047](047-stream-trimmed-by-whole-lines.md)                                          | Text Stream Trimmed by Whole Lines                                                           | Amended by 060       |
| [048](048-worst-keystroke-latency-gate.md)                                           | Worst-Keystroke Latency Gate on Every Content Kind                                           | Amended by 058       |
| [049](049-session-boundaries.md)                                                     | Session Boundaries: Injected Statistics, Config Read Once, Private Finish                    | In force             |
| [050](050-completed-prompts-at-test-end.md)                                          | Prompts Completed at the End of a Test, and the Memory of a Long Test                        | In force             |
| [051](051-input-source-rules.md)                                                     | Input Source: Held IME Letters, Auto-repeat and Ctrl/Cmd+Enter                               | In force             |
| [052](052-e2e-scope-and-latency-on-main.md)                                          | Browser Tests Off the Local Hot Path, Latency Gate on `main`                                 | In force             |
| [053](053-webkit-runs-mobile-tests-only.md)                                          | WebKit in Mobile Emulation Runs the `@mobile` Tests Only                                     | In force             |
| [054](054-ci-in-the-playwright-image.md)                                             | CI Runs in the Playwright Image, with a Time Limit                                           | In force             |
| [055](055-test-screen-focus-and-chrome.md)                                           | The Input Field Lives on the Page; Hover, Tab and Enter on the Test Screen                   | Amended by 058       |
| [056](056-show-translation-setting.md)                                               | The `showTranslation` Setting: an Optional Field of Settings v1                              | In force             |
| [057](057-lazy-results-screen-and-russian-dictionary.md)                             | The Results Screen and the Russian Dictionary Are Lazy Chunks                                | In force             |
| [058](058-learning-first.md)                                                         | Learning First, with Adaptive Unlocking of Kana                                              | In force             |
| [059](059-design-system-v10.md)                                                      | Design System Version 10                                                                     | In force             |
| [060](060-long-prompt-breaks-between-tokens.md)                                      | A Prompt Longer Than a Line Breaks Between Tokens                                            | In force             |
