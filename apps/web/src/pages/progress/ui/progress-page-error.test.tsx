// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type * as Lib from '@/shared/lib';
import { t } from '@/shared/i18n';

// The first read of the database fails, the next ones succeed: the error and its retry.
const reads = vi.hoisted(() => ({ failing: true }));
vi.mock('@/shared/lib', async () => {
  const original = await vi.importActual<typeof Lib>('@/shared/lib');
  return {
    ...original,
    getDatabase: async () => {
      if (reads.failing) throw new Error('blocked');
      return original.getDatabase();
    },
  };
});

const { ProgressPage } = await import('./progress-page');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (): Promise<void> => sleep(30);
/** Waits until the loading line is gone: the log and the lazy model chunk both have to arrive. */
async function loaded(container: HTMLElement): Promise<void> {
  for (let i = 0; i < 200 && container.textContent.includes(t('route.loading')); i++) {
    await sleep(10);
  }
}

describe('stats page: loading and error', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows the loading text, then the error with a retry that leads to the empty state', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<ProgressPage />, container);
    // The title stays in every state.
    expect(container.querySelector('h1')?.textContent).toBe(t('page.progress'));
    expect(container.textContent).toContain(t('route.loading'));

    await act(settle);
    expect(container.textContent).toContain(t('learn.loadError'));
    expect(container.querySelector('[data-testid="stats-median-chart"]')).toBeNull();
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === t('learn.retry'),
    );
    expect(retry).toBeDefined();

    reads.failing = false;
    await act(() => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(() => loaded(container));
    expect(container.textContent).not.toContain(t('learn.loadError'));
    expect(container.textContent).toContain(t('stats.empty.title'));
  });
});
