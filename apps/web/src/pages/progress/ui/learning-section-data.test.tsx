// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { learnTrack } from '@/entities/settings';
import { initLearn, localDay } from '@/entities/learn';
import { seedStatsLog } from '../lib/test-util';
import { ProgressPage } from './progress-page';

// The route brings the strings of the screen; here the test does.
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

// A file of its own: the learning store is read once per page load, so the log is seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('learning section: with answers', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows the streak with its dotted days, the totals and a chart with gaps', async () => {
    const today = localDay(Date.now());
    // Hiragana recall 9, 8, 2 and 0 days ago; recognition only 7 and 1 days ago; no katakana.
    await seedStatsLog(
      [
        { day: today - 9, hiragana: [1000, 1100, 1200] },
        { day: today - 8, hiragana: [1500, 1600] },
        { day: today - 7, recognitions: 2 },
        { day: today - 2, hiragana: [1300] },
        { day: today - 1, recognitions: 1 },
        { day: today, hiragana: [1000, 1200, 1400, 1600] },
      ],
      { started: 5, finished: 4 },
    );

    // The log and the model chunk load before the page renders: a slow first import of the
    // model must not leave the test on the loading line.
    await initLearn(() => 1500);
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<ProgressPage />, container);
    await act(settle);

    const stats = Array.from(container.querySelectorAll('.text-mono-stat')).map(
      (el) => el.parentElement?.parentElement?.textContent,
    );
    expect(stats).toEqual([
      `${t('stats.learn.masteredTrack', { track: t('learn.track.hiragana') })}0of 104`,
      `${t('stats.learn.masteredTrack', { track: t('learn.track.katakana') })}0of 125`,
      `${t('stats.learn.sessionsStarted')}5`,
      `${t('stats.learn.sessionsFinished')}4`,
    ]);
    // The streak column: the number, the best run and the active days of the last 30.
    expect(container.querySelector('[data-testid="stats-streak"]')?.textContent).toBe('3');
    expect(container.querySelector('[data-testid="stats-active-30"]')?.textContent).toBe(
      'active days in the last 30: 6',
    );
    expect(container.textContent).toContain('best: 3 days');
    expect(container.textContent).toContain('3days in a row');
    // Only the number of the best run is set in mono, not its unit.
    const bestLine = Array.from(container.querySelectorAll('p')).find((p) =>
      p.textContent.startsWith('best:'),
    );
    expect(bestLine?.querySelector('.font-mono')?.textContent).toBe('3');
    // The dotted days of the map are the days of the streak: today and the two before it.
    const dotted = Array.from(container.querySelectorAll('[data-testid="activity-cell"].is-run'));
    expect(dotted).toHaveLength(3);
    expect(dotted.at(-1)?.classList.contains('is-today')).toBe(true);
    // The page's track switch and the period switch; no session line below the chart.
    expect(container.querySelector('h1')?.textContent).toBe(t('page.progress'));
    expect(container.querySelectorAll('[role="radiogroup"]').length).toBe(2);
    expect(container.querySelector(`[aria-label="${t('stats.trackShown')}"]`)).not.toBeNull();
    expect(container.querySelector('[data-testid="stats-sessions"]')).toBeNull();
    expect(container.textContent).toContain(`hiragana · ${t('stats.learn.answerCaptionDay')}`);

    // One bar per day with answers (30 days by default); the gap days have none.
    expect(container.querySelectorAll('[data-testid="chart-range"]')).toHaveLength(4);
    // The target is a dashed line with its label.
    const target = container.querySelector('[data-testid="chart-reference"]');
    expect(target?.querySelector('line')?.getAttribute('class')).toBe('nk-rc__ref');
    expect(target?.textContent).toBe(t('stats.learn.target', { ms: 1500 }));

    // 7 days: the two last days only.
    const sevenDays = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === t('stats.filter.p7'),
    );
    await act(() => {
      sevenDays?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelectorAll('[data-testid="chart-range"]')).toHaveLength(2);

    // The switch is the page's, and it is view-only: the other track has no answers, and the
    // learning track of `/` stays.
    const katakana = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === t('learn.track.katakana'),
    );
    await act(() => {
      katakana?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain(t('stats.learn.noTrackAnswers.katakana'));
    expect(container.querySelector('[data-testid="stats-median-chart"]')).toBeNull();
    expect(container.querySelector('[data-testid="kana-chart"]')).not.toBeNull();
    expect(learnTrack.value).toBe('hiragana');
  });
});
