// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { StatsPage } from './stats-page';
import { t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('stats page: learning section', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows empty progress, streaks and counters of a fresh state', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await act(settle);

    const text = (id: string): string | null | undefined =>
      container.querySelector(`[data-testid="${id}"]`)?.textContent;
    expect(text('stats-mastered')).toBe(t('stats.learn.mastered', { done: 0, total: 104 }));
    expect(text('stats-streak-current')).toBe(t('stats.learn.streakCurrent', { days: 0 }));
    expect(text('stats-streak-best')).toBe(t('stats.learn.streakBest', { days: 0 }));
    expect(text('stats-sessions')).toBe(t('stats.learn.sessions', { finished: 0, started: 0 }));
    expect(text('stats-no-data')).toBe(t('stats.learn.noData'));
  });
});
