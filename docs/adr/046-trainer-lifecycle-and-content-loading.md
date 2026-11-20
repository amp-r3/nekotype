# ADR 046: Trainer Lifecycle and Vocabulary Loading

- **Status:** Superseded by [ADR 093](093-learning-only-words-in-learning.md): the trainer and its vocabulary loading left in P6. Amended by [ADR 058](058-learning-first.md) from P3: item 4 has no fallback pool, so there is nothing to type until a failed load succeeds.
- **Context:** Leaving the training screen removed the settings watchers but left the session timers running: a time test could end on another page and write statistics, which `metrics.md` forbids. A vocabulary chunk that arrived late restarted the trainer whatever the user was doing, so it destroyed a running test; one failed load rewrote the content setting to Single Kana for good; the loading flag was shared by both kinds, so one load cleared the other's notice; notices were inserted conditionally and moved the text.
- **Decision:**
  1. Stopping the trainer resets its session, which clears every timer.
  2. Loads are tracked per kind (loading and failed sets). Only the selected kind drives the notice and blocks input. A loaded chunk is always cached and restarts the test only if its kind is still selected.
  3. While the selected vocabulary loads there is no prompt and the session ignores keys (`inputBlocked`). The stream keeps its height from the computed line height.
  4. A failed load keeps the setting. The notice offers Retry (`retryContent`); the fallback pool (kana) is practised and typing is allowed until it succeeds. A failure of an unselected kind shows nothing.
  5. Loading, error and no-kana notices share one reserved `data-chrome` slot above the stream.
- **Justification:** The user's choice is data (storage key `kanaflow:settings:v1`) and a network failure must not rewrite it. Blocking input during the load avoids the choice between losing keys silently and losing a test to a late restart.
- **Consequences:** The test "a failed load… falls back to single kana" is replaced by one that keeps the setting (spec `frontend.md`, "Loading"). The error text no longer says "reverted".
