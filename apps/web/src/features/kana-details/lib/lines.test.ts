// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { KanaView } from '@nekotype/model';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { answer, intro } from '@nekotype/model/testing';
import { loadDictionaryPart } from '@/shared/i18n';
import { KEY_A, KEY_I, T0, sampleView, viewOfEvents } from '../test-view';
import { detailsRows } from './lines';

await loadDictionaryPart('details');

const sample = sampleView();
const view = (key: LearnKanaKey): KanaView => {
  const found = sample.kana.get(key);
  if (found === undefined) throw new Error(`no kana ${key}`);
  return found;
};
const text = (row: ReturnType<typeof detailsRows>[number]): string =>
  row.value.map((run) => run.text).join('');

describe('detailsRows', () => {
  it('gives the five rows of decision 147 in order', () => {
    const rows = detailsRows(view(KEY_A), T0);
    expect(rows.map((row) => row.id)).toEqual([
      'state',
      'memory',
      'recall',
      'mixups',
      'recognition',
    ]);
    expect(rows.map((row) => row.caption)).toEqual([
      'state',
      'memory',
      'recall',
      'mixed up with',
      'recognition',
    ]);
  });

  it('says what is known about a learned kana', () => {
    const kana = view(KEY_A);
    const rows = detailsRows(kana, (kana.dueFrom ?? 0) - 1);
    expect(text(rows[0] ?? never())).toMatch(/^learned · next review: .+/);
    expect(text(rows[2] ?? never())).toBe('median 900 ms · accuracy 100%');
    // Most first, each kana in its own run.
    expect(text(rows[3] ?? never())).toBe('い ×2, え ×1');
    expect(rows[3]?.value.filter((run) => run.kana === true).map((run) => run.text)).toEqual([
      'い',
      'え',
    ]);
    expect(text(rows[4] ?? never())).toBe('40% (2 of 5)');
  });

  it('marks a kana whose review is due', () => {
    const kana = view(KEY_A);
    expect(text(detailsRows(kana, (kana.dueFrom ?? 0) + 1)[0] ?? never())).toBe(
      'learned · review due',
    );
  });

  it('says so when a kana has no answers yet', () => {
    const rows = detailsRows(view(KEY_I), T0 + 2_000_000);
    expect(text(rows[0] ?? never())).toBe('learning');
    expect(text(rows[2] ?? never())).toBe('no recall answers yet');
    expect(text(rows[3] ?? never())).toBe('none yet');
    expect(text(rows[4] ?? never())).toBe('no answers yet');
  });

  it('counts the answers while there are fewer than 10', () => {
    const few = viewOfEvents([
      intro(KEY_I, { at: T0 }),
      ...Array.from({ length: 3 }, (_, n) => answer(KEY_I, { at: T0 + 1000 * (n + 1), ms: 2000 })),
    ]);
    const rows = detailsRows(few.kana.get(KEY_I) ?? never(), T0 + 10_000);
    expect(text(rows[2] ?? never())).toBe('median 2000 ms · accuracy 100% · 3 of 10 answers');
  });

  it('reads the memory: under a day, about n days, and the way to mastery', () => {
    // A learning kana holds less than a day, and mastery is not yet near.
    const learning = detailsRows(view(KEY_I), T0)[1];
    expect(text(learning ?? never())).toBe('holds less than a day · mastered from 21 days');
    expect(learning?.fill).toBeLessThan(1 / 21);

    const learned = { ...view(KEY_A), stability: 12.4 };
    const row = detailsRows(learned, T0)[1] ?? never();
    expect(text(row)).toBe('holds about 12 days · mastered from 21 days');
    expect(row.fill).toBeCloseTo(12.4 / 21);

    // One day is singular; a stability under one day is "less than a day".
    expect(text(detailsRows({ ...learned, stability: 1.2 }, T0)[1] ?? never())).toContain(
      'holds about 1 day ·',
    );
    expect(text(detailsRows({ ...learned, stability: 0.9 }, T0)[1] ?? never())).toContain(
      'holds less than a day',
    );

    // Once mastered the line has no `mastered from`, and the stroke is full beyond 21 days.
    const mastered = { ...view(KEY_A), state: 'mastered' as const, stability: 30 };
    const done = detailsRows(mastered, T0)[1] ?? never();
    expect(text(done)).toBe('holds about 30 days');
    expect(done.fill).toBe(1);
  });
});

function never(): never {
  throw new Error('missing');
}
