import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SCHEMA_VERSION } from '../../src/shared/lib/idb/schema';

/** Writes the learning state (`delta/learn`) the same way, on `path`, and reloads. */
export async function seedLearning(
  page: Page,
  path: string,
  learn: Record<string, unknown>,
): Promise<void> {
  await page.goto(path);
  await putRecord(page, 'delta', 'learn', {
    learn,
    counters: { started: { typing: 0, learn: 0 }, finished: { typing: 0, learn: 0 } },
  });
  await page.reload();
}

async function putRecord(page: Page, store: string, key: string, value: unknown): Promise<void> {
  await page.evaluate(
    async ({ store, key, value, schemaVersion }) => {
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
        const tx = opened.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error);
        };
      });
      opened.close();
    },
    { store, key, value, schemaVersion: SCHEMA_VERSION },
  );
}
