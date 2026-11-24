import { describe, expect, it } from 'vitest';
import * as model from '@nekotype/model';
import { answer, intro, start, syntheticLog } from '@nekotype/model/testing';
import type { LearnKanaKey, LogEvent } from '@nekotype/shared/types';
import { createMemoryDb } from '@/shared/lib';
import { localDay } from '../lib/day';
import type { Db } from '@/shared/lib';
import { createInsightsEngine, computeStepOne } from './insights';
import type { ForecastRecord } from './insights-types';

const NOW = 1_700_000_000_000;
const A: LearnKanaKey = 'hiragana:あ';
const I: LearnKanaKey = 'hiragana:い';
const VOWELS: readonly LearnKanaKey[] = [A, I, 'hiragana:う', 'hiragana:え', 'hiragana:お'];
const ROW = 'hiragana:vowels';

function folded(events: readonly LogEvent[]) {
  const fold = model.foldLog(events, { targetMs: 1500, stats: true });
  const snapshot = fold.snapshot();
  if (snapshot.stats === null) throw new Error('no statistics');
  return { fold, state: snapshot.state, view: model.describe(snapshot.state, snapshot.stats) };
}

/** `count` sessions, each introducing the next kana of `keys`; the sessions start a day apart. */
function sessions(keys: readonly LearnKanaKey[]): LogEvent[] {
  const events: LogEvent[] = [];
  let n = 0;
  keys.forEach((key, i) => {
    const at = NOW - (keys.length - i) * 86_400_000;
    events.push(start(0, { at, n: (n += 1) }), intro(key, { at: at + 1, n: (n += 1) }));
    events.push(answer(key, { at: at + 2, n: (n += 1) }));
  });
  return events;
}

const record = (over: Partial<ForecastRecord> = {}): ForecastRecord => ({
  row: ROW,
  day: 19_000,
  at: 1,
  raw: 1,
  started: 0,
  actual: 2,
  ...over,
});

function engineFor(db: Db = createMemoryDb(), m: typeof model = model) {
  return { db, engine: createInsightsEngine({ model: m, db: () => Promise.resolve(db) }) };
}

const live = (events: readonly LogEvent[]) => {
  const f = folded(events);
  return { view: () => f.view, state: () => f.state, now: NOW, track: 'hiragana' as const };
};

describe('computeStepOne (D3, D7)', () => {
  it('has no "before" without a start: the first visit', () => {
    const { state, view } = folded([]);
    const result = computeStepOne(model, {
      view,
      state,
      startSnapshot: null,
      now: NOW,
      track: 'hiragana',
    });
    expect(result.stronger).toEqual({ kind: 'first' });
    expect(result.outline.introductions).toBeGreaterThan(0);
  });

  it('after a first session lists every kana it introduced', () => {
    const events = sessions([A, I]);
    const { state, view } = folded(events);
    // `before` is the state at the last start: the first kana is already there.
    const startSnapshot = folded(events.slice(0, 3)).fold.snapshot();
    const result = computeStepOne(model, {
      view,
      state,
      startSnapshot,
      now: NOW,
      track: 'hiragana',
    });
    expect(result.stronger.kind).toBe('ready');
    if (result.stronger.kind === 'ready') {
      expect(result.stronger.kana.map((s) => s.key)).toContain(I);
      expect(result.stronger.kana.every((s) => s.from !== s.to)).toBe(true);
    }
  });

  it('gives the same outline for the same state: a fixed seed', () => {
    const { state, view } = folded(sessions(VOWELS));
    const input = { view, state, startSnapshot: null, now: NOW, track: 'hiragana' } as const;
    expect(computeStepOne(model, input).outline).toEqual(computeStepOne(model, input).outline);
  });
});

