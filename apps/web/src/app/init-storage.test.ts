// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { STORAGE_KEYS, databaseMode, getDatabase } from '@/shared/lib';
import { settingsReady } from '@/entities/settings';
import { initApp } from './init';

describe('app/init with IndexedDB available', () => {
  it('loads the settings and deletes kanaflow:settings:v1 and kanaflow:progress:v1 unread, keeping the locale', async () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, '{"v":1}');
    localStorage.setItem('kanaflow:progress:v1', '{"v":1,"stats":{}}');
    localStorage.setItem(STORAGE_KEYS.LOCALE, 'en');

    await initApp();
    await getDatabase();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(databaseMode.value).toBe('indexeddb');
    expect(settingsReady.value).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.SETTINGS)).toBeNull();
    expect(localStorage.getItem('kanaflow:progress:v1')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.LOCALE)).toBe('en');
  });
});
