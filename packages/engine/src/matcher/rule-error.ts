import { kanaTexts, type GlyphIndex } from './compile';
import { errorTarget } from './observe';
import { isInProgress, pendingToken, textOf } from './step';
import type { Matcher, MatchState } from './types';

// Whether `ch`, a key that step() rejected in `s`, is an error of the rule of っ or ー and not of a
// kana (spec "Rule errors"). On a merged っX it is one when the letters typed of the token plus `ch`
// begin a spelling of X: the learner typed X without the doubling.
export function ruleError(index: GlyphIndex, m: Matcher, s: MatchState, ch: string): boolean {
  const target = errorTarget(m, s);
  const token = m.tokens[target];
  if (token === undefined) return false;
  if (token.kind === 'sokuon' || token.kind === 'choonpu') return true;
  // Only a merged っX is left to check: it carries the key of X.
  const info = token.sokuon && token.kanaKey !== null ? index.byKey.get(token.kanaKey) : undefined;
  if (info === undefined) return false;
  const spellings = kanaTexts(info, m.strictness);
  const key = ch.toLowerCase();
  return s.positions.some((pos) => {
    // On the token, or done with the one before and waiting for its first key.
    if (pendingToken(m, pos) !== target) return false;
    const begun = isInProgress(m, pos) ? (textOf(m, pos) ?? '').slice(0, pos.offset) : '';
    const typed = begun + key;
    return spellings.some((text) => text.startsWith(typed));
  });
}
