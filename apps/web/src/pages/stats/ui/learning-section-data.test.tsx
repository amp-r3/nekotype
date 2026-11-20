// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { learnTrack } from '@/entities/settings';
import { initialLearnState, localDay } from '@/entities/learn';
import { StatsPage } from './stats-page';

// The route brings the strings of the screen; here the test does.
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

// A file of its own: the learning store is read once per page load, so the record is seeded before
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
    const base = initialLearnState();
    const db = await getDatabase();
    await db.put('delta', 'learn', {
      learn: {
        ...base,
        activeDays: [
          [today - 9, today - 7],
          [today - 2, today],
        ],
        // Days 9, 8 and 2 and 0 ago have answers on hiragana; nothing on katakana.
        recallBuckets: {
          hiragana: {
            [String(today - 9)]: { '10': 3 },
            [String(today - 8)]: { '12': 2 },
            [String(today - 2)]: { '14': 1 },
            [String(today)]: { '11': 4 },
          },
          katakana: {},
        },
      },
      counters: { started: 5, finished: 4 },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
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
    // The dotted days of the map are the days of the streak: today and the two before it.
    const dotted = Array.from(container.querySelectorAll('[data-testid="activity-cell"].is-run'));
    expect(dotted).toHaveLength(3);
    expect(dotted.at(-1)?.classList.contains('is-today')).toBe(true);
    // One section with no switch, and no session line below the chart.
    expect(container.querySelector('h1')?.textContent).toBe(t('page.stats'));
    expect(container.querySelectorAll('[role="radiogroup"]').length).toBe(1);
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

    // Only hiragana has answers: the chart shows it and there is no track switch.
    expect(container.querySelector(`[aria-label="${t('learn.track.label')}"]`)).toBeNull();
    expect(learnTrack.value).toBe('hiragana');
  });
});
