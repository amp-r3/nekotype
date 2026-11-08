import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { isObject } from '@nekotype/shared/runtime';
import { SCHEMA_VERSION } from '../../src/shared/lib/idb/schema';

export const INPUT_FIELD = 'input[aria-label="Kana input sink"]';

/**
 * Opens the typing screen and waits until it is usable: settings load from IndexedDB, so the screen
 * can render after `load`. A test that acts at once would otherwise race the first render.
 */
export async function openTypingScreen(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('prompt-arena')).toBeVisible();
  await expect(page.locator(INPUT_FIELD)).toBeFocused();
}

type StoredSettings = {
  typing?: Record<string, unknown>;
  learn?: Record<string, unknown>;
};

const DEFAULTS = {
  typing: {
    script: 'both',
    content: 'words',
    strictness: 'learner',
    weakFocus: true,
    test: { kind: 'time', seconds: 30 },
    showTranslation: true,
  },
  learn: { strictness: 'learner', track: 'hiragana', targetMs: 1500, sound: true },
  updatedAt: 1,
};

/**
 * Writes the `settings` record to IndexedDB and reloads. The application creates the database on
 * its first load, so this opens `/`, waits for it, writes (with the current `schemaVersion`, or
 * the reset would drop the record) and reloads. A seed in localStorage would be ignored silently.
 */
export async function seedSettings(page: Page, patch: StoredSettings): Promise<void> {
  const settings = {
    ...DEFAULTS,
    typing: { ...DEFAULTS.typing, ...patch.typing },
    learn: { ...DEFAULTS.learn, ...patch.learn },
  };
  await page.goto('/');
  await page.evaluate(
    async ({ settings, schemaVersion }) => {
      const open = (): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('nekotype');
          req.onsuccess = () => {
            resolve(req.result);
          };
          req.onerror = () => {
            reject(req.error);
          };
        });
      const read = (db: IDBDatabase): Promise<unknown> =>
        new Promise((resolve, reject) => {
          const req = db.transaction('meta').objectStore('meta').get('schemaVersion');
          req.onsuccess = () => {
            resolve(req.result);
          };
          req.onerror = () => {
            reject(req.error);
          };
        });
      let db: IDBDatabase | null = null;
      for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = await open();
        if (candidate.objectStoreNames.contains('meta')) {
          if ((await read(candidate)) === schemaVersion) {
            db = candidate;
            break;
          }
        }
        candidate.close();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (db === null) throw new Error('the database was not created');
      const opened = db;
      await new Promise<void>((resolve, reject) => {
        const tx = opened.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(settings, 'current');
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error);
        };
      });
      opened.close();
    },
    { settings, schemaVersion: SCHEMA_VERSION },
  );
  await page.reload();
}

/** The stored `settings` record, or null; for a test that waits until a change has been written. */
async function readStoredSettings(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('nekotype');
        req.onerror = () => {
          resolve(null);
        };
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('settings')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction('settings').objectStore('settings').get('current');
          get.onsuccess = () => {
            db.close();
            resolve(get.result ?? null);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        };
      }),
  );
}

/** Waits until `typing.<key>` in the stored settings equals `expected`: the change is persisted. */
export async function expectStoredTyping(
  page: Page,
  key: string,
  expected: unknown,
): Promise<void> {
  await expect
    .poll(async () => {
      const stored = await readStoredSettings(page);
      if (!isObject(stored)) return undefined;
      const typing = stored['typing'];
      return isObject(typing) ? typing[key] : undefined;
    })
    .toEqual(expected);
}
