import type { LogEvent } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { DAY_MS } from './constants';
import { createFold, foldLog } from './fold';
import { answer, end, intro, start } from './testing';

const KA = 'hiragana:か';
const KI = 'hiragana:き';
const KATA_KA = 'katakana:カ';

function folded(events: readonly LogEvent[]) {
  const fold = foldLog(events, { targetMs: 1500, stats: true });
  const stats = fold.stats;
  if (stats === null) throw new Error('no stats');
  return stats;
}

/** Events of one device, numbered and spaced a second apart from `at`. */
function log(
  at: number,
  makers: readonly ((id: { at: number; n: number }) => LogEvent)[],
): LogEvent[] {
  return makers.map((make, i) => make({ at: at + i * 1000, n: i + 1 }));
}

describe('statistics: kana', () => {
  it('keeps the last 10 recall answers, oldest first', () => {
    const events = log(
      1000,
      Array.from(
        { length: 13 },
        (_, i) => (id) => answer(KA, { ...id, ms: 100 + i, ok: i % 2 === 0 }),
      ),
    );
    const recall = folded(events).kana.get(KA)?.recall ?? [];
    expect(recall).toHaveLength(10);
    expect(recall[0]).toEqual({ ms: 103, ok: false });
    expect(recall[9]).toEqual({ ms: 112, ok: true });
  });

  it('counts recognitions and their errors without decay, apart from recall', () => {
    const events = log(1000, [
      (id) => answer(KA, { ...id, task: 'recognition', ok: true }),
      (id) => answer(KA, { ...id, task: 'recognition', ok: false, wrong: KI }),
      (id) => answer(KA, { ...id, task: 'recognition', ok: true }),
      (id) => answer(KA, id),
    ]);
    expect(folded(events).kana.get(KA)).toEqual({
      recall: [{ ms: 1000, ok: true }],
      recognitions: 3,
      recognitionErrors: 1,
    });
  });

  it('keeps recognition counts when a recall follows, and recall when a recognition follows', () => {
    const events = log(1000, [
      (id) => answer(KA, { ...id, task: 'recognition' }),
      (id) => answer(KA, id),
      (id) => answer(KA, { ...id, task: 'recognition', ok: false }),
    ]);
    expect(folded(events).kana.get(KA)).toEqual({
      recall: [{ ms: 1000, ok: true }],
      recognitions: 2,
      recognitionErrors: 1,
    });
  });

  it('ignores tasks that are neither recall nor recognition, introductions and words', () => {
    const events = log(1000, [
      (id) => intro(KA, id),
      (id) => answer(KA, { ...id, task: 'transfer' }),
      (id) => answer('word:かき', { ...id, task: 'word' }),
    ]);
    expect(folded(events).kana.size).toBe(0);
  });
});

describe('statistics: days', () => {
  it('groups answers by the local day of the writing device', () => {
    const events: LogEvent[] = [
      start(540, { at: 0, n: 1 }), // UTC+9
      answer(KA, { at: 14 * 3_600_000, n: 2, ms: 700 }), // 14:00 UTC = 23:00 on day 0 locally
      answer(KA, { at: 16 * 3_600_000, n: 3, ms: 800 }), // 01:00 on day 1 locally
      answer(KATA_KA, { at: 16 * 3_600_000 + 1, n: 4, ms: 900 }),
    ];
    const days = folded(events).days;
    expect([...days.keys()]).toEqual([0, 1]);
    expect(days.get(0)).toEqual({ answers: 1, recall: { hiragana: [700], katakana: [] } });
    expect(days.get(1)).toEqual({ answers: 2, recall: { hiragana: [800], katakana: [900] } });
  });

  it('counts answers of every task, introductions not, and keeps every day', () => {
    const events: LogEvent[] = [
      intro(KA, { at: 0, n: 1 }),
      answer(KA, { at: 1, n: 2, task: 'recognition' }),
      answer('word:かき', { at: 2, n: 3, task: 'word' }),
      answer(KA, { at: 400 * DAY_MS, n: 4 }),
    ];
    const days = folded(events).days;
    expect(days.get(0)).toEqual({ answers: 2, recall: { hiragana: [], katakana: [] } });
    expect(days.get(400)?.answers).toBe(1);
    expect(days.size).toBe(2);
  });

  it('counts a day of introductions only as no day', () => {
    expect(folded([intro(KA, { at: 5, n: 1 })]).days.size).toBe(0);
  });
});

