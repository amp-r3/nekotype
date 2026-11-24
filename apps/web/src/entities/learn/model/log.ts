import {
  LOG_PAGE_EVENTS,
  decodePage,
  encodePage,
  isLogPage,
  isObject,
} from '@nekotype/shared/runtime';
import type { EventDraft, LogEvent, LogPage } from '@nekotype/shared/types';
import type { Db, Write } from '@/shared/lib';
import { FORECASTS_STORE, LOG_STORE, META_STORE } from '@/shared/lib';

// The learning log in IndexedDB (P7 plan, D16): pages of events in the store `log`, the identity
// of the next own event in `meta`. The state is never stored: it is the fold of what this reads.

/** The record `meta/log`: this device's log identity. */
export type LogMeta = {
  /** The log device id: a UUID created with the log on the device. */
  readonly dev: string;
  /** The `n` of the next own event. */
  readonly next: number;
  /** The `at` of the last own event: the next never goes below it. */
  readonly lastAt: number;
};

/** What the tabs of a device tell each other on the channel `nekotype:learn` (D16). */
export type LearnMessage =
  | { readonly kind: 'append'; readonly page: LogPage }
  | { readonly kind: 'pull' }
  | { readonly kind: 'reset' };

export function isLearnMessage(value: unknown): value is LearnMessage {
  if (!isObject(value)) return false;
  if (value['kind'] === 'append') return isLogPage(value['page']);
  return value['kind'] === 'pull' || value['kind'] === 'reset';
}

export const LOG_META_KEY = 'log';
export const SENT_N_KEY = 'sentN';
export const PULLED_ID_KEY = 'pulledId';
export const OPEN_PAGE_KEY = 'own:open';

export function isLogMeta(value: unknown): value is LogMeta {
  if (!isObject(value)) return false;
  const { dev, next, lastAt } = value;
  return (
    typeof dev === 'string' &&
    dev.length > 0 &&
    typeof next === 'number' &&
    Number.isSafeInteger(next) &&
    next >= 1 &&
    typeof lastAt === 'number' &&
    Number.isSafeInteger(lastAt) &&
    lastAt >= 0
  );
}

const pad = (n: number): string => String(n).padStart(12, '0');

/** The first `n` of the block of `LOG_PAGE_EVENTS` that holds `n`: 1, 501, 1001, … */
function blockStart(n: number): number {
  return Math.floor((n - 1) / LOG_PAGE_EVENTS) * LOG_PAGE_EVENTS + 1;
}

/** The key of a closed own page. */
export const ownPageKey = (n0: number): string => `own:${pad(n0)}`;
/** The key of a pulled server row. */
export const rowPageKey = (id: number): string => `row:${pad(id)}`;

/**
 * Reads `meta/log`; a missing or invalid record is created, so the identity exists before the first
 * event. Reason for the transaction: another tab may create it at the same time.
 */
export async function loadLogMeta(db: Db, newId: () => string): Promise<LogMeta> {
  const found: { meta: LogMeta | null } = { meta: null };
  await db.update([{ store: META_STORE, key: LOG_META_KEY }], ([stored]) => {
    if (isLogMeta(stored)) {
      found.meta = stored;
      return [];
    }
    const created: LogMeta = { dev: newId(), next: 1, lastAt: 0 };
    found.meta = created;
    return [{ op: 'put', store: META_STORE, key: LOG_META_KEY, value: created }];
  });
  if (found.meta === null) throw new Error('the log identity was not read');
  return found.meta;
}

/**
 * Gives the drafts their identity and stores them, in one transaction: `n` is the next one of the
 * device (two tabs share `dev`, and IndexedDB serializes their transactions, so they never share an
 * `n`) and `at` never goes below the last own `at`. A page that reaches the end of its block of
 * `LOG_PAGE_EVENTS` is closed under `own:<n0>`. Returns the events as stored.
 */
