import type { en } from './en';
import type { aboutEn } from './parts/about/en';
import type { settingsEn } from './parts/settings/en';
import type { detailsEn } from './parts/details/en';
import type { progressEn } from './parts/progress/en';
import type { homeEn } from './parts/home/en';

/**
 * A part of the dictionary that only one lazy screen uses: it is a chunk of its own, loaded with
 * that screen, so the strings of a screen do not weigh on the first load.
 */
export type DictionaryPart = 'progress' | 'home' | 'details' | 'settings' | 'about';

export const DICTIONARY_PARTS: readonly DictionaryPart[] = [
  'progress',
  'home',
  'details',
  'settings',
  'about',
];

/** Every key: the core dictionary (shell, `/`, the learning session) and the screen parts. */
export type TranslationKey =
  | keyof typeof en
  | keyof typeof progressEn
  | keyof typeof homeEn
  | keyof typeof detailsEn
  | keyof typeof settingsEn
  | keyof typeof aboutEn;