describe('forecast (D8–D10)', () => {
  it('forecasts the next row, records it and gives the same numbers again', async () => {
    const { engine } = engineFor();
    const input = live([]);
    const first = await engine.forecast(input, () => true);
    const again = await engine.forecast(input, () => true);
    expect(first).toEqual(again);
    expect(first?.forecast.kind).toBe('ready');
    if (first?.forecast.kind === 'ready') {
      const f = first.forecast.forecast;
      expect(f.row).toBe(ROW);
      expect(f.basis).toBe('model');
      expect(f.low).toBeLessThanOrEqual(f.median);
      expect(f.median).toBeLessThanOrEqual(f.high);
      expect(first.record).toEqual({
        row: ROW,
        day: localDay(NOW),
        at: NOW,
        raw: f.raw,
        started: 0,
        actual: null,
      });
    }
  });

  it('is complete when every kana of the track is introduced, with nothing to record', async () => {
    const hiragana = [...model.ITEMS.keys()].filter(
      (k) => model.ITEMS.get(k)?.track === 'hiragana',
    );
    const { engine } = engineFor();
    const result = await engine.forecast(live(sessions(hiragana)), () => true);
    expect(result).toEqual({ forecast: { kind: 'complete' }, record: null });
  });

  it('is beyond when the raw median is over FORECAST_MAX_SESSIONS, with nothing to record', async () => {
    const far: typeof model = {
      ...model,
      forecastRow: (_state, row) => ({
        row,
        raw: model.FORECAST_MAX_SESSIONS + 1,
        low: 61,
        median: 61,
        high: 61,
      }),
    };
    const { engine } = engineFor(createMemoryDb(), far);
    expect(await engine.forecast(live([]), () => true)).toEqual({
      forecast: { kind: 'beyond', row: ROW },
      record: null,
    });
  });

  it('settles an open record from introducedIn, then corrects from the third settled forecast', async () => {
    const db = createMemoryDb();
    const base = await engineFor().engine.forecast(live([]), () => true);
    if (base?.forecast.kind !== 'ready') throw new Error('no forecast');
    // Three settled forecasts of the row `hiragana:k`, each half of what happened: ratio 2.
    for (const day of [1, 2, 3]) {
      await db.put(
        'forecasts',
        `hiragana:k@${day}`,
        record({ row: 'hiragana:k', day, at: day, raw: 1, actual: 2 }),
      );
    }
    const { engine } = engineFor(db);
    const corrected = await engine.forecast(live([]), () => true);
    if (corrected?.forecast.kind !== 'ready') throw new Error('no forecast');
    const doubled = (n: number): number => Math.max(1, Math.round(n * 2));
    expect(corrected.forecast.forecast.raw).toBe(base.forecast.forecast.raw);
    expect(corrected.forecast.forecast.median).toBe(doubled(base.forecast.forecast.raw));
    expect(corrected.forecast.forecast.high).toBe(doubled(base.forecast.forecast.high));
  });

  it('settles with actual = the last introduction − started, and passes the record on', async () => {
    const db = createMemoryDb();
    // Shown with 0 sessions behind it; the vowels were introduced in sessions 1 to 5.
    await db.put(
      'forecasts',
      `${ROW}@19000`,
      record({ day: 19_000, raw: 3, started: 0, actual: null }),
    );
    const { engine } = engineFor(db);
    await engine.forecast(live(sessions(VOWELS)), () => true);
    expect(await db.get('forecasts', `${ROW}@19000`)).toEqual(
      record({ day: 19_000, raw: 3, started: 0, actual: 5 }),
    );
  });

  it('uses basis `habits` with enough answers and fewer than three settled forecasts', async () => {
    const events = syntheticLog({ answers: 1500, seed: 1 });
    const f = folded(events);
    const input = {
      view: () => f.view,
      state: () => f.state,
      now: (events.at(-1)?.at ?? 0) + 3_600_000,
      track: 'hiragana' as const,
    };
    const result = await engineFor().engine.forecast(input, () => true);
    expect(result?.forecast.kind === 'ready' && result.forecast.forecast.basis).toBe('habits');
  });

  it('does nothing for a request that went stale at an await', async () => {
    const db = createMemoryDb();
    await db.put('forecasts', `${ROW}@19000`, record({ actual: null, started: 0 }));
    const { engine } = engineFor(db);
    let calls = 0;
    // True at the first check (after the read), false at the second (after the settle).
    const result = await engine.forecast(live(sessions(VOWELS)), () => (calls += 1) < 2);
    expect(result).toBeNull();
    expect(await engine.forecast(live([]), () => false)).toBeNull();
  });

  it('does not bring back cleared records: drop forgets what it read', async () => {
    const db = createMemoryDb();
    await db.put('forecasts', `${ROW}@19000`, record({ actual: 2 }));
    const { engine } = engineFor(db);
    await engine.forecast(live([]), () => true);
    await db.write([{ op: 'clear', store: 'forecasts' }]);
    engine.drop();
    const result = await engine.forecast(live([]), () => true);
    if (result?.record) await engine.record(result.record);
    expect(await db.getAll('forecasts')).toHaveLength(1);
  });
});