export async function appendEvents(
  db: Db,
  drafts: readonly EventDraft[],
  newId: () => string,
): Promise<readonly LogEvent[]> {
  const stored: LogEvent[] = [];
  if (drafts.length === 0) return stored;
  await db.update(
    [
      { store: META_STORE, key: LOG_META_KEY },
      { store: LOG_STORE, key: OPEN_PAGE_KEY },
    ],
    ([metaValue, openValue]) => {
      stored.length = 0;
      const meta: LogMeta = isLogMeta(metaValue) ? metaValue : { dev: newId(), next: 1, lastAt: 0 };
      let { next, lastAt } = meta;
      // An open page that does not continue the log (a record that fails its check, or one left by
      // another identity) is replaced: its events were not readable as this device's.
      let open: readonly LogEvent[] = decodePage(openValue) ?? [];
      const first = open[0];
      const last = open[open.length - 1];
      if (
        first === undefined ||
        last === undefined ||
        first.dev !== meta.dev ||
        last.n + 1 !== next ||
        blockStart(first.n) !== blockStart(last.n)
      ) {
        open = [];
      }
      const writes: Write[] = [];
      for (const draft of drafts) {
        const at = Math.max(Math.round(draft.at), lastAt);
        const event: LogEvent = { ...draft, at, dev: meta.dev, n: next };
        next += 1;
        lastAt = at;
        stored.push(event);
        open = [...open, event];
        if (event.n % LOG_PAGE_EVENTS === 0) {
          writes.push({
            op: 'put',
            store: LOG_STORE,
            key: ownPageKey(blockStart(event.n)),
            value: encodePage(open),
          });
          open = [];
        }
      }
      writes.push(
        open.length === 0
          ? { op: 'delete', store: LOG_STORE, key: OPEN_PAGE_KEY }
          : { op: 'put', store: LOG_STORE, key: OPEN_PAGE_KEY, value: encodePage(open) },
        {
          op: 'put',
          store: META_STORE,
          key: LOG_META_KEY,
          value: { dev: meta.dev, next, lastAt } satisfies LogMeta,
        },
      );
      return writes;
    },
  );
  return stored;
}

function eventsOf(pages: readonly unknown[]): LogEvent[] {
  const seen = new Set<string>();
  const events: LogEvent[] = [];
  for (const page of pages) {
    // A record that fails its check is skipped, as any invalid stored value is (ADR 061).
    for (const event of decodePage(page) ?? []) {
      const key = `${event.dev}:${event.n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(event);
    }
  }
  return events;
}

/** Every event of the store: own pages, the open page and pulled rows. Repeated events once. */
export async function readLog(db: Db): Promise<readonly LogEvent[]> {
  return eventsOf(await db.getAll(LOG_STORE));
}

/**
 * The own events not acknowledged yet: `n > sentN`. Their pages are found by key from the block of
 * `sentN + 1` up to the open page.
 */
export async function readUnsent(db: Db, sentN: number): Promise<readonly LogEvent[]> {
  const meta = await db.get(META_STORE, LOG_META_KEY);
  if (!isLogMeta(meta) || meta.next - 1 <= sentN) return [];
  const pages: unknown[] = [];
  for (let n0 = blockStart(sentN + 1); n0 < meta.next; n0 += LOG_PAGE_EVENTS) {
    pages.push(await db.get(LOG_STORE, ownPageKey(n0)));
  }
  pages.push(await db.get(LOG_STORE, OPEN_PAGE_KEY));
  return eventsOf(pages).filter((e) => e.dev === meta.dev && e.n > sentN);
}

/**
 * Empties the log: its pages and its keys of `meta`. A new `dev` comes with the next identity: a new
 * log is a new device for `(dev, n)`.
 */
export async function clearLog(db: Db): Promise<void> {
  await db.write([
    { op: 'clear', store: LOG_STORE },
    // The forecast history measures this log against its forecasts: it goes with it (D10).
    { op: 'clear', store: FORECASTS_STORE },
    { op: 'delete', store: META_STORE, key: LOG_META_KEY },
    { op: 'delete', store: META_STORE, key: SENT_N_KEY },
    { op: 'delete', store: META_STORE, key: PULLED_ID_KEY },
  ]);
}
