// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { STORAGE_KEYS, databaseMode, getDatabase } from '@/shared/lib';
import { settingsReady } from '@/entities/settings';
import { initApp } from './init';

describe('app/init with IndexedDB available', () => {
  it('loads the settings and deletes kanaflow:settings:v1 unread, keeping the other keys', async () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, '{"v":1}');
    localStorage.setItem(STORAGE_KEYS.PROGRESS, '{"v":1,"stats":{}}');
    localStorage.setItem(STORAGE_KEYS.LOCALE, 'en');

    await initApp();
    await getDatabase();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(databaseMode.value).toBe('indexeddb');
    expect(settingsReady.value).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.SETTINGS)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.PROGRESS)).toBe('{"v":1,"stats":{}}');
    expect(localStorage.getItem(STORAGE_KEYS.LOCALE)).toBe('en');
  });
});
