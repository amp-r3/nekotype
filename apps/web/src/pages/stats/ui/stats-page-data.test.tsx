// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { t } from '@/shared/i18n';
import { learnTrack } from '@/entities/settings';
import { initialLearnState, localDay } from '@/entities/learn';
import { StatsPage } from './stats-page';

// A file of its own: the learning store is read once per page load, so the record is seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('stats page: with answers', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows both tracks, the streaks, the counters and a chart with gaps; the switch is local', async () => {
    const today = localDay(Date.now());
    const base = initialLearnState();
    const db = await getDatabase();
    await db.put('delta', 'current', {
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
    expect(text('stats-mastered')).toBe('hiragana 0 of 104katakana 0 of 125');
    expect(container.textContent).toContain(`${t('stats.learn.streakCurrent')}3 days`);
    expect(container.textContent).toContain(`${t('stats.learn.streakBest')}3 days`);
    expect(text('stats-started')).toBe('5');
    expect(text('stats-finished')).toBe('4');

    // 10 days from the first answer to today; days without answers are gaps. The two first days
    // are one line, the days 2 ago and today stand alone as dots.
    expect(container.querySelectorAll('[data-testid="chart-dot"]')).toHaveLength(4);
    expect(container.querySelectorAll('polyline')).toHaveLength(1);
    // The target is a dashed hair line with its label.
    const target = container.querySelector('[data-testid="chart-reference"]');
    expect(target?.querySelector('line')?.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(target?.textContent).toBe(t('stats.learn.target', { ms: 1500 }));

    // Looking at katakana here does not change the track of `/`.
    const katakana = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === t('learn.track.katakana'),
    );
    await act(() => {
      katakana?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(text('stats-no-data')).toBe(t('stats.learn.noData'));
    expect(container.querySelector('[data-testid="stats-median-chart"]')).toBeNull();
    expect(learnTrack.value).toBe('hiragana');
  });
});
