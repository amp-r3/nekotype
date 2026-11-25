import type { LearnKanaKey, LogEvent } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { DAY_MS, GAP_MIN_MS, PACE_MIN } from './constants';
import { createFold, foldLog } from './fold';
import type { Fold, FoldOptions } from './fold';
import { firstMemory, nextMemory } from './fsrs';
import { answer, end, intro, start } from './testing';

const TARGET = 1500;
const KA = 'hiragana:か';
const KI = 'hiragana:き';
const KYA = 'hiragana:きゃ';
const SA = 'hiragana:さ';
const TA = 'hiragana:た';
const KATA_KA = 'katakana:カ';
const THREE: readonly LearnKanaKey[] = [KA, KI, TA];

/** A fold that numbers and spaces events itself: `at` and `n` grow with every call. */
function session(startAt = 0, options: FoldOptions = { stats: false }) {
  const fold = createFold(options);
  let at = startAt;
  let n = 0;
  const next = (step = 1000) => ({ at: (at += step), n: (n += 1) });
  return {
    fold,
    add(make: (id: { at: number; n: number }) => LogEvent, step?: number) {
      return fold.apply(make(next(step)));
    },
    intro(k: Parameters<typeof intro>[0], step?: number) {
      return fold.apply(intro(k, next(step)));
    },
    answer(
      k: Parameters<typeof answer>[0],
      over: Parameters<typeof answer>[1] = {},
      step?: number,
    ) {
      return fold.apply(answer(k, { ...over, ...next(step) }));
    },
    item: (k: Parameters<typeof intro>[0]) => fold.state.items.get(k),
  };
}

describe('introduction', () => {
  it('makes a learning kana with the memory of "again"', () => {
    const s = session();
    s.intro(KA);
    expect(s.item(KA)).toEqual({
      phase: 'learning',
      memory: firstMemory(1),
      lastAt: 1000,
      lastDay: 0,
      streak: 0,
      lastTask: 0,
    });
    expect(s.fold.state.learner.tasks).toBe(1);
  });

  it('is ignored for a kana that is not new (two devices introduced it)', () => {
    const s = session();
    s.intro(KA);
    s.answer(KA);
    const before = s.item(KA);
    s.intro(KA);
    expect(s.item(KA)).toEqual(before);
  });

  it('is introduced by an answer that sorts before any introduction', () => {
    const viaAnswer = session();
    viaAnswer.answer(KA);
    const viaIntro = session();
    viaIntro.intro(KA, 0);
    viaIntro.answer(KA, {}, 0);
    expect(viaAnswer.item(KA)).toBeDefined();
    expect(viaAnswer.item(KA)?.phase).toBe('learning');
    expect(viaAnswer.item(KA)?.streak).toBe(1);
    expect(viaAnswer.item(KA)?.memory).toEqual(nextMemory(firstMemory(1), 3, 0, true));
    expect(viaIntro.item(KA)?.memory).toEqual(viaAnswer.item(KA)?.memory);
  });
});

describe('streak and phase', () => {
  it('counts correct recalls, keeps it on recognition, resets on an error', () => {
    const s = session();
    s.intro(KA);
    s.answer(KA);
    s.answer(KA);
    expect(s.item(KA)?.streak).toBe(2);
    s.answer(KA, { task: 'recognition' });
    expect(s.item(KA)?.streak).toBe(2);
    s.answer(KA, { ok: false, wrong: KI });
    expect(s.item(KA)?.streak).toBe(0);
    expect(s.item(KA)?.phase).toBe('learning');
  });

  it('is learned at 5 correct recalls', () => {
    const s = session();
    s.intro(KA);
    for (let i = 0; i < 4; i++) s.answer(KA);
    expect(s.item(KA)?.phase).toBe('learning');
    s.answer(KA);
    expect(s.item(KA)?.phase).toBe('learned');
  });

  it('is learned at 5 + round(2p) under pressure', () => {
    const s = session();
    // Three learned kana, each lapsing on a review: `observed` falls under 0.80, full pressure.
    for (const k of THREE) {
      s.intro(k);
      for (let i = 0; i < 5; i++) s.answer(k);
    }
    for (const k of THREE) s.answer(k, { ok: false, wrong: SA });
    expect(s.fold.state.learner.observed).toBeLessThan(0.8);
    s.intro(SA);
    for (let i = 0; i < 6; i++) s.answer(SA);
    expect(s.item(SA)?.phase).toBe('learning');
    s.answer(SA);
    expect(s.item(SA)?.phase).toBe('learned');
  });

  it('sends a learned kana back to learning on a lapse', () => {
    const s = session();
    s.intro(KA);
    for (let i = 0; i < 5; i++) s.answer(KA);
    expect(s.item(KA)?.phase).toBe('learned');
    s.answer(KA, { ok: false, wrong: KI });
    expect(s.item(KA)).toMatchObject({ phase: 'learning', streak: 0 });
  });

  it('keeps a learned kana learned on a correct answer of another task', () => {
    const s = session();
    s.intro(KA);
    for (let i = 0; i < 5; i++) s.answer(KA);
    s.answer(KA, { task: 'recognition' });
    expect(s.item(KA)?.phase).toBe('learned');
  });

  it('keeps lastTask of the main kana only: tasks before the task', () => {
    const s = session();
    s.intro(KA); // task 0
    s.intro(SA); // task 1
    s.answer(KA); // task 2
    expect(s.item(KA)?.lastTask).toBe(2);
    expect(s.item(SA)?.lastTask).toBe(1);
  });
});

