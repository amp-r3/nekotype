import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LOG_PAGE_EVENTS, encodePage } from '@nekotype/shared/runtime';
import type { EventDraft } from '@nekotype/shared/types';
import { SCHEMA_VERSION } from '../../src/shared/lib/idb/schema';

/** The log device id of the seeded log: a UUID, as the app creates it. */
const SEED_DEV = '018f0000-0000-7000-8000-0000000000e2';

const pad = (n: number): string => String(n).padStart(12, '0');

/**
 * Writes the learning log (`log` pages and `meta/log`, P7 plan D16) as one device would have, on
 * `path`, and reloads. `events` are in order; they get the identity `(SEED_DEV, 1, 2, 3, …)`.
 */
export async function seedLog(
  page: Page,
  path: string,
  events: readonly EventDraft[],
): Promise<void> {
  await page.goto(path);
  const numbered = events.map((event, index) => ({ ...event, dev: SEED_DEV, n: index + 1 }));
  for (let first = 0; first < numbered.length; first += LOG_PAGE_EVENTS) {
    const chunk = numbered.slice(first, first + LOG_PAGE_EVENTS);
    const closed = chunk.length === LOG_PAGE_EVENTS;
    await putRecord(page, 'log', closed ? `own:${pad(first + 1)}` : 'own:open', encodePage(chunk));
  }
  const last = numbered.at(-1);
  await putRecord(page, 'meta', 'log', {
    dev: SEED_DEV,
    next: numbered.length + 1,
    lastAt: last?.at ?? 0,
  });
  await page.reload();
}

/** Writes the `learn.track` setting (the other settings are the defaults) and reloads. */
export async function seedTrack(page: Page, track: 'hiragana' | 'katakana'): Promise<void> {
  await putRecord(page, 'settings', 'current', {
    learn: { strictness: 'learner', track, sound: true },
    updatedAt: 1,
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
