# ADR 073: Test Result Assembly

- **Status:** In force.
- **Context:** The session knew how to count a test but not what a saved result needs: the settings, an id, the versions. Statistics were written per prompt to `localStorage` through a `stats` hook, so a discarded test still changed them, against D23. P4 stores a `TestResult` per test, with the kana statistics and the records, in IndexedDB.
- **Decision:**
  1. The session only reports. When a test ends and is kept (`complete` or `manual` in this ADR's scope) it calls `onEnd(EndedTest)` once: times, `tokens` and `erroredTokens` (the unfinished prompt included), `items`, `keystrokes`, `rejectedKeystrokes`, `assisted` and `kanaDelta` (committed tokens and errored ones per kana). The per-prompt `stats.record` and `flush` hooks are gone.
  2. The trainer assembles the `TestResult`: the report plus `content` and `script` from the settings, `id` (UUID v7 from the end time and `crypto.getRandomValues`, both injectable), `kpm` and `kanaAccuracy` rounded for storage, `repeated` (false until Repeat), `contentVersion` from `manifest.json` and `appVersion`. A test with no time has KPM 0.
  3. `appVersion` is the Vite define `__APP_VERSION__`: the first 12 characters of `GITHUB_SHA`, else of `git rev-parse HEAD`, else `dev`.
  4. `entities/stats` saves the result, the delta and the records in one transaction, decides `celebratedPersonalBest` from the records it holds, and returns the average and best from before the test. The `started` counter is written at the end, with the result, or alone for a discarded test (restart, in-app navigation, a zen finish with nothing to keep). Nothing is written during a test, and a test's last keystroke does not write: the save is asynchronous.
  5. Typing progress leaves `localStorage`; `kanaflow:progress:v1` joins the legacy keys that are deleted unread.
- **Justification:** One place knows the settings and the versions, the session stays free of storage and settings (D17), and one transaction per test keeps results, statistics and records consistent. Statistics change only at the end of a test, so `weakFocus` reads those from before it began.
- **Consequences:** The kana statistics are the shared `KanaStat` (attempts and errored attempts, no reaction time). The idle and hidden ends (PR 9), the results screen (PR 10) and Repeat (PR 11) build on `onEnd` and `lastSaved`.
