export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private data = new Map<string, string>();

  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

export class LocalStorageStore implements KeyValueStore {
  get(key: string): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore quota or security errors in private browsing
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  }
}

export const STORAGE_KEYS = {
  SETTINGS: 'kanaflow:settings:v1',
  LOCALE: 'nekotype:locale',
} as const;

/**
 * Keys that earlier versions wrote and the code no longer uses (ADR 061). `kanaflow:settings:v1`
 * joins in P3 when settings move to IndexedDB, `kanaflow:progress:v1` in P4 when typing statistics do.
 */
export const LEGACY_KEYS: readonly string[] = [STORAGE_KEYS.SETTINGS, 'kanaflow:progress:v1'];

/** Deletes the legacy keys without reading them. Called once IndexedDB has opened. */
export function removeLegacyKeys(
  store: KeyValueStore,
  keys: readonly string[] = LEGACY_KEYS,
): void {
  for (const key of keys) {
    store.remove(key);
  }
}
