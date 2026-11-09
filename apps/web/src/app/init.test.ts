// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryKeyValueStore,
  STORAGE_KEYS,
  databaseMode,
  navigate,
  startRouter,
} from '@/shared/lib';
import { initLocale, locale, setLocale } from '@/shared/i18n';
import { settingsReady } from '@/entities/settings';
import { initApp } from './init';

describe('app/init', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en';
  });

  it('setLocale persists and sets the lang attribute (in app/init)', async () => {
    const store = new MemoryKeyValueStore();
    await initLocale(store);
    await initApp();

    expect(document.documentElement.lang).toBe('en');

    await setLocale('ru', store);
    expect(locale.value).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(store.get(STORAGE_KEYS.LOCALE)).toBe('ru');

    // Setting back to en
    await setLocale('en', store);
    expect(locale.value).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(store.get(STORAGE_KEYS.LOCALE)).toBe('en');
  });

  it('the tab title follows the screen and the language', async () => {
    const store = new MemoryKeyValueStore();
    window.history.replaceState(null, '', '/');
    const stop = startRouter();
    await initLocale(store);
    await setLocale('en', store);
    await initApp();

    expect(document.title).toBe('Nekotype');
    navigate('/stats');
    expect(document.title).toBe('Stats — Nekotype');
    await setLocale('ru', store);
    expect(document.title).toBe('Статистика — Nekotype');
    navigate('/nowhere');
    expect(document.title).toBe('Nekotype');

    await setLocale('en', store);
    stop();
  });

  it('keeps the legacy keys and still loads the settings when IndexedDB is unavailable', async () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, '{"v":1}');
    await initApp();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(databaseMode.value).toBe('memory');
    expect(settingsReady.value).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.SETTINGS)).toBe('{"v":1}');
    localStorage.clear();
  });
});
