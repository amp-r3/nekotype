export type Section = 'learning' | 'typing';

/** The section named by a URL hash (`#typing`, with or without the `#`); `null` for anything else. */
export function parseSection(hash: string): Section | null {
  const name = hash.startsWith('#') ? hash.slice(1) : hash;
  return name === 'learning' || name === 'typing' ? name : null;
}

/**
 * The section shown when the screen opens (S10): a valid hash wins; otherwise the section that
 * has data, learning when both have it or neither does.
 */
export function initialSection(
  hash: string,
  has: { readonly learning: boolean; readonly typing: boolean },
): Section {
  return parseSection(hash) ?? (!has.learning && has.typing ? 'typing' : 'learning');
}