describe('observed and outcomes', () => {
  it('starts at 0.90 and moves on reviews only', () => {
    const s = session();
    expect(s.fold.state.learner.observed).toBe(0.9);
    s.intro(KA);
    for (let i = 0; i < 5; i++) s.answer(KA);
    expect(s.fold.state.learner.observed).toBe(0.9);
    expect(s.fold.state.learner.outcomes.review).toEqual([]);
    expect(s.fold.state.learner.outcomes.learning).toHaveLength(5);
    s.answer(KA); // a review
    expect(s.fold.state.learner.observed).toBeCloseTo(0.905, 10);
    s.answer(KA, { task: 'recognition' }); // not a review
    expect(s.fold.state.learner.observed).toBeCloseTo(0.905, 10);
    expect(s.fold.state.learner.outcomes.review).toEqual([true]);
    s.answer(KA, { ok: false, wrong: KI });
    expect(s.fold.state.learner.observed).toBeCloseTo(0.905 * 0.95, 10);
    expect(s.fold.state.learner.outcomes.review).toEqual([true, false]);
  });

  it('keeps the last 200 outcomes of each kind', () => {
    const s = session();
    s.intro(KA);
    for (let i = 0; i < 250; i++) s.answer(KA, { task: 'recognition' });
    expect(s.fold.state.learner.outcomes.learning).toHaveLength(200);
  });

  it('does not count a word answer as an outcome', () => {
    const s = session();
    s.add((id) => answer('word:かき', { task: 'word', ...id }));
    expect(s.fold.state.learner.outcomes).toEqual({ learning: [], review: [] });
    expect(s.fold.state.learner.tasks).toBe(1);
  });
});

describe('gaps, sittings and task intervals', () => {
  it('keeps gaps over an hour, the sittings they end and the intervals inside', () => {
    const s = session();
    s.intro(KA); // at 1000, sitting starts
    s.answer(KA, {}, 5000); // 6000: interval 5000
    s.answer(KA, {}, 3000); // 9000: interval 3000
    s.answer(KA, {}, GAP_MIN_MS); // exactly an hour: still one sitting
    s.answer(KA, {}, GAP_MIN_MS + 1); // a gap
    const l = s.fold.state.learner;
    expect(l.taskMs).toEqual([5000, 3000, GAP_MIN_MS]);
    expect(l.gaps).toEqual([GAP_MIN_MS + 1]);
    expect(l.sittings).toEqual([9000 + GAP_MIN_MS - 1000]);
    expect(l.sittingStart).toBe(9000 + GAP_MIN_MS + GAP_MIN_MS + 1);
    expect(l.lastTaskAt).toBe(9000 + GAP_MIN_MS + GAP_MIN_MS + 1);
  });

  it('keeps the last 10 gaps and sittings and the last 200 intervals', () => {
    const s = session();
    s.intro(KA);
    for (let i = 1; i <= 12; i++) s.answer(KA, {}, GAP_MIN_MS + i);
    expect(s.fold.state.learner.gaps).toEqual(
      Array.from({ length: 10 }, (_, i) => GAP_MIN_MS + i + 3),
    );
    expect(s.fold.state.learner.sittings).toHaveLength(10);
    for (let i = 0; i < 250; i++) s.answer(KA, {}, 10);
    expect(s.fold.state.learner.taskMs).toHaveLength(200);
  });

  it('does not count session starts and ends as tasks', () => {
    const s = session();
    s.add((id) => start(0, id));
    s.add((id) => end(id), GAP_MIN_MS * 3);
    expect(s.fold.state.learner).toMatchObject({ tasks: 0, lastTaskAt: null, gaps: [] });
  });
});

