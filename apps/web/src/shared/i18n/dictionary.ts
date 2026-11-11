import type { Locale } from './locale';
import type { DictionaryPart, TranslationKey } from './keys';
import { en } from './en';

/**
 * The strings in hand. A screen part is missing until its screen has asked for it; the routes do
 * not show a screen before then, and `t` falls back to the key.
 */
export type Dictionary = Readonly<Partial<Record<TranslationKey, string>>>;

type Words = Readonly<Partial<Record<TranslationKey, string>>>;
type Piece = 'core' | DictionaryPart;

// The English core is in the initial chunk; everything else is a chunk of its own, fetched when it
// is wanted.
const LOADERS: Readonly<Record<Locale, Readonly<Record<Piece, () => Promise<Words>>>>> = {
  en: {
    core: () => Promise.resolve(en),
    type: () => import('./parts/type/en').then((module) => module.typeEn),
    stats: () => import('./parts/stats/en').then((module) => module.statsEn),
    settings: () => import('./parts/settings/en').then((module) => module.settingsEn),
    about: () => import('./parts/about/en').then((module) => module.aboutEn),
  },
  ru: {
    core: () => import('./ru').then((module) => module.ru),
    type: () => import('./parts/type/ru').then((module) => module.typeRu),
    stats: () => import('./parts/stats/ru').then((module) => module.statsRu),
    settings: () => import('./parts/settings/ru').then((module) => module.settingsRu),
    about: () => import('./parts/about/ru').then((module) => module.aboutRu),
  },
};

const id = (locale: Locale, piece: Piece): string => `${locale}:${piece}`;
const loaded = new Map<string, Words>([[id('en', 'core'), en]]);
const inflight = new Map<string, Promise<Words>>();

/** The piece of a dictionary, if it has been loaded already. */
export function loadedWords(locale: Locale, piece: Piece): Words | undefined {
  return loaded.get(id(locale, piece));
}

/** Loads a piece of a dictionary once. A failure rejects, and a later call tries again. */
export function loadWords(locale: Locale, piece: Piece): Promise<Words> {
  const key = id(locale, piece);
  const ready = loaded.get(key);
  if (ready !== undefined) return Promise.resolve(ready);
  const pending = inflight.get(key);
  if (pending !== undefined) return pending;

  const request = LOADERS[locale][piece]()
    .then((words) => {
      loaded.set(key, words);
      return words;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** The core of a language and the given parts, as one dictionary; undefined if a piece is missing. */
export function assemble(locale: Locale, parts: Iterable<DictionaryPart>): Dictionary | undefined {
  const core = loadedWords(locale, 'core');
  if (core === undefined) return undefined;
  let words: Dictionary = core;
  for (const part of parts) {
    const piece = loadedWords(locale, part);
    if (piece === undefined) return undefined;
    words = { ...words, ...piece };
  }
  return words;
}
