// The bodies `measure.ts` sends to `/api/sync` (p7-plan.md, D24): a session batch, a 256 KB batch
// and a settings-only batch of format 3.
import { MAX_BODY_BYTES } from '../../api/src/lib/body';
import { MAX_PAGE_EVENTS, encodePage } from '@nekotype/shared/runtime';
import type { LearnKanaKey, LogEvent, SyncRequest, TaskKind } from '@nekotype/shared/types';
import { BENCH_DEVICE, SEED_PAGES, benchSettings } from './seed';

/** The kinds of `POST` of D24. */
export type Batch = 'session' | 'capped' | 'settings';

const KANA: readonly LearnKanaKey[] = ['hiragana:a', 'hiragana:i', 'hiragana:u', 'hiragana:e'];
const TASKS: readonly TaskKind[] = ['recall', 'recognition'];
/** A session: `start`, one introduction, 29 answers and `end` (30 tasks, D18). */
const SESSION_ANSWERS = 29;

function key(index: number): LearnKanaKey {
  return KANA[index % KANA.length] ?? 'hiragana:a';
}

function answer(n: number, at: number, index: number): LogEvent {
  return {
    t: 'answer',
    at,
    dev: BENCH_DEVICE,
    n,
    task: TASKS[index % TASKS.length] ?? 'recall',
    k: key(index),
    ok: index % 5 !== 0,
    ms: 900 + ((index * 37) % 1500),
    hint: false,
    wrong: index % 5 === 0 ? key(index + 1) : null,
    alt: null,
  };
}

/** The events of one session of 30 tasks. */
function sessionEvents(at: number): LogEvent[] {
  let n = 0;
  const events: LogEvent[] = [{ t: 'start', at, dev: BENCH_DEVICE, n: (n += 1), tz: 0 }];
  events.push({ t: 'intro', at: at + 1000, dev: BENCH_DEVICE, n: (n += 1), k: key(0) });
  for (let i = 0; i < SESSION_ANSWERS; i += 1) {
    events.push(answer((n += 1), at + 2000 + i * 3000, i));
  }
  events.push({ t: 'end', at: at + 100_000, dev: BENCH_DEVICE, n: (n += 1) });
  return events;
}

function request(seq: number, events: readonly LogEvent[] | null, settings: boolean): SyncRequest {
  return {
    v: 3,
    deviceId: BENCH_DEVICE,
    seq,
    after: SEED_PAGES,
    log: events === null ? null : encodePage(events),
    settings: settings ? benchSettings(Date.now()) : null,
  };
}

/** `start`, `count` answers, `end`: the times only grow. */
function answersEvents(at: number, count: number): LogEvent[] {
  const events: LogEvent[] = [{ t: 'start', at, dev: BENCH_DEVICE, n: 1, tz: 0 }];
  for (let i = 0; i < count; i += 1) events.push(answer(i + 2, at + 1000 + i * 10, i));
  events.push({ t: 'end', at: at + 1000 + count * 10, dev: BENCH_DEVICE, n: count + 2 });
  return events;
}

/** As many answers as the body limit of the application allows (D24), at most one page. */
function cappedEvents(at: number): LogEvent[] {
  const bytes = (count: number): number =>
    Buffer.byteLength(JSON.stringify(request(1, answersEvents(at, count), false)));
  let low = 1;
  let high = MAX_PAGE_EVENTS - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (bytes(middle) <= MAX_BODY_BYTES) low = middle;
    else high = middle - 1;
  }
  return answersEvents(at, low);
}

/** The body of one request. */
export function batchBody(batch: Batch, seq: number): SyncRequest {
  const at = Date.now();
  switch (batch) {
    case 'session':
      return request(seq, sessionEvents(at), false);
    case 'capped':
      return request(seq, cappedEvents(at), false);
    case 'settings':
      return request(seq, null, true);
  }
}
