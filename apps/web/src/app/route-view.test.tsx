// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { signal } from '@preact/signals';
import type { ComponentType } from 'preact';
import { t } from '@/shared/i18n';
import type { RoutePath } from './route-paths';

// No chunk is loaded; `/settings` has failed, the others are still loading.
vi.mock('./route-state', () => ({
  loadedRoutes: signal<ReadonlyMap<RoutePath, ComponentType>>(new Map()),
  failedRoutes: signal<ReadonlySet<RoutePath>>(new Set(['/settings'])),
  ensureRoute: () => Promise.resolve(),
}));

const { RouteView } = await import('./route-view');

describe('route view: a lazy screen that is not there yet', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  const mount = async (path: string): Promise<void> => {
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(() => {
      render(<RouteView path={path} onHome={() => {}} />, container);
    });
  };

  it('keeps the title of the screen over the loading notice', async () => {
    await mount('/progress');
    expect(container.querySelector('h1')?.textContent).toBe(t('page.progress'));
    expect(container.textContent).toContain(t('route.loading'));
  });

  it('keeps the title over the load error and its retry', async () => {
    await mount('/settings');
    expect(container.querySelector('h1')?.textContent).toBe(t('page.settings'));
    expect(container.textContent).toContain(t('route.loadError'));
  });

  it('shows no visible title for `/`, whose title is for screen readers only', async () => {
    await mount('/');
    expect(container.querySelector('h1')).toBeNull();
  });
});
