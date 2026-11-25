import { describe, it, expect, vi } from 'vitest';
import { MemoryKeyValueStore, LocalStorageStore, isSettings } from './index';

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
      learn: { strictness: 'learner', track: 'hiragana', sound: true },
      updatedAt: 0,
    };
    expect(isSettings(valid)).toBe(true);

    // The `typing` block of P5 is not valid any more.
    expect(isSettings({ ...valid, typing: { script: 'both' } })).toBe(false);
    expect(isSettings({ ...valid, learn: { ...valid.learn, track: 'klingon' } })).toBe(false);
    expect(isSettings('not an object')).toBe(false);
    expect(isSettings(null)).toBe(false);
  });
});
