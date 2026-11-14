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

  it('shows the streaks, both tracks, the session line and a chart with gaps; the section follows the switch', async () => {
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
      counters: { started: { typing: 0, learn: 5 }, finished: { typing: 0, learn: 4 } },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await act(settle);

    const text = (id: string): string | null | undefined =>
      container.querySelector(`[data-testid="${id}"]`)?.textContent;
    const stats = Array.from(container.querySelectorAll('.text-mono-stat')).map(
      (el) => el.parentElement?.parentElement?.textContent,
    );
    expect(stats).toEqual([
      `${t('stats.learn.streakCurrent')}3days`,
      `${t('stats.learn.streakBest')}3days`,
      `${t('stats.learn.masteredTrack', { track: t('learn.track.hiragana') })}0of 104`,
      `${t('stats.learn.masteredTrack', { track: t('learn.track.katakana') })}0of 125`,
    ]);
    expect(text('stats-sessions')).toBe('learning sessions: 5 started · 4 finished');
    // One section at a time: the typing section is not on the page, the learning one is selected.
    expect(container.querySelector('h1')?.textContent).toBe(t('page.stats'));
    expect(container.textContent).not.toContain(t('stats.typing.empty.title'));
    expect(
      container.querySelector(`[aria-label="${t('stats.section.label')}"] [aria-checked="true"]`)
        ?.textContent,
    ).toBe(t('stats.section.learning'));
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

    // The typing section has no data: its empty state, and the hash follows the switch.
    const typingTab = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === t('stats.section.typing'),
    );
    await act(() => {
      typingTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(window.location.hash).toBe('#typing');
    expect(container.textContent).toContain(t('stats.typing.empty.title'));
    expect(container.querySelector('[data-testid="stats-median-chart"]')).toBeNull();
  });
});
