import { dictionary, locale } from './locale';
import type { TranslationKey } from './en';

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let str: string = dictionary.value[key];

  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
    }
  }

  return str;
}

/** A piece of a translated string: the text around the parameters, or the value of one parameter. */
export type TranslationPart = { readonly text: string; readonly param: boolean };

/**
 * The same string as `t`, in pieces, so a screen can set the values apart (`mastered `, `7`,
 * ` of `, `104` — the numbers in a font of their own). A placeholder without a parameter stays as
 * text.
 */
export function tParts(
  key: TranslationKey,
  params: Record<string, string | number> = {},
): readonly TranslationPart[] {
  const str: string = dictionary.value[key];
  const parts: TranslationPart[] = [];
  let from = 0;
  for (const match of str.matchAll(/\{(\w+)\}/g)) {
    const name = match[1];
    const value = name === undefined ? undefined : params[name];
    if (value === undefined) continue;
    if (match.index > from) parts.push({ text: str.slice(from, match.index), param: false });
    parts.push({ text: String(value), param: true });
    from = match.index + match[0].length;
  }
  if (from < str.length) parts.push({ text: str.slice(from), param: false });
  return parts;
}

/** The keys that come in the plural forms `<key>.one`, `.few`, `.many` and `.other`. */
export type PluralKey = TranslationKey extends infer K
  ? K extends `${infer Base}.other`
    ? Base
    : never
  : never;

/** The plural form of the language for `count`, as the suffix of a key; `zero` and `two` are `other`. */
export function pluralForm(count: number): 'one' | 'few' | 'many' | 'other' {
  const category = new Intl.PluralRules(locale.value).select(count);
  return category === 'one' || category === 'few' || category === 'many' ? category : 'other';
}

/**
 * A string with plural forms (`learn.streak.one`, `.few`, `.many`, `.other`): the form for `count`,
 * in pieces. `count` is passed to the string as `{count}`; `params` adds the rest.
 */
export function tPluralParts(
  key: PluralKey,
  count: number,
  params: Record<string, string | number> = {},
): readonly TranslationPart[] {
  return tParts(`${key}.${pluralForm(count)}`, { count, ...params });
}

/** `tPluralParts` as one string. */
export function tPlural(
  key: PluralKey,
  count: number,
  params: Record<string, string | number> = {},
): string {
  return tPluralParts(key, count, params)
    .map((part) => part.text)
    .join('');
}
