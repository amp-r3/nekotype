import { describe, it, expect, vi } from 'vitest';
import { locale, setLocale } from './index';
import type * as I18n from './index';
import { ru } from './ru';
import { statsEn } from './parts/stats/en';
import { settingsRu } from './parts/settings/ru';
import { typeRu } from './parts/type/ru';
import { aboutEn } from './parts/about/en';
import { aboutRu } from './parts/about/ru';
import { MemoryKeyValueStore, STORAGE_KEYS } from '@/shared/lib';

// The Russian dictionary is not loaded yet in this file: a switch to it waits for its chunk.
describe('locale: switching while a dictionary loads', () => {
  it('the last choice wins: a dictionary that arrives late does not switch the language back', async () => {
    const store = new MemoryKeyValueStore();
    const toRussian = setLocale('ru', store);
    const toEnglish = setLocale('en', store);
    await Promise.all([toRussian, toEnglish]);

    expect(locale.value).toBe('en');
    expect(store.get(STORAGE_KEYS.LOCALE)).toBe('en');
    // The superseded switch reports that it did not happen.
    expect(await toRussian).toBe(false);
  });
});

// Each test takes a fresh copy of the module: no part of the dictionary is loaded yet.
async function freshI18n(): Promise<typeof I18n> {
  vi.resetModules();
  return import('./index');
}

describe('locale: the parts of the dictionary that belong to one screen', () => {
  it('a part is missing until its screen asks for it, and `t` falls back to the key', async () => {
    const i18n = await freshI18n();
    expect(i18n.t('stats.learn.title')).toBe('stats.learn.title');

    await i18n.loadDictionaryPart('stats');
    expect(i18n.t('stats.learn.title')).toBe(statsEn['stats.learn.title']);
  });

  it('a language switch brings every part asked for so far', async () => {
    const i18n = await freshI18n();
    await i18n.loadDictionaryPart('settings');

    expect(await i18n.setLocale('ru', new MemoryKeyValueStore())).toBe(true);
    expect(i18n.t('settings.learn.title')).toBe(settingsRu['settings.learn.title']);
    expect(i18n.t('app.language')).toBe(ru['app.language']);
  });

  it('a part asked for while a switch loads ends in the new language', async () => {
    const i18n = await freshI18n();
    const toRussian = i18n.setLocale('ru', new MemoryKeyValueStore());
    const part = i18n.loadDictionaryPart('type');
    await Promise.all([toRussian, part]);

    expect(i18n.locale.value).toBe('ru');
    expect(i18n.t('results.wpm')).toBe(typeRu['results.wpm']);
  });

  it('a part loaded in Russian is loaded again in English after a switch back', async () => {
    const i18n = await freshI18n();
    await i18n.setLocale('ru', new MemoryKeyValueStore());
    await i18n.loadDictionaryPart('about');
    expect(i18n.t('page.stub')).toBe(aboutRu['page.stub']);

    await i18n.setLocale('en', new MemoryKeyValueStore());
    expect(i18n.t('page.stub')).toBe(aboutEn['page.stub']);
  });
});
