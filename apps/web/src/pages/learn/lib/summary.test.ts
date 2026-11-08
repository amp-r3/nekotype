import { describe, it, expect } from 'vitest';
import { summarize, isEmptySummary } from './summary';
import { answers, key, stateWith } from './test-util';

const VOWELS = ['あ', 'い', 'う', 'え', 'お'];
const base = { track: 'hiragana', targetMs: 1500, mixups: [], errors: [] } as const;

describe('summarize', () => {
  it('is empty when nothing changed', () => {
    const state = stateWith({});
    const summary = summarize({ ...base, before: state, after: state });
    expect(isEmptySummary(summary)).toBe(true);
  });

  it('lists the kana unlocked during the session', () => {
    const before = stateWith({});
    const after = stateWith({ unlocked: [...VOWELS, 'か'] });
    expect(summarize({ ...base, before, after }).unlocked).toEqual([key('か')]);
  });

  it('lists kana that were not confident at the start and are at the end', () => {
    const before = stateWith({ recent: { あ: answers(9, 800), い: answers(10, 800) } });
    const after = stateWith({
      recent: { あ: answers(10, 800), い: answers(10, 800), う: answers(10, 3000) },
    });
    expect(summarize({ ...base, before, after }).confident).toEqual([key('あ')]);
  });

  it('lists changes of 100 ms or more for kana with 10 answers at the start, largest first', () => {
    const before = stateWith({
      recent: {
        あ: answers(10, 1700),
        い: answers(10, 1000),
        う: answers(10, 1000),
        え: answers(10, 1000),
        お: answers(9, 1000),
      },
    });
    const after = stateWith({
      recent: {
        あ: answers(10, 1380),
        い: answers(10, 1099),
        う: answers(10, 1250),
        え: answers(10, 1100),
        お: answers(10, 400),
      },
    });
    const summary = summarize({ ...base, before, after });
    expect(summary.faster).toEqual([{ key: key('あ'), from: 1700, to: 1380 }]);
    // い moved by 99 ms: not listed; お had 9 answers at the start: not listed.
    expect(summary.slower).toEqual([
      { key: key('う'), from: 1000, to: 1250 },
      { key: key('え'), from: 1000, to: 1100 },
    ]);
  });

  it('lists at most five each way', () => {
    const kana = ['あ', 'い', 'う', 'え', 'お', 'か', 'き'];
    const recent = (ms: number) => Object.fromEntries(kana.map((k) => [k, answers(10, ms)]));
    const before = stateWith({ unlocked: [...VOWELS, 'か', 'き'], recent: recent(2000) });
    const after = stateWith({ unlocked: [...VOWELS, 'か', 'き'], recent: recent(1000) });
    expect(summarize({ ...base, before, after }).faster).toHaveLength(5);
  });

  it('passes the confusions through', () => {
    const state = stateWith({});
    const summary = summarize({
      ...base,
      before: state,
      after: state,
      mixups: [{ key: key('ぬ'), chosen: key('め') }],
      errors: [key('ね')],
    });
    expect(summary.mixups).toHaveLength(1);
    expect(summary.errors).toEqual([key('ね')]);
    expect(isEmptySummary(summary)).toBe(false);
  });
});
