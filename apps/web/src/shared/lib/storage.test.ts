import { describe, it, expect, vi } from 'vitest';
import {
  MemoryKeyValueStore,
  LocalStorageStore,
  createDebouncedSaver,
  isSettings,
  isProgress,
} from './index';

describe('storage: KeyValueStore implementations and guards', () => {
  it('MemoryKeyValueStore handles get, set, remove', () => {
    const store = new MemoryKeyValueStore();
    expect(store.get('key1')).toBeNull();

    store.set('key1', 'val1');
    expect(store.get('key1')).toBe('val1');

    store.remove('key1');
    expect(store.get('key1')).toBeNull();
  });

  it('LocalStorageStore never throws even when underlying storage throws', () => {
    const store = new LocalStorageStore();

    // Mock window.localStorage to throw errors (e.g. QuotaExceededError, SecurityError)
    const mockStorage: Storage = {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => {
        throw new Error('SecurityError: Access is denied for this document');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn(() => {
        throw new Error('Storage disabled');
      }),
      key: vi.fn(() => null),
    };

    const originalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    try {
      expect(() => store.get('anyKey')).not.toThrow();
      expect(store.get('anyKey')).toBeNull();

      expect(() => {
        store.set('anyKey', 'value');
      }).not.toThrow();
      expect(() => {
        store.remove('anyKey');
      }).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalStorage,
        writable: true,
        configurable: true,
      });
    }
  });

  it('guards validate valid settings and reject invalid/corrupted payloads', () => {
    const valid = {
      v: 1,
      script: 'both',
      content: 'words',
      strictness: 'learner',
      weakFocus: true,
      test: { kind: 'time', seconds: 30 },
    };
    expect(isSettings(valid)).toBe(true);

    // Wrong version
    expect(isSettings({ ...valid, v: 2 })).toBe(false);
    expect(isSettings({ ...valid, v: 0 })).toBe(false);

    // Corrupted field types
    expect(isSettings({ ...valid, script: 'klingon' })).toBe(false);
    expect(isSettings({ ...valid, content: 123 })).toBe(false);
    expect(isSettings({ ...valid, content: 'single' })).toBe(false);
    expect(isSettings({ ...valid, test: { kind: 'time', seconds: 999 } })).toBe(false);
    expect(isSettings('not an object')).toBe(false);
    expect(isSettings(null)).toBe(false);
  });

  it('guards validate progress payload and reject corrupted stats', () => {
    const validProgress = {
      v: 1,
      stats: {
        'hiragana:あ': { a: 10, m: 2, t: 450 },
      },
    };
    expect(isProgress(validProgress)).toBe(true);

    // Wrong version
    expect(isProgress({ ...validProgress, v: 2 })).toBe(false);

    // Corrupted stats
    expect(
      isProgress({
        v: 1,
        stats: {
          'hiragana:あ': { a: 'invalid', m: 0, t: 0 },
        },
      }),
    ).toBe(false);
  });

  it('debounced saver executes after delay and can be flushed synchronously', () => {
    vi.useFakeTimers();
    let saveCount = 0;
    const saver = createDebouncedSaver(() => {
      saveCount += 1;
    }, 300);

    saver.trigger();
    saver.trigger();
    saver.trigger();
    expect(saveCount).toBe(0);

    vi.advanceTimersByTime(299);
    expect(saveCount).toBe(0);

    vi.advanceTimersByTime(1);
    expect(saveCount).toBe(1);

    // Immediate flush
    saver.trigger();
    saver.flush();
    expect(saveCount).toBe(2);

    vi.useRealTimers();
  });
});
