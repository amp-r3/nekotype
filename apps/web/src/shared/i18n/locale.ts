import type { ReadonlySignal } from '@preact/signals';
import { batch, signal } from '@preact/signals';
import type { KeyValueStore } from '@/shared/lib';
import { STORAGE_KEYS } from '@/shared/lib';
import type { Dictionary } from './dictionary';
import { assemble, loadWords } from './dictionary';
import { en } from './en';
import type { DictionaryPart } from './keys';
import { DICTIONARY_PARTS } from './keys';

export type Locale = 'en' | 'ru';

function detectLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('ru')) {
      return 'ru';
    }
  }
  return 'en';
}

// The language and its dictionary change together, and only once the dictionary is there: the
// interface is never shown in a language whose strings have not arrived.
const _locale = signal<Locale>('en');
const _dictionary = signal<Dictionary>(en);
export const locale: ReadonlySignal<Locale> = _locale;
export const dictionary: ReadonlySignal<Dictionary> = _dictionary;

// The store bound at startup, so components change the language without touching storage.
let boundStore: KeyValueStore | undefined;

function apply(newLocale: Locale, words: Dictionary): void {
  batch(() => {
    _dictionary.value = words;
    _locale.value = newLocale;
  });
}

// The screen parts asked for so far: a language switch brings them along.
const wantedParts = new Set<DictionaryPart>();

// Numbers the switches, so a dictionary that arrives after a later choice does not undo it.
let latestSwitch = 0;

/**
 * Switches to a language once its dictionary is loaded: the core and every part a screen has asked
 * for. False if it could not be loaded, or if another switch was asked for in the meantime: the
 * last choice wins.
 */
async function switchTo(newLocale: Locale): Promise<boolean> {
  latestSwitch += 1;
  const request = latestSwitch;
  try {
    // A screen may ask for its part while the core loads; the loop brings that part too.
    for (;;) {
      const ready = assemble(newLocale, wantedParts);
      if (ready !== undefined) {
        apply(newLocale, ready);
        return true;
      }
      const pieces: readonly ('core' | DictionaryPart)[] = ['core', ...wantedParts];
      await Promise.all(pieces.map((piece) => loadWords(newLocale, piece)));
      if (request !== latestSwitch) return false;
    }
  } catch {
    return false;
  }
}

/**
 * Binds the store and applies the saved language, or the browser's. Resolves when the dictionary is
 * in; if it cannot be loaded the interface stays in English and the saved choice is kept.
 */
export async function initLocale(store: KeyValueStore): Promise<void> {
  boundStore = store;
  const persisted = store.get(STORAGE_KEYS.LOCALE);
  await switchTo(persisted === 'en' || persisted === 'ru' ? persisted : detectLocale());
}

/** Changes the language after loading its dictionary; the choice is saved only then. */
export async function setLocale(
  newLocale: Locale,
  store: KeyValueStore | undefined = boundStore,
): Promise<boolean> {
  const switched = await switchTo(newLocale);
  if (switched && store) {
    store.set(STORAGE_KEYS.LOCALE, newLocale);
  }
  return switched;
}

/**
 * Loads the part of a screen in the current language and adds it to the dictionary. Rejects if it
 * could not be loaded, so the screen reports the error; a later call tries again.
 */
export async function loadDictionaryPart(part: DictionaryPart): Promise<void> {
  for (;;) {
    const current = _locale.value;
    await loadWords(current, part);
    // A switch that started earlier did not know about this part: the loop loads it again.
    if (_locale.value !== current) continue;
    wantedParts.add(part);
    const words = assemble(current, wantedParts);
    if (words !== undefined) apply(current, words);
    return;
  }
}

/**
 * Fetches a whole dictionary (the core and every screen part) ahead of time, so the language can
 * be switched and every screen opened without the network.
 */
export function preloadLocale(wanted: Locale): Promise<unknown> {
  return Promise.all([
    loadWords(wanted, 'core'),
    ...DICTIONARY_PARTS.map((part) => loadWords(wanted, part)),
  ]);
}
