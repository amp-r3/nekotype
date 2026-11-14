// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { initialLearnState, localDay } from '@/entities/learn';
import { StatsPage } from './stats-page';

await loadDictionaryPart('stats');

// happy-dom has no layout: the chart draws once its container has a width.
vi.stubGlobal(
  'ResizeObserver',
  class {
    constructor(
      private readonly callback: (entries: { contentRect: { width: number } }[]) => void,
    ) {}
    observe(): void {
      this.callback([{ contentRect: { width: 600 } }]);
    }
    disconnect(): void {}
    unobserve(): void {}
  },
);

// A file of its own: the learning store is read once per page load, so the record is seeded first.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('stats page: the answer-time periods and tracks', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  const radio = (label: string): Element | undefined =>
    Array.from(container.querySelectorAll('[role="radio"]')).find((el) => el.textContent === label);
  const click = (label: string): Promise<void> =>
    act(() => {
      radio(label)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  const bars = (): number => container.querySelectorAll('[data-testid="chart-range"]').length;

  it('keeps one track per chart, shows the empty period and goes weekly over 45 days', async () => {
    const today = localDay(Date.now());
    const base = initialLearnState();
    const db = await getDatabase();
    await db.put('delta', 'learn', {
      learn: {
        ...base,
        activeDays: [[today - 50, today - 50]],
        recallBuckets: {
          hiragana: {
            [String(today - 50)]: { '10': 2 },
            [String(today - 20)]: { '12': 2 },
          },
          katakana: { [String(today - 3)]: { '15': 1 } },
        },
      },
      counters: { started: { typing: 0, learn: 2 }, finished: { typing: 0, learn: 2 } },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await act(settle);

    // Both tracks have answers: the switch is there; the default period is 30 days.
    expect(radio(t('learn.track.katakana'))).toBeDefined();
    await click(t('learn.track.hiragana'));
    expect(bars()).toBe(1);

    // Nothing in the last 7 days on hiragana: a notice with `show all time`, no chart.
    await click(t('stats.filter.p7'));
    expect(container.textContent).toContain(t('stats.learn.noPeriod'));
    expect(container.querySelector('[data-testid="stats-median-chart"]')).toBeNull();

    // The other track has an answer 3 days ago.
    await click(t('learn.track.katakana'));
    expect(bars()).toBe(1);
    await click(t('learn.track.hiragana'));

    // `show all time`: 51 days on the axis, so one bar per week.
    const showAll = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === t('stats.showAll'),
    );
    await act(() => {
      showAll?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(bars()).toBe(2);
    expect(container.textContent).toContain(t('stats.learn.answerCaptionWeek'));
  });
});
