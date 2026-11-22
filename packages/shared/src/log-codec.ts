import { isLearnKanaKey } from './learn-runtime';
import { isObject } from './object';
import type { EncodedEvent, LearnKanaKey, LogEvent, LogPage, TaskKind, WordKey } from './types';

// The log page: the unit of a sync batch, of a D1 row and of an IndexedDB record (P7 plan, D11).
// The bounds of an event live here only: the client checks every page it reads with `isLogPage`
// and the server every batch (a valibot schema calls it), so the two cannot disagree.

/** Events of a closed own page in IndexedDB. */
export const LOG_PAGE_EVENTS = 500;
/** Events of any page or batch. */
export const MAX_PAGE_EVENTS = 8_192;

const KANA_KEY_MAX = 24;
const WORD_KEY_MAX = 64;
const MAX_MS = 10_000;
const MIN_TZ = -720;
const MAX_TZ = 840;

const TASKS: ReadonlySet<string> = new Set<TaskKind>([
  'recall',
  'recognition',
  'contrast',
  'transfer',
  'build',
  'fluency',
  'listening',
  'dictation',
  'pair',
  'word',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTask(value: unknown): value is TaskKind {
  return typeof value === 'string' && TASKS.has(value);
}

function isKanaKey(value: unknown): value is LearnKanaKey {
  return isLearnKanaKey(value) && value.length <= KANA_KEY_MAX;
}

function isWordKey(value: unknown): value is WordKey {
  return (
    typeof value === 'string' &&
    value.startsWith('word:') &&
    value.length > 5 &&
    value.length <= WORD_KEY_MAX
  );
}

function isFlag(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isEncodedEvent(value: unknown): value is EncodedEvent {
  if (!Array.isArray(value)) return false;
  const event: readonly unknown[] = value;
  if (!isInt(event[0], 0, Number.MAX_SAFE_INTEGER)) return false;
  switch (event[1]) {
    case 'i':
      return event.length === 3 && isKanaKey(event[2]);
    case 'a':
      return (
        event.length === 9 &&
        isTask(event[2]) &&
        (isKanaKey(event[3]) || (event[2] === 'word' && isWordKey(event[3]))) &&
        isFlag(event[4]) &&
        isInt(event[5], 0, MAX_MS) &&
        isFlag(event[6]) &&
        (event[7] === '' || isKanaKey(event[7])) &&
        (event[8] === '' || isKanaKey(event[8]))
      );
    case 's':
      return event.length === 3 && isInt(event[2], MIN_TZ, MAX_TZ);
    case 'e':
      return event.length === 2;
    default:
      return false;
  }
}

export function isLogPage(value: unknown): value is LogPage {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 4) return false;
  const { dev, n0, at0, e } = value;
  if (typeof dev !== 'string' || !UUID.test(dev)) return false;
  if (!isInt(n0, 1, Number.MAX_SAFE_INTEGER) || !isInt(at0, 0, Number.MAX_SAFE_INTEGER)) {
    return false;
  }
  if (!Array.isArray(e) || e.length < 1 || e.length > MAX_PAGE_EVENTS) return false;
  const events: readonly unknown[] = e;
  if (!events.every(isEncodedEvent)) return false;
  // `n` and every `at` stay safe integers, so decoding never rounds.
  let at = at0;
  for (const event of events) {
    const dt = isEncodedEvent(event) ? event[0] : 0;
    at += dt;
    if (!Number.isSafeInteger(at)) return false;
  }
  return Number.isSafeInteger(n0 + events.length);
}

/** The events of a page; null when it is not a valid page. */
export function decodePage(value: unknown): readonly LogEvent[] | null {
  if (!isLogPage(value)) return null;
  const events: LogEvent[] = [];
  let at = value.at0;
  value.e.forEach((event, index) => {
    at += event[0];
    const id = { at, dev: value.dev, n: value.n0 + index };
    switch (event[1]) {
      case 'i':
        events.push({ ...id, t: 'intro', k: event[2] });
        break;
      case 'a':
        events.push({
          ...id,
          t: 'answer',
          task: event[2],
          k: event[3],
          ok: event[4] === 1,
          ms: event[5],
          hint: event[6] === 1,
          wrong: event[7] === '' ? null : event[7],
          alt: event[8] === '' ? null : event[8],
        });
        break;
      case 's':
        events.push({ ...id, t: 'start', tz: event[2] });
        break;
      case 'e':
        events.push({ ...id, t: 'end' });
        break;
    }
  });
  return events;
}

function encodeEvent(event: LogEvent, dt: number): EncodedEvent {
  switch (event.t) {
    case 'intro':
      return [dt, 'i', event.k];
    case 'answer':
      return [
        dt,
        'a',
        event.task,
        event.k,
        event.ok ? 1 : 0,
        event.ms,
        event.hint ? 1 : 0,
        event.wrong ?? '',
        event.alt ?? '',
      ];
    case 'start':
      return [dt, 's', event.tz];
    case 'end':
      return [dt, 'e'];
  }
}

/** Events of one `dev`, `n` without gaps, `at` not decreasing; throws otherwise (a bug, not data). */
export function encodePage(events: readonly LogEvent[]): LogPage {
  const first = events[0];
  if (first === undefined) throw new Error('a log page needs at least one event');
  let previous = first.at;
  const encoded = events.map((event, index) => {
    if (event.dev !== first.dev) throw new Error('a log page holds the events of one device');
    if (event.n !== first.n + index)
      throw new Error('the events of a log page follow without gaps');
    if (event.at < previous) throw new Error('the times of a log page do not decrease');
    const dt = event.at - previous;
    previous = event.at;
    return encodeEvent(event, dt);
  });
  return { dev: first.dev, n0: first.n, at0: first.at, e: encoded };
}
