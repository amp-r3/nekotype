import type { StreamToken } from '../model/stream';

// Where a long prompt may break (ADR 060). A group is what is read as one unit and so is never
// split: the engine already makes a yōon (`きょ`) and `っ` with the kana after it one token, so what
// is left to join are the tokens that cling to a neighbour. A closing mark and `ー` stay with the
// token before them; an opening bracket and a `っ` with no kana after it stay with the token after.

const OPENING = new Set([
  '「',
  '『',
  '（',
  '(',
  '［',
  '[',
  '【',
  '〈',
  '《',
  '“',
  '‘',
  '〔',
  '｛',
  '{',
]);

function clingsForward(token: StreamToken): boolean {
  return OPENING.has(token.glyph) || token.glyph === 'っ' || token.glyph === 'ッ';
}

function clingsBack(token: StreamToken): boolean {
  if (token.glyph === 'ー') return true;
  // Punctuation and brackets that need no input, except a space, which is where a line may end.
  return token.skip && token.glyph.trim() !== '' && !OPENING.has(token.glyph);
}

/** The tokens of a prompt in groups that a line never breaks inside. */
export function groupTokens(tokens: readonly StreamToken[]): StreamToken[][] {
  const groups: StreamToken[][] = [];
  let joinNext = false;
  for (const token of tokens) {
    const last = groups.at(-1);
    if (last !== undefined && (joinNext || clingsBack(token))) last.push(token);
    else groups.push([token]);
    joinNext = clingsForward(token);
  }
  return groups;
}
