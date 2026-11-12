# ADR 072: Delta Split per Mode

- **Status:** In force.
- **Context:** `storage-sync.md` kept one `delta` record (`current`) for learning and typing changes. Learning writes after every answer and typing writes after every test; with one record each write reads and rewrites the other mode's data, two tabs in different modes overwrite each other, and a bug in one mode's writer can damage the other's data. A39 requires the modes to stay separate.
- **Decision:**
  1. The `delta` store holds two records: `learn` (learning changes) and `typing` (typing kana statistics and counters). The `current` key is gone.
  2. A sync batch is built from both records and clears both in one transaction.
  3. Schema 3 also creates `results` (indexes `endedAt`, `synced`) and `records`. Before the release the schema reset of ADR 061 applies; no migration is written.
  4. The IndexedDB wrapper gets `getPage(store, index, { direction, offset, limit })` and `count(store)`, with the same behaviour in the memory fallback.
- **Justification:** One writer per record removes the cross-mode read-modify-write and makes the isolation of A39 structural.
- **Consequences:** The learning store reads and writes `delta/learn`. The typing store (P4 PR 8) writes `delta/typing`. P5 builds batches from both.
