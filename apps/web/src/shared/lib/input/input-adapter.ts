/** What the session takes from the keyboard. */
export type KeyIntent =
  | { readonly kind: 'char'; readonly char: string }
  | { readonly kind: 'reveal' }
  // Ctrl/Cmd+Enter: end a zen test by hand. A session that has no such test ignores it.
  | { readonly kind: 'finish' }
  | { readonly kind: 'ignore' };

/**
 * What a key or a piece of text means to the input source: a `KeyIntent`, or one of two kinds of
 * character that are not input. `foreign` is a letter outside the Latin alphabet (a Cyrillic
 * layout, say) and asks the user to switch the layout (spec D15). `japanese` is kana or kanji, which
 * only a Japanese IME produces, and asks the user to turn it off. Neither is an error and neither
 * reaches the session.
 */
export type InputClass = KeyIntent | { readonly kind: 'foreign' } | { readonly kind: 'japanese' };

export type KeyDownEventLike = Pick<
  KeyboardEvent,
  'key' | 'isComposing' | 'ctrlKey' | 'metaKey' | 'altKey'
>;

const ASCII_LETTER = /^[A-Za-z]$/;
const LETTER = /^\p{L}$/u;

// Typographic apostrophes that a mobile keyboard may substitute for the one n' needs.
const APOSTROPHES = new Set(["'", '’', '‘']);

/** One character typed or inserted: a Latin letter, `-` or `'` is input, any other letter is foreign. */
export function classifyChar(char: string): InputClass {
  // The test is on the character itself: lower-casing first would let `İ` or the Kelvin sign in.
  if (ASCII_LETTER.test(char)) {
    return { kind: 'char', char: char.toLowerCase() };
  }
  if (char === '-') {
    return { kind: 'char', char };
  }
  if (APOSTROPHES.has(char)) {
    return { kind: 'char', char: "'" };
  }
  if (isJapaneseText(char)) {
    return { kind: 'japanese' };
  }
  return LETTER.test(char) ? { kind: 'foreign' } : { kind: 'ignore' };
}

/**
 * A keydown. Keys of mobile keyboards (`Unidentified`) and of an active IME (`Process`) say nothing
 * about the character: it arrives through `beforeinput` or `input`, so they are skipped here. The
 * physical key (`event.code`) is not used: a Cyrillic layout is asked to switch, not translated.
 */
export function classifyKeyDown(event: KeyDownEventLike): InputClass {
  if (event.isComposing) {
    return { kind: 'ignore' };
  }
  // The one modifier combination that is ours; every other one belongs to the browser.
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'Enter') {
    return { kind: 'finish' };
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return { kind: 'ignore' };
  }
  if (event.key === 'Escape') {
    return { kind: 'reveal' };
  }
  if (event.key === 'Unidentified' || event.key === 'Process') {
    return { kind: 'ignore' };
  }
  return Array.from(event.key).length === 1 ? classifyChar(event.key) : { kind: 'ignore' };
}

// Hiragana, katakana (and half-width katakana), CJK ideographs: what a Japanese IME composes.
const JAPANESE_TEXT = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/u;

/** True when composition data holds kana or kanji; Latin composition (Gboard) does not. */
export function isJapaneseText(text: string): boolean {
  return JAPANESE_TEXT.test(text);
}