describe('local days', () => {
  const HOUR = 3_600_000;

  it('uses the zone of the device that wrote the event for the same-day formula', () => {
    // 23:30 and 00:30 UTC: one local day at +60 minutes (00:30 and 01:30), two at UTC.
    const run = (tz: number) => {
      const fold = createFold({ stats: false });
      const t0 = DAY_MS - HOUR / 2;
      fold.apply(start(tz, { at: t0 - 1, n: 1 }));
      fold.apply(intro(KA, { at: t0, n: 2 }));
      fold.apply(answer(KA, { at: t0 + HOUR, n: 3 }));
      return fold.state.items.get(KA);
    };
    const east = run(60);
    const utc = run(0);
    expect(east?.lastDay).toBe(1);
    expect(utc?.lastDay).toBe(1);
    expect(east?.memory).toEqual(nextMemory(firstMemory(1), 3, HOUR / DAY_MS, true));
    expect(utc?.memory).toEqual(nextMemory(firstMemory(1), 3, HOUR / DAY_MS, false));
  });

  it('keeps a zone per device and tz 0 for a device with no start', () => {
    const fold = createFold({ stats: false });
    fold.apply(start(-300, { dev: 'a', at: 1, n: 1 }));
    fold.apply(start(540, { dev: 'b', at: 2, n: 1 }));
    expect(fold.state.learner.tz).toEqual({ a: -300, b: 540 });
    fold.apply(intro(KA, { dev: 'c', at: DAY_MS - 1, n: 1 }));
    expect(fold.state.items.get(KA)?.lastDay).toBe(0);
    fold.apply(intro(KI, { dev: 'b', at: DAY_MS, n: 2 }));
    expect(fold.state.items.get(KI)?.lastDay).toBe(1);
    fold.apply(start(0, { dev: 'a', at: DAY_MS + 1, n: 2 }));
    expect(fold.state.learner.tz['a']).toBe(0);
  });
});

describe('credit, pairs and confusions', () => {
  it('credits a learned part only', () => {
    const s = session();
    s.intro(KI);
    s.intro(KYA);
    s.answer(KYA, {}, 50_000);
    expect(s.item(KI)?.lastAt).toBe(1000); // き is learning: no credit
    for (let i = 0; i < 5; i++) s.answer(KI);
    const before = s.item(KI);
    s.answer(KYA, {}, 50_000);
    const after = s.item(KI);
    expect(after?.lastAt).toBe(s.item(KYA)?.lastAt);
    expect(after?.memory).not.toEqual(before?.memory);
    expect(after?.phase).toBe('learned');
    expect(after?.streak).toBe(before?.streak);
    expect(after?.lastTask).toBe(before?.lastTask);
  });

  it('reviews the pair of a transfer only when it is learned', () => {
    const s = session();
    s.intro(KA);
    s.intro(KATA_KA);
    s.answer(KATA_KA, { task: 'transfer' });
    expect(s.item(KA)?.lastAt).toBe(1000);
    for (let i = 0; i < 5; i++) s.answer(KA);
    s.answer(KATA_KA, { task: 'transfer' }, 10_000);
    expect(s.item(KA)?.lastAt).toBe(s.item(KATA_KA)?.lastAt);
  });

  it('counts a wrong answer and never goes below 0', () => {
    const s = session();
    s.intro(KA);
    s.answer(KA, { ok: false, wrong: KI });
    s.answer(KA, { ok: false, wrong: KI });
    expect(s.fold.state.confusions.get(KA)?.get(KI)).toBe(2);
    s.answer(KA, { task: 'contrast', ok: true, alt: KI });
    expect(s.fold.state.confusions.get(KA)?.get(KI)).toBe(1);
    s.answer(KA, { task: 'contrast', ok: true, alt: KI });
    expect(s.fold.state.confusions.has(KA)).toBe(false);
    s.answer(KA, { task: 'contrast', ok: true, alt: KI });
    expect(s.fold.state.confusions.size).toBe(0);
    s.answer(KA, { task: 'contrast', ok: false, alt: SA });
    s.answer(KA, { ok: false, wrong: KI });
    expect(s.fold.state.confusions.get(KA)).toEqual(
      new Map([
        [SA, 1],
        [KI, 1],
      ]),
    );
  });

  it('grades the kana of a word that are learned', () => {
    const s = session();
    s.intro(KA);
    for (let i = 0; i < 5; i++) s.answer(KA);
    s.intro(KI);
    const kiBefore = s.item(KI);
    s.add((id) => answer('word:かき', { task: 'word', ...id }), 10_000);
    expect(s.item(KA)?.lastAt).toBe(s.fold.last?.at);
    expect(s.item(KI)).toEqual(kiBefore);
  });

  it('gives no effect to a slow fluency answer and does not touch the streak', () => {
    const s = session(0, { stats: false, line: () => TARGET });
    s.intro(KA);
    s.answer(KA);
    const before = s.item(KA);
    s.answer(KA, { task: 'fluency', ms: TARGET + 1 });
    expect(s.item(KA)).toEqual(before);
    expect(s.fold.state.learner.tasks).toBe(3);
  });
});

