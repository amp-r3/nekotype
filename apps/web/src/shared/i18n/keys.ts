import type { en } from './en';
import type { aboutEn } from './parts/about/en';
import type { settingsEn } from './parts/settings/en';
import type { statsEn } from './parts/stats/en';

/**
 * A part of the dictionary that only one lazy screen uses: it is a chunk of its own, loaded with
 * that screen, so the strings of a screen do not weigh on the first load.
 */
export type DictionaryPart = 'stats' | 'settings' | 'about';

export const DICTIONARY_PARTS: readonly DictionaryPart[] = ['stats', 'settings', 'about'];

/** Every key: the core dictionary (shell, `/`, the learning session) and the screen parts. */
export type TranslationKey =
  keyof typeof en | keyof typeof statsEn | keyof typeof settingsEn | keyof typeof aboutEn;
