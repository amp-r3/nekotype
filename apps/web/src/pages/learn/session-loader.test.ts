import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Loader from './session-loader';

const { loadPart, loadStyles } = vi.hoisted(() => ({
  loadPart: vi.fn<(part: string) => Promise<void>>(),
  loadStyles: vi.fn<() => Promise<void>>(),
}));

vi.mock('@/shared/i18n', () => ({ loadDictionaryPart: loadPart }));
vi.mock('./ui/session-runtime', () => ({ loadSessionStyles: loadStyles }));

// The loader keeps what it has loaded: each test takes a fresh copy.
async function freshLoader(): Promise<typeof Loader> {
  vi.resetModules();
  return import('./session-loader');
}

beforeEach(() => {
  loadPart.mockReset();
  loadPart.mockResolvedValue(undefined);
  loadStyles.mockReset();
  loadStyles.mockResolvedValue(undefined);
});

describe('loadSessionRuntime', () => {
  it('gives the runtime only once the `session` part of the dictionary is in', async () => {
    let arrive = (): void => undefined;
    loadPart.mockReturnValue(
      new Promise((resolve) => {
        arrive = () => {
          resolve();
        };
      }),
    );
    const { loadSessionRuntime } = await freshLoader();
    const settled = vi.fn();
    const request = loadSessionRuntime().then((runtime) => {
      settled();
      return runtime;
    });

    await vi.dynamicImportSettled();
    expect(loadPart).toHaveBeenCalledWith('session');
    expect(settled).not.toHaveBeenCalled();

    arrive();
    expect(await request).not.toBeNull();
  });

  it('is null when the part fails, and a later call loads it again', async () => {
    loadPart.mockRejectedValueOnce(new Error('offline'));
    const { loadSessionRuntime } = await freshLoader();

    expect(await loadSessionRuntime()).toBeNull();
    expect(await loadSessionRuntime()).not.toBeNull();
    expect(loadPart).toHaveBeenCalledTimes(2);
  });

  it('is null when the stylesheet fails, and a later call loads it again', async () => {
    loadStyles.mockRejectedValueOnce(new Error('offline'));
    const { loadSessionRuntime } = await freshLoader();

    expect(await loadSessionRuntime()).toBeNull();
    expect(await loadSessionRuntime()).not.toBeNull();
    expect(loadStyles).toHaveBeenCalledTimes(2);
  });

  it('keeps a loaded runtime, and its prefetch ignores a failure', async () => {
    loadPart.mockRejectedValueOnce(new Error('offline'));
    const { loadSessionRuntime, prefetchSessionRuntime } = await freshLoader();

    await expect(prefetchSessionRuntime()).resolves.toBeUndefined();
    const runtime = await loadSessionRuntime();
    expect(await loadSessionRuntime()).toBe(runtime);
    expect(loadPart).toHaveBeenCalledTimes(2);
  });
});
