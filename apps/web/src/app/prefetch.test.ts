import { describe, it, expect, vi } from 'vitest';
import { prefetch, runWhenIdle } from './prefetch';
import type { PrefetchDeps } from './prefetch';
import { ROUTE_PATHS } from './route-paths';

describe('prefetch: the other screens, after the first render', () => {
  it('loads every route and the other lazy pieces', async () => {
    const loadRoute = vi.fn<PrefetchDeps['loadRoute']>(() => Promise.resolve());
    const extra = vi.fn(() => Promise.resolve());
    await prefetch({ loadRoute, loadExtras: [extra] });

    expect(loadRoute.mock.calls.map((call) => call[0])).toEqual([...ROUTE_PATHS]);
    expect(extra).toHaveBeenCalledTimes(1);
  });

  it('ignores failures: a rejected screen neither throws nor stops the others', async () => {
    const loadRoute = vi.fn((path: string) =>
      path === '/stats' ? Promise.reject(new Error('offline')) : Promise.resolve(),
    );
    const extra = vi.fn(() => Promise.reject(new Error('offline')));
    const other = vi.fn(() => Promise.resolve());
    await expect(prefetch({ loadRoute, loadExtras: [extra, other] })).resolves.toBeUndefined();
    expect(loadRoute).toHaveBeenCalledTimes(ROUTE_PATHS.length);
    expect(other).toHaveBeenCalledTimes(1);
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