describe('ignored events', () => {
  it('skips an unknown kana, counts it and never throws', () => {
    const fold = createFold({ stats: false });
    expect(fold.apply(intro('hiragana:x', { n: 1 }))).toBe('applied');
    expect(fold.apply(answer('katakana:zz', { at: 1, n: 2 }))).toBe('applied');
    expect(fold.ignored).toBe(2);
    expect(fold.state.items.size).toBe(0);
    expect(fold.state.learner.tasks).toBe(0);
    expect(fold.last).toEqual({ at: 1, dev: 'd1', n: 2 });
  });
});

describe('apply', () => {
  it('returns duplicate and out-of-order and changes nothing', () => {
    const fold = createFold({ stats: false });
    expect(fold.apply(intro(KA, { at: 10, n: 2 }))).toBe('applied');
    const before = fold.snapshot();
    expect(fold.apply(intro(KA, { at: 10, n: 2 }))).toBe('duplicate');
    expect(fold.apply(answer(KA, { at: 5, n: 1 }))).toBe('out-of-order');
    expect(fold.apply(answer(KA, { at: 10, dev: 'a', n: 3 }))).toBe('out-of-order');
    expect(fold.snapshot()).toEqual(before);
    expect(fold.last).toEqual({ at: 10, dev: 'd1', n: 2 });
    expect(fold.apply(answer(KA, { at: 10, dev: 'z', n: 1 }))).toBe('applied');
  });

  it('knows a repeated n of any number, as a set would, in a clone too', () => {
    // Whole numbers from 0 up are kept as bits; any other number (and a large one) in a set.
    const odd = [0, -0, 8192, 2 ** 22, 2 ** 40, 1.5, -3, Number.NaN];
    const fold = createFold({ stats: false });
    let at = 0;
    const applied = odd.map((n) => fold.apply(end({ at: (at += 1), n })));
    expect(applied).toEqual(['applied', 'duplicate', ...odd.slice(2).map(() => 'applied')]);
    const clone = fold.clone();
    for (const f of [fold, clone]) {
      for (const n of odd) expect(f.apply(end({ at: (at += 1), n })), `n ${n}`).toBe('duplicate');
      expect(f.apply(end({ at: (at += 1), n: 1 }))).toBe('applied');
    }
  });
});

describe('foldLog, snapshot, clone', () => {
  const log: LogEvent[] = [
    start(0, { at: 1, n: 1 }),
    intro(KA, { at: 2, n: 2 }),
    answer(KA, { at: 3, n: 3 }),
    answer(KA, { at: 4, n: 4, ok: false, wrong: KI }),
    end({ at: 5, n: 5 }),
  ];

  it('equals applying the sorted events one by one, in any order, with repeats', () => {
    const one = createFold({ stats: false });
    for (const e of log) one.apply(e);
    const shuffled = [log[3], log[0], log[4], log[3], log[1], log[2], log[0]].flatMap((e) =>
      e === undefined ? [] : [e],
    );
    const all = foldLog(shuffled, { stats: false });
    expect(all.snapshot()).toEqual(one.snapshot());
    expect(all.last).toEqual(one.last);
  });

  it('gives a snapshot that a later apply does not change', () => {
    const fold = foldLog(log, { stats: false });
    const snap = fold.snapshot();
    const frozen = structuredClone({
      items: [...snap.state.items],
      learner: snap.state.learner,
      confusions: [...snap.state.confusions].map(([k, v]) => [k, [...v]]),
    });
    fold.apply(answer(KA, { at: 100, n: 6, ok: false, wrong: SA }));
    fold.apply(intro(TA, { at: 101, n: 7 }));
    expect({
      items: [...snap.state.items],
      learner: snap.state.learner,
      confusions: [...snap.state.confusions].map(([k, v]) => [k, [...v]]),
    }).toEqual(frozen);
  });

  it('gives a clone that is independent of the original', () => {
    const fold = foldLog(log, { stats: false });
    const copy: Fold = fold.clone();
    const before = fold.snapshot();
    expect(copy.snapshot().state.items).toEqual(before.state.items);
    copy.apply(answer(KA, { at: 100, n: 6, ok: false, wrong: SA }));
    copy.apply(start(60, { at: 101, n: 7 }));
    expect(fold.snapshot()).toEqual(before);
    expect(fold.apply(answer(KA, { at: 100, n: 6 }))).toBe('applied');
    expect(copy.apply(answer(KA, { at: 100, n: 6 }))).toBe('duplicate');
  });

  it('gives a clone the line of its original, or the one it is given', () => {
    const fold = foldLog(log, { stats: false, line: () => 0 });
    const hard = fold.clone();
    hard.apply(answer(KA, { at: 100, n: 6, ms: 1 }));
    const good = fold.clone({ line: () => Number.POSITIVE_INFINITY });
    good.apply(answer(KA, { at: 100, n: 6, ms: 1 }));
    const hardMemory = hard.state.items.get(KA)?.memory;
    const goodMemory = good.state.items.get(KA)?.memory;
    expect(goodMemory?.difficulty).toBeLessThan(hardMemory?.difficulty ?? 0);
  });
});

