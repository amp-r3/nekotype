// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { initLearn, localDay } from '@/entities/learn';
import { seedStatsLog } from '../lib/test-util';
import { ProgressPage } from './progress-page';

await loadDictionaryPart('progress');

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

describe('learning section: the answer-time periods and tracks', () => {
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
    await seedStatsLog(
      [
        { day: today - 50, hiragana: [1000, 1200] },
        { day: today - 20, hiragana: [1100, 1300] },
        { day: today - 3, katakana: [1500] },
      ],
      { started: 2, finished: 2 },
    );

    // The log and the model chunk load before the page renders: a slow first import of the
    // model must not leave the test on the loading line.
    await initLearn();
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<ProgressPage />, container);
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
