import type { Db, Write } from './idb';

/**
 * A test helper: wraps `db.write` and `db.update` in place and returns the list that every
 * non-empty batch of writes is appended to. Reads through `update` (no writes) are not recorded.
 */
export function recordWrites(db: Db): Write[][] {
  const batches: Write[][] = [];
  const write = db.write.bind(db);
  const update = db.update.bind(db);
  db.write = (writes) => {
    batches.push([...writes]);
    return write(writes);
  };
  db.update = (reads, compute, scope) =>
    update(
      reads,
      (values) => {
        const writes = compute(values);
        if (writes.length > 0) batches.push([...writes]);
        return writes;
      },
      scope,
    );
  return batches;
}
