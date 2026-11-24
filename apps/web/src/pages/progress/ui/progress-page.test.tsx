// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ProgressPage } from './progress-page';
import { t } from '@/shared/i18n';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits until the loading line is gone: the log and the lazy model chunk both have to arrive. */
async function loaded(container: HTMLElement): Promise<void> {
  for (let i = 0; i < 200 && container.textContent.includes(t('route.loading')); i++) {
    await sleep(10);
  }
}

describe('stats page: nothing learned yet', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows the empty state with one action to the learning screen', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<ProgressPage />, container);
    await act(() => loaded(container));

    expect(container.querySelector('h1')?.textContent).toBe(t('page.progress'));
    expect(container.textContent).toContain(t('stats.empty.title'));
    expect(container.textContent).toContain(t('stats.empty.text'));
    const action = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === t('stats.empty.action'),
    );
    expect(action).toBeDefined();
    // The sleeping cat is decorative.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    // No numbers of an empty state are shown as if they were real.
    expect(container.querySelector('[data-testid="stats-mastered"]')).toBeNull();
    expect(container.querySelector('[data-testid="stats-median-chart"]')).toBeNull();
  });
});
