import { describe, it, expect } from 'vitest';
import { answer, intro, key, learnedEvents, viewOfEvents } from './test-util';
import { isEmptySummary, summarize } from './summary';

const NOW = 1_700_000_000_000;
const noConfusion = { mixups: [], errors: [] } as const;

/** Ten recalls of a kana, each `ms` long, from `at`. */
const recalls = (kana: string, at: number, ms: number): ReturnType<typeof answer>[] =>
  Array.from({ length: 10 }, (_, i) => answer(key(kana), { at: at + i * 1000, ms }));

describe('summarize', () => {
  it('is empty when nothing changed', () => {
    const view = viewOfEvents(learnedEvents('あ', NOW));
    expect(isEmptySummary(summarize({ ...noConfusion, before: view, after: view }))).toBe(true);
  });

  it('lists the kana introduced during the session, of both tracks', () => {
    const before = viewOfEvents(learnedEvents('あ', NOW));
    const after = viewOfEvents([
      ...learnedEvents('あ', NOW),
      intro(key('い'), { at: NOW + 1_000_000 }),
      intro('katakana:ア', { at: NOW + 1_000_001 }),
    ]);
    expect(summarize({ ...noConfusion, before, after }).introduced).toEqual([
      key('い'),
      'katakana:ア',
    ]);
  });

  it('lists kana that were locked or learning at the start and are learned at the end', () => {
    const start = [intro(key('あ'), { at: NOW }), ...learnedEvents('い', NOW + 1000)];
    const before = viewOfEvents(start);
    const after = viewOfEvents([
      ...start,
      ...Array.from({ length: 5 }, (_, i) =>
        answer(key('あ'), { at: NOW + 2_000_000 + 40_000 * i, ms: 900 }),
      ),
    ]);
    expect(summarize({ ...noConfusion, before, after }).learned).toEqual([key('あ')]);
  });

  it('lists changes of 100 ms or more for kana with 10 answers at the start, largest first', () => {
    const start = [
      intro(key('あ'), { at: NOW }),
      ...recalls('あ', NOW + 1000, 1800),
      intro(key('い'), { at: NOW + 20_000 }),
      ...recalls('い', NOW + 21_000, 1000),
      intro(key('う'), { at: NOW + 40_000 }),
      ...recalls('う', NOW + 41_000, 1000),
    ];
    const before = viewOfEvents(start);
    const later = NOW + 5_000_000;
    const after = viewOfEvents([
      ...start,
      ...recalls('あ', later, 800),
      ...recalls('い', later + 20_000, 1700),
      ...recalls('う', later + 40_000, 1050),
    ]);
    const summary = summarize({ ...noConfusion, before, after });
    expect(summary.faster.map((change) => change.key)).toEqual([key('あ')]);
    expect(summary.slower.map((change) => change.key)).toEqual([key('い')]);
    expect(summary.faster[0]?.from).toBe(1800);
  });

  it('passes the confusions of the session through', () => {
    const view = viewOfEvents([]);
    const summary = summarize({
      before: view,
      after: view,
      mixups: [{ key: key('あ'), chosen: key('お') }],
      errors: [key('い')],
    });
    expect(isEmptySummary(summary)).toBe(false);
    expect(summary.errors).toEqual([key('い')]);
  });
});