describe('statistics: sessions', () => {
  it('counts session starts and ends', () => {
    const events = log(0, [(id) => start(0, id), (id) => end(id), (id) => start(0, id)]);
    const stats = folded(events);
    expect([stats.started, stats.finished]).toEqual([2, 1]);
  });
});

describe('statistics: copies', () => {
  it('a snapshot does not change when the fold goes on', () => {
    const fold = createFold({ targetMs: 1500, stats: true });
    fold.apply(answer(KA, { at: 1, n: 1, ms: 500 }));
    fold.apply(start(0, { at: 2, n: 2 }));
    const before = fold.snapshot().stats;
    const frozen = structuredClone({
      kana: [...(before?.kana ?? [])],
      days: [...(before?.days ?? [])],
      started: before?.started,
    });
    fold.apply(answer(KA, { at: 3, n: 3, ms: 600 }));
    fold.apply(answer(KI, { at: 4, n: 4, ms: 600 }));
    fold.apply(start(0, { at: 5, n: 5 }));
    expect({
      kana: [...(before?.kana ?? [])],
      days: [...(before?.days ?? [])],
      started: before?.started,
    }).toEqual(frozen);
    expect(fold.snapshot().stats?.days.get(0)?.answers).toBe(3);
  });

  it('a clone is independent in both directions', () => {
    const fold = createFold({ targetMs: 1500, stats: true });
    fold.apply(answer(KA, { at: 1, n: 1 }));
    const copy = fold.clone();
    copy.apply(answer(KA, { at: 2, n: 2 }));
    fold.apply(answer(KI, { at: 3, n: 3 }));
    expect(copy.stats?.days.get(0)?.answers).toBe(2);
    expect(fold.stats?.days.get(0)?.answers).toBe(2);
    expect(copy.stats?.kana.has(KI)).toBe(false);
    expect(fold.stats?.kana.get(KA)?.recall).toHaveLength(1);
  });

  it('is null without `stats`, and a clone can drop or start it', () => {
    const plain = createFold({ targetMs: 1500, stats: false });
    plain.apply(answer(KA, { at: 1, n: 1 }));
    expect(plain.stats).toBeNull();
    expect(plain.snapshot().stats).toBeNull();
    const started = plain.clone({ stats: true });
    expect(started.stats?.days.size).toBe(0);
    const withStats = createFold({ targetMs: 1500, stats: true });
    withStats.apply(answer(KA, { at: 1, n: 1 }));
    expect(withStats.clone({ stats: false }).stats).toBeNull();
  });
});

describe('statistics: introducedIn', () => {
  it('is the number of the session that introduced the kana: from an intro and from an answer', () => {
    const events = log(1000, [
      (id) => intro(KA, id),
      (id) => start(0, id),
      (id) => answer(KI, id), // no intro: the answer introduces it, in session 1
      (id) => start(0, id),
      (id) => intro(KATA_KA, id),
      (id) => answer(KA, id), // already introduced: unchanged
    ]);
    const stats = folded(events);
    expect(stats.introducedIn.get(KA)).toBe(0); // before any start
    expect(stats.introducedIn.get(KI)).toBe(1);
    expect(stats.introducedIn.get(KATA_KA)).toBe(2);
    expect(stats.introducedIn.size).toBe(3);
  });

  it('is copied by a snapshot and a clone, and each side changes alone', () => {
    const fold = createFold({ targetMs: 1500, stats: true });
    fold.apply(start(0, { at: 1, n: 1 }));
    fold.apply(intro(KA, { at: 2, n: 2 }));
    const snapshot = fold.snapshot().stats;
    const copy = fold.clone();
    fold.apply(start(0, { at: 3, n: 3 }));
    fold.apply(intro(KI, { at: 4, n: 4 }));
    copy.apply(intro(KATA_KA, { at: 5, n: 5 }));
    expect([...(snapshot?.introducedIn ?? [])]).toEqual([[KA, 1]]);
    expect([...(copy.stats?.introducedIn ?? [])]).toEqual([
      [KA, 1],
      [KATA_KA, 1],
    ]);
    expect(fold.stats?.introducedIn.get(KI)).toBe(2);
  });
});
