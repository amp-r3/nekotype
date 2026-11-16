# ADR 081: The Sync Measurement of P5 Fails Its Limits; the Caps of Q1 Stay Unconfirmed

- **Context:** [ADR 078](078-user-stats-targeted-updates.md) made a sync cost depend on the batch and not on the history, and asked the first P5 pull request to measure it on Cloudflare before the endpoint is built. `apps/bench` applied the batches of `generateBatch` (a learning sync, a batch at the caps of Q1, 50 results) to a year-long row in a Pages Function, 5 cold and 50 warm requests each ([research note](../research/2026-11-16-p5-sync-cpu.md)). The pass line of [p5-plan.md](../../p5-plan.md) was 8 ms of CPU for every cold request and the warm p95 (2 ms of the 10 are left for the session, validation and routing), at most 250 rows read for a learning sync, and at most 151 rows written for the 50 results.
- **Measured:** Cold `cpuTime` 13–39 ms for the three batches and 7–11 ms for the whole-row `GET`; warm p95 15–21 ms (`GET` 7 ms); a learning sync reads 630 rows, the batch at the caps 1,087, the `results` batch 283; every batch writes 1 row as D1 reports it. `json_each` counts every element it visits as a row read (O4).
- **Decision:**
  1. The data model of ADR 078 as built **does not pass** and is not confirmed. This pull request changes no behaviour of the product and builds no endpoint; PR 2, PR 4 and PR 5 wait for the maintainer's decision on a follow-up to ADR 078.
  2. The caps of Q1 (60 kana and 31 bucket days per track) are kept as the starting values in `BATCH_CAPS` of `@nekotype/shared/testing`, **unconfirmed**: the batch at the caps is the slowest (warm median 12 ms, p95 21 ms), so a follow-up that keeps the model must lower them. The final values are recorded in the ADR of the follow-up.
  3. `apps/bench`, `@nekotype/shared/testing` and the per-key patch functions (`learn-patch.ts`, with their property and equivalence tests) stay: they are correct whatever the follow-up is, and PR 5 and PR 13 measure with them again.
- **Justification:** The plan says a measurement outside its limit is reported and not worked around. The findings point to where the cost is, which is the input to the maintainer's choice:
  - the response alone (a 309 KB snapshot read and sent) takes 4 ms warm and 7–11 ms cold, so the candidates "a response that omits unchanged columns" and "a smaller response" address the largest single part;
  - the merge adds about 3–8 ms warm, so lower caps address the rest;
  - the touched-key reads are not free in rows (630 per learning sync), so the daily read budget limits a learner to about 7,900 syncs a day before the writes do.
- **Open:** Which follow-up to ADR 078: lower caps, a response without unchanged columns, a different split of the columns, or an accepted overrun of the platform's tolerance (rejected by O4 as a design basis). The maintainer decides. The real endpoint is measured again at the end of PR 5.
- **Consequences:**
  - New: `apps/bench` and the `@nekotype/shared/testing` entry point ([architecture.md](../spec/architecture.md)), the research note, and an import rule that keeps `shared/testing` out of the application's non-test files.
  - [decisions.md](../spec/decisions.md), O4: how `json_each` is counted.
  - No effect on the client bundle.
- **Status:** In force. The follow-up to ADR 078 is open.
