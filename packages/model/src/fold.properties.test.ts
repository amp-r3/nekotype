import type { LearnKanaKey, LogEvent, TaskKind } from '@nekotype/shared/types';
import { intIn, seededRng } from '@nekotype/shared/testing';
import { describe, expect, it } from 'vitest';
import { compareEvents } from './order';
import { createFold, foldLog } from './fold';
import type { Fold } from './fold';
import { answer, end, intro, start } from './testing';

const OPTIONS = { targetMs: 1500 };
const KEYS: readonly LearnKanaKey[] = [
  'hiragana:あ',
  'hiragana:い',
  'hiragana:か',
  'hiragana:き',
  'hiragana:きゃ',
  'hiragana:や',
  'katakana:ア',
  'katakana:カ',
];
const TASKS: readonly TaskKind[] = ['recall', 'recall', 'recall', 'recognition', 'contrast'];
const HOUR = 3_600_000;

type Rng = ReturnType<typeof seededRng>;

function pick<T>(rng: Rng, list: readonly T[]): T {
  const item = list[intIn(rng, 0, list.length - 1)];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
}

/** One device's events: its own `n` and a clock that never goes back, with ties and big gaps. */
function deviceLog(rng: Rng, dev: string, length: number, startAt: number): LogEvent[] {
  const log: LogEvent[] = [];
  let at = startAt;
  for (let n = 1; n <= length; n++) {
    at += rng.next() < 0.1 ? intIn(rng, HOUR, 30 * HOUR) : intIn(rng, 0, 20_000);
    const id = { at, dev, n };
    const roll = rng.next();
    if (roll < 0.05) log.push(start(pick(rng, [-300, 0, 60, 540]), id));
    else if (roll < 0.1) log.push(end(id));
    else if (roll < 0.25) log.push(intro(pick(rng, KEYS), id));
    else {
      const ok = rng.next() < 0.75;
      log.push(
        answer(pick(rng, KEYS), {
          ...id,
          task: pick(rng, TASKS),
          ok,
          ms: intIn(rng, 300, 4000),
          wrong: ok ? null : pick(rng, KEYS),
          alt: pick(rng, [null, pick(rng, KEYS)]),
        }),
      );
    }
  }
  return log;
}

function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = intIn(rng, 0, i);
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

const sorted = (events: readonly LogEvent[]) => [...events].sort(compareEvents);

/** What a device does with events it receives: apply, and fold the whole log on `out-of-order`. */
function receive(fold: Fold, own: Map<string, LogEvent>, incoming: readonly LogEvent[]): Fold {
  let needsReplay = false;
  for (const e of sorted(incoming)) {
    own.set(`${e.dev}:${e.n}`, e);
    if (fold.apply(e) === 'out-of-order') needsReplay = true;
  }
  return needsReplay ? foldLog(own.values(), OPTIONS) : fold;
}

describe('the fold is a function of the set of events (ADR 100, point 1)', () => {
  it('gives one snapshot for any order of delivery, with repeats', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seededRng(seed);
      const devs = ['a', 'b', 'c'].slice(0, intIn(rng, 2, 3));
      const events = devs.flatMap((dev) => deviceLog(rng, dev, intIn(rng, 5, 60), 1_000_000));
      const reference = foldLog(sorted(events), OPTIONS);
      const noisy = shuffle(rng, [...events, ...events.filter(() => rng.next() < 0.3)]);
      const got = foldLog(noisy, OPTIONS);
      expect(got.snapshot(), `seed ${seed}`).toEqual(reference.snapshot());
      expect(got.last).toEqual(reference.last);
    }
  });

  it('gives the same result for incremental apply in sorted order as for foldLog', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seededRng(1000 + seed);
      const events = ['a', 'b'].flatMap((dev) => deviceLog(rng, dev, intIn(rng, 5, 60), 0));
      const fold = createFold(OPTIONS);
      for (const e of sorted(events)) expect(fold.apply(e)).toBe('applied');
      expect(fold.snapshot(), `seed ${seed}`).toEqual(foldLog(events, OPTIONS).snapshot());
    }
  });

  it('converges for devices that exchange batches with 30% failed syncs', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seededRng(5000 + seed);
      const devs = ['a', 'b', 'c'].slice(0, intIn(rng, 2, 3));
      const logs = new Map(devs.map((dev) => [dev, new Map<string, LogEvent>()]));
      const folds = new Map(devs.map((dev) => [dev, createFold(OPTIONS)]));
      const counters = new Map(devs.map((dev) => [dev, 0]));
      let clock = 1_000_000;

      const exchange = (from: string, to: string): void => {
        const have = logs.get(to);
        const source = logs.get(from);
        const fold = folds.get(to);
        if (have === undefined || source === undefined || fold === undefined) return;
        const missing = [...source].filter(([key]) => !have.has(key)).map(([, e]) => e);
        folds.set(to, receive(fold, have, missing));
      };

      for (let step = 0; step < 40; step++) {
        const dev = pick(rng, devs);
        clock += intIn(rng, 0, 5000);
        const n = (counters.get(dev) ?? 0) + 1;
        counters.set(dev, n);
        const [event] = deviceLog(rng, dev, 1, clock - 1).map((e) => ({ ...e, n, at: clock }));
        const own = logs.get(dev);
        const fold = folds.get(dev);
        if (event === undefined || own === undefined || fold === undefined) continue;
        folds.set(dev, receive(fold, own, [event]));
        if (rng.next() < 0.5) {
          const other = pick(rng, devs);
          if (other !== dev && rng.next() >= 0.3) exchange(dev, other);
          if (other !== dev && rng.next() >= 0.3) exchange(other, dev);
        }
      }
      for (let round = 0; round < 2; round++) {
        for (const a of devs) for (const b of devs) if (a !== b) exchange(a, b);
      }

      const all = [...logs.values()].flatMap((log) => [...log.values()]);
      const reference = foldLog(all, OPTIONS).snapshot();
      for (const dev of devs) {
        expect(folds.get(dev)?.snapshot(), `seed ${seed} device ${dev}`).toEqual(reference);
      }
    }
  });
});
