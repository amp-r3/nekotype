export type { DictionaryPart, TranslationKey } from './keys';
export { en } from './en';

export type { Locale } from './locale';
export { locale, initLocale, setLocale, preloadLocale, loadDictionaryPart } from './locale';

export type { PluralKey, TranslationPart } from './translate';
export { pluralForm, t, tParts, tPlural, tPluralParts } from './translate';
