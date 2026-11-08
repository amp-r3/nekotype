import { describe, it, expect, vi } from 'vitest';
import { contentKindsFor, prefetch, runWhenIdle } from './prefetch';
import type { PrefetchDeps } from './prefetch';
import { ROUTE_PATHS } from './route-paths';

describe('prefetch: the other screens and the content chunks, after the first render', () => {
  it('chooses the vocabulary kinds for the settings', () => {
    expect(contentKindsFor('words')).toEqual(['words']);
    expect(contentKindsFor('phrases')).toEqual(['phrases']);
  });

  it('loads every route and the chosen content chunks', async () => {
    const loadRoute = vi.fn<PrefetchDeps['loadRoute']>(() => Promise.resolve());
    const loadContent = vi.fn<PrefetchDeps['loadContent']>(() => Promise.resolve());
    const extra = vi.fn(() => Promise.resolve());
    await prefetch({ content: 'words', loadRoute, loadContent, loadExtras: [extra] });

    expect(loadRoute.mock.calls.map((call) => call[0])).toEqual([...ROUTE_PATHS]);
    expect(loadContent.mock.calls).toEqual([['words']]);
    expect(extra).toHaveBeenCalledTimes(1);
  });

  it('ignores failures: a rejected chunk neither throws nor stops the others', async () => {
    const loadRoute = vi.fn((path: string) =>
      path === '/stats' ? Promise.reject(new Error('offline')) : Promise.resolve(),
    );
    const loadContent = vi.fn<PrefetchDeps['loadContent']>(() =>
      Promise.reject(new Error('offline')),
    );
    const extra = vi.fn(() => Promise.reject(new Error('offline')));
    await expect(
      prefetch({ content: 'words', loadRoute, loadContent, loadExtras: [extra] }),
    ).resolves.toBeUndefined();
    expect(loadRoute).toHaveBeenCalledTimes(ROUTE_PATHS.length);
    expect(loadContent).toHaveBeenCalledTimes(1);
  });

  it('runs on requestIdleCallback when there is one, else after a timer', () => {
    const task = vi.fn();
    const requestIdleCallback = vi.fn();
    const setTimeoutFn = vi.fn();
    runWhenIdle(task, { requestIdleCallback, setTimeout: setTimeoutFn });
    expect(requestIdleCallback).toHaveBeenCalledWith(task);
    expect(setTimeoutFn).not.toHaveBeenCalled();

    runWhenIdle(task, { setTimeout: setTimeoutFn });
    expect(setTimeoutFn).toHaveBeenCalledTimes(1);
    expect(setTimeoutFn.mock.calls[0]?.[0]).toBe(task);
  });
});
