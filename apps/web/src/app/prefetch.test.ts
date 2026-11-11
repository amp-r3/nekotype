import { describe, it, expect, vi } from 'vitest';
import { prefetch, runWhenIdle } from './prefetch';
import type { PrefetchDeps } from './prefetch';
import { ROUTE_PATHS } from './route-paths';

describe('prefetch: the other screens and the content chunks, after the first render', () => {
  it('loads every route and the content chunks of the selected script', async () => {
    const loadRoute = vi.fn<PrefetchDeps['loadRoute']>(() => Promise.resolve());
    const loadChunk = vi.fn<PrefetchDeps['loadChunk']>(() => Promise.resolve());
    const extra = vi.fn(() => Promise.resolve());
    await prefetch({
      content: 'words',
      script: 'hiragana',
      loadRoute,
      loadChunk,
      loadExtras: [extra],
    });

    expect(loadRoute.mock.calls.map((call) => call[0])).toEqual([...ROUTE_PATHS]);
    expect(loadChunk.mock.calls).toEqual([['words-hiragana']]);
    expect(extra).toHaveBeenCalledTimes(1);
  });

  it('loads all chunks of the kind for both scripts', async () => {
    const loadChunk = vi.fn<PrefetchDeps['loadChunk']>(() => Promise.resolve());
    await prefetch({
      content: 'phrases',
      script: 'both',
      loadRoute: () => Promise.resolve(),
      loadChunk,
      loadExtras: [],
    });
    expect(loadChunk.mock.calls).toEqual([
      ['phrases-hiragana'],
      ['phrases-katakana'],
      ['phrases-mixed'],
    ]);
  });

  it('ignores failures: a rejected chunk neither throws nor stops the others', async () => {
    const loadRoute = vi.fn((path: string) =>
      path === '/stats' ? Promise.reject(new Error('offline')) : Promise.resolve(),
    );
    const loadChunk = vi.fn<PrefetchDeps['loadChunk']>(() => Promise.reject(new Error('offline')));
    const extra = vi.fn(() => Promise.reject(new Error('offline')));
    await expect(
      prefetch({ content: 'words', script: 'hiragana', loadRoute, loadChunk, loadExtras: [extra] }),
    ).resolves.toBeUndefined();
    expect(loadRoute).toHaveBeenCalledTimes(ROUTE_PATHS.length);
    expect(loadChunk).toHaveBeenCalledTimes(1);
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
