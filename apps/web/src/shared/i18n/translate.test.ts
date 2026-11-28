import { describe, it, expect } from 'vitest';
import { en, t, locale, setLocale, initLocale } from './index';
import { ru } from './ru';
import { progressEn } from './parts/progress/en';
import { progressRu } from './parts/progress/ru';
import { homeEn } from './parts/home/en';
import { homeRu } from './parts/home/ru';
import { sessionEn } from './parts/session/en';
import { sessionRu } from './parts/session/ru';
import { detailsEn } from './parts/details/en';
import { detailsRu } from './parts/details/ru';
import { settingsEn } from './parts/settings/en';
import { settingsRu } from './parts/settings/ru';
import { aboutEn } from './parts/about/en';
import { aboutRu } from './parts/about/ru';
import { MemoryKeyValueStore, STORAGE_KEYS } from '@/shared/lib';

// Compile-time verification: ru satisfies Record<keyof typeof en, string>
type _RuEnCompileTimeParity = typeof ru extends Record<keyof typeof en, string> ? true : false;
type _AssertParity<T extends true> = T;
export type _CheckedRuEnParity = _AssertParity<_RuEnCompileTimeParity>;

const PIECES: readonly (readonly [string, Record<string, string>, Record<string, string>])[] = [
  ['core', en, ru],
  ['progress', progressEn, progressRu],
  ['home', homeEn, homeRu],
  ['details', detailsEn, detailsRu],
  ['settings', settingsEn, settingsRu],
  ['about', aboutEn, aboutRu],
];

describe('i18n: translations and locale handling', () => {
  // Apart from `PIECES`: the part holds no string until the screens of P9 add theirs.
  it('has exact runtime key parity between en and ru: session', () => {
    expect(Object.keys(sessionRu).sort()).toEqual(Object.keys(sessionEn).sort());
  });

  it.each(PIECES)(
    'has exact runtime key parity between en and ru: %s',
    (_name, english, russian) => {
      const enKeys = Object.keys(english).sort();
      expect(Object.keys(russian).sort()).toEqual(enKeys);
      expect(enKeys.length).toBeGreaterThan(0);
      for (const val of [...Object.values(english), ...Object.values(russian)]) {
        expect(val.length).toBeGreaterThan(0);
      }
    },
  );

  it('puts every key in exactly one piece of the dictionary', () => {
    const keys = PIECES.flatMap(([, english]) => Object.keys(english));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('translates strings for active locale with parameter interpolation', async () => {
    await setLocale('en');
    expect(t('app.title')).toBe('Nekotype');
    expect(t('learn.reason.new', { row: 'the m row' })).toBe('next: the m row');

    await setLocale('ru');
    expect(t('app.title')).toBe('Nekotype');
    expect(t('learn.reason.new', { row: 'ряд m' })).toBe('дальше: ряд m');

    // Reset back to en
    await setLocale('en');
  });

  it('setLocale without a store persists to the store bound by initLocale', async () => {
    const store = new MemoryKeyValueStore();
    await initLocale(store);
    await setLocale('ru');
    expect(store.get(STORAGE_KEYS.LOCALE)).toBe('ru');
    await setLocale('en');
    expect(store.get(STORAGE_KEYS.LOCALE)).toBe('en');
  });

  it('setLocale persists locale to store and updates locale signal', async () => {
    const store = new MemoryKeyValueStore();
    await setLocale('ru', store);
    expect(store.get('nekotype:locale')).toBe('ru');
    expect(locale.value).toBe('ru');

    await setLocale('en', store);
    expect(store.get('nekotype:locale')).toBe('en');
    expect(locale.value).toBe('en');
  });
});
