import type { EventId } from '@nekotype/shared/types';
import { DAY_MS } from './constants';

/** The order of the log (ADR 100, point 7): by `at`, then `dev` (string order), then `n`. */
export function compareEvents(a: EventId, b: EventId): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.dev !== b.dev) return a.dev < b.dev ? -1 : 1;
  if (a.n !== b.n) return a.n < b.n ? -1 : 1;
  return 0;
}

/** `${dev}:${n}`: an event received twice counts once. */
export function eventKey(e: EventId): string {
  return `${e.dev}:${e.n}`;
}

/** Days from 1970-01-01 in the zone `tz` minutes east of UTC. */
export function localDay(at: number, tz: number): number {
  return Math.floor((at + tz * 60_000) / DAY_MS);
}