describe('pace (ADR 115)', () => {
  /** A fold with KA learning, and a correct recall of `ms` on `dev` that returns KA's grade. */
  function grader() {
    const s = session();
    s.intro(KA);
    return {
      s,
      recall(ms: number, over: Partial<Parameters<typeof answer>[1]> = {}): 2 | 3 {
        const before = s.item(KA)?.memory.difficulty ?? 0;
        s.answer(KA, { ms, ...over });
        const after = s.item(KA)?.memory.difficulty ?? 0;
        // A good grade lowers the difficulty toward its target; a hard one raises it.
        return after > before ? 2 : 3;
      },
    };
  }

  it('grades every correct answer good until a pace has PACE_MIN answers', () => {
    const g = grader();
    for (let i = 0; i < PACE_MIN; i++) expect(g.recall(9000)).toBe(3);
    expect(g.s.fold.state.learner.pace.get('recall:d1')?.count).toBe(PACE_MIN);
    expect(g.s.fold.state.learner.pace.get('recall')?.count).toBe(PACE_MIN);
  });

  it('grades a correct recall slower than the device pace hard', () => {
    const g = grader();
    for (let i = 0; i < PACE_MIN; i++) g.recall(1000);
    expect(g.recall(1000)).toBe(3);
    expect(g.recall(3000)).toBe(2);
    expect(g.recall(3000, { hint: true })).toBe(2);
  });

  it('gives a new device the pace of every device until it has its own', () => {
    const g = grader();
    for (let i = 0; i < PACE_MIN; i++) g.recall(1000);
    expect(g.recall(3000, { dev: 'd2' })).toBe(2);
    for (let i = 0; i < PACE_MIN; i++) g.recall(3000, { dev: 'd2' });
    // d2's own pace is about 3000 ms now; d1 keeps its own.
    expect(g.recall(2900, { dev: 'd2' })).toBe(3);
    expect(g.recall(2900)).toBe(2);
  });

  it('moves only on correct timed answers without a hint, per task', () => {
    const g = grader();
    g.recall(1000);
    g.recall(9000, { ok: false });
    g.recall(9000, { hint: true });
    g.s.answer(KA, { task: 'recognition', ms: 9000 });
    g.s.answer(KA, { task: 'dictation', ms: 2000 });
    const { pace } = g.s.fold.state.learner;
    expect(pace.get('recall:d1')).toEqual({ level: Math.log(1000), count: 1 });
    expect(pace.get('dictation:d1')).toEqual({ level: Math.log(2000), count: 1 });
    expect(pace.has('recognition')).toBe(false);
  });

  it('follows a streaming 90th percentile: about one correct recall in ten is hard', () => {
    const s = session();
    s.intro(KA);
    let hard = 0;
    let state = 7;
    for (let i = 0; i < 2000; i++) {
      // A deterministic spread of times around 1200 ms.
      state = (state * 48271) % 2147483647;
      const ms = Math.round(1200 * Math.exp(0.3 * ((state / 2147483647) * 2 - 1) * 1.7));
      const before = s.item(KA)?.memory.difficulty ?? 0;
      s.answer(KA, { ms });
      if (i >= 200 && (s.item(KA)?.memory.difficulty ?? 0) > before) hard += 1;
    }
    expect(hard / 1800).toBeGreaterThan(0.07);
    expect(hard / 1800).toBeLessThan(0.13);
  });
});
