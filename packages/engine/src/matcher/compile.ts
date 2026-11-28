import type { KanaKey, PromptItem, Script, Strictness } from '../types';
import { SKIP_CHARACTERS, SOKUON_PREFIXES } from '../data/tokens';
import type { Spelling, Matcher, Token, TokenKind } from './types';

type GlyphInfo = {
  readonly kanaKey: KanaKey;
  readonly ime: readonly string[];
  readonly learner: readonly string[];
};

export type GlyphIndex = {
  readonly glyphs: ReadonlyMap<string, GlyphInfo>;
  readonly byKey: ReadonlyMap<KanaKey, GlyphInfo>;
  readonly maxLength: number;
};

type Draft = {
  readonly glyph: string;
  readonly kanaKey: KanaKey | null;
  readonly kind: TokenKind;
  readonly sokuon: boolean;
  readonly promptIndex: number;
  texts: string[];
};

type Raw =
  | {
      readonly kind: 'kana';
      readonly glyph: string;
      readonly info: GlyphInfo;
      // Preceded by a っ that is merged into this token.
      readonly sokuon: boolean;
    }
  | { readonly kind: 'n'; readonly glyph: string; readonly kanaKey: KanaKey }
  | { readonly kind: 'sokuon' | 'choonpu' | 'skip'; readonly glyph: string };

const VOWELS = 'aiueo';
// Latin consonants a single n may precede, and a sokuon may double: all but n and y.
const CONSONANTS = 'bcdfghjklmpqrstvwxz';

export function buildGlyphIndex(
  table: readonly {
    readonly entries: readonly {
      readonly hiragana?: string;
      readonly katakana: string;
      readonly ime: readonly string[];
      readonly learner: readonly string[];
    }[];
  }[],
): GlyphIndex {
  const glyphs = new Map<string, GlyphInfo>();
  const byKey = new Map<KanaKey, GlyphInfo>();
  let maxLength = 1;
  for (const row of table) {
    for (const e of row.entries) {
      if (e.hiragana !== undefined) {
        const info: GlyphInfo = {
          kanaKey: `hiragana:${e.hiragana}`,
          ime: e.ime,
          learner: e.learner,
        };
        glyphs.set(e.hiragana, info);
        byKey.set(info.kanaKey, info);
        maxLength = Math.max(maxLength, e.hiragana.length);
      }
      const info: GlyphInfo = { kanaKey: `katakana:${e.katakana}`, ime: e.ime, learner: e.learner };
      glyphs.set(e.katakana, info);
      byKey.set(info.kanaKey, info);
      maxLength = Math.max(maxLength, e.katakana.length);
    }
  }
  return { glyphs, byKey, maxLength };
}

function isSokuon(ch: string): boolean {
  return ch === 'っ' || ch === 'ッ';
}

function isN(ch: string): boolean {
  return ch === 'ん' || ch === 'ン';
}

// A character that is a token of its own and so never merges into a preceding っ.
function isSpecial(ch: string): boolean {
  return isSokuon(ch) || isN(ch) || ch === 'ー' || SKIP_CHARACTERS.has(ch);
}

function matchKana(
  index: GlyphIndex,
  text: string,
  from: number,
): { glyph: string; info: GlyphInfo } | null {
  for (let len = Math.min(index.maxLength, text.length - from); len >= 1; len--) {
    const glyph = text.slice(from, from + len);
    const info = index.glyphs.get(glyph);
    if (info !== undefined) return { glyph, info };
  }
  return null;
}

function tokenize(index: GlyphIndex, text: string): Raw[] {
  const out: Raw[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (isSokuon(ch)) {
      // っ merges into the kana that follows it (D22), but not across ん, ー, another っ or a skip.
      const next = text.charAt(i + 1);
      const hit = isSpecial(next) ? null : matchKana(index, text, i + 1);
      if (hit === null) {
        out.push({ kind: 'sokuon', glyph: ch });
        i += 1;
      } else {
        out.push({ kind: 'kana', glyph: ch + hit.glyph, info: hit.info, sokuon: true });
        i += 1 + hit.glyph.length;
      }
    } else if (ch === 'ー') {
      out.push({ kind: 'choonpu', glyph: ch });
      i += 1;
    } else if (isN(ch)) {
      const script: Script = ch === 'ん' ? 'hiragana' : 'katakana';
      out.push({ kind: 'n', glyph: ch, kanaKey: `${script}:${ch}` });
      i += 1;
    } else if (SKIP_CHARACTERS.has(ch)) {
      out.push({ kind: 'skip', glyph: ch });
      i += 1;
    } else {
      const hit = matchKana(index, text, i);
      if (hit === null) {
        throw new Error(`Unrepresentable character in prompt: "${ch}" at index ${i} in "${text}"`);
      }
      out.push({ kind: 'kana', glyph: hit.glyph, info: hit.info, sokuon: false });
      i += hit.glyph.length;
    }
  }
  return out;
}

function unique(texts: readonly string[]): string[] {
  return Array.from(new Set(texts));
}

export function kanaTexts(info: GlyphInfo, strictness: Strictness): string[] {
  return unique(strictness === 'ime' ? info.ime : [...info.ime, ...info.learner]);
}

// っ + kana (D22): the first letter of each spelling is doubled (ch gives tch and cch), and the
// xtu/ltu/xtsu/ltsu prefix is accepted before any spelling.
function sokuonTexts(next: readonly string[]): string[] {
  const doubled: string[] = [];
  for (const t of next) {
    if (t.startsWith('ch')) {
      doubled.push(`t${t}`, `c${t}`);
    } else {
      const c = t.charAt(0);
      if (c !== '' && CONSONANTS.includes(c)) doubled.push(`${c}${t}`);
    }
  }
  const prefixed: string[] = [];
  for (const p of SOKUON_PREFIXES) {
    for (const t of next) prefixed.push(`${p}${t}`);
  }
  return unique([...doubled, ...prefixed]);
}

// ー: '-' always; relaxed also the final vowel of the nearest kana token to the left (through ー).
function choonpuTexts(
  drafts: readonly Draft[],
  promptStart: number,
  strictness: Strictness,
): string[] {
  const texts = ['-'];
  if (strictness === 'ime') return texts;
  let j = drafts.length - 1;
  while (j >= promptStart && drafts[j]?.kind === 'choonpu') j--;
  const prev = j >= promptStart ? drafts[j] : undefined;
  if (prev?.kind === 'kana') {
    for (const t of prev.texts) {
      const last = t.charAt(t.length - 1);
      if (VOWELS.includes(last)) texts.push(last);
    }
  }
  return unique(texts);
}

function canFollowBareN(text: string, strictness: Strictness): boolean {
  const c = text.charAt(0);
  if (c !== '' && CONSONANTS.includes(c)) return true;
  return strictness === 'learner' && c === 'n';
}

// The bare-n spelling of ん as seen from the token that follows it: the indices of the following
// spellings it may precede, or null when anything may follow (end of the stream or a skip token).
function bareNext(
  promptIndex: number,
  next: Token | undefined,
  strictness: Strictness,
): readonly number[] | null {
  if (next === undefined || next.kind === 'skip') return null;
  const boundary = next.promptIndex !== promptIndex;
  const permitted: number[] = [];
  next.spellings.forEach((sp, k) => {
    if ((boundary && strictness === 'learner') || canFollowBareN(sp.text, strictness)) {
      permitted.push(k);
    }
  });
  return permitted;
}

export function compileStream(
  index: GlyphIndex,
  prompts: readonly PromptItem[],
  strictness: Strictness,
): Matcher {
  return appendPrompts(index, { tokens: [], promptStarts: [], strictness }, prompts);
}

// Appends prompts to the end of the stream. Existing token and spelling indices do not change, so
// a state made for `m` stays valid: only the bare n of a trailing ん is re-resolved, because the
// context it was waiting for has now arrived. Its spelling keeps its index and may end up with an
// empty set of permitted next spellings.
export function appendPrompts(
  index: GlyphIndex,
  m: Matcher,
  prompts: readonly PromptItem[],
): Matcher {
  if (prompts.length === 0) return m;
  const strictness = m.strictness;
  const firstPrompt = m.promptStarts.length;
  const baseToken = m.tokens.length;
  const drafts: Draft[] = [];
  const promptStarts: number[] = [];

  prompts.forEach((prompt, i) => {
    const promptIndex = firstPrompt + i;
    const start = drafts.length;
    promptStarts.push(baseToken + start);

    for (const raw of tokenize(index, prompt.text)) {
      const draft = draftOf(raw, promptIndex, drafts, start, strictness);
      // Reading hints (relaxed only) address the prompt's tokens; a merged っX counts as one, and
      // its hint spellings carry the っ like its other spellings (D22).
      if (strictness === 'learner' && draft.kind === 'kana') {
        const tokenIndex = drafts.length - start;
        for (const hint of prompt.readingHints ?? []) {
          if (hint.tokenIndex === tokenIndex) {
            const merged = raw.kind === 'kana' && raw.sokuon;
            const added = merged ? sokuonTexts(hint.learner) : hint.learner;
            draft.texts = unique([...draft.texts, ...added]);
          }
        }
      }
      drafts.push(draft);
    }
  });

  // A single n for ん depends on the next token's spellings, so resolve from the right.
  const reversed: Token[] = [];
  for (const d of drafts.slice().reverse()) {
    const spellings: Spelling[] = d.texts.map((text) => ({ text, next: null }));
    if (d.kind === 'n') {
      const bare = bareNext(d.promptIndex, reversed.at(-1), strictness);
      if (bare === null || bare.length > 0) spellings.push({ text: 'n', next: bare });
    }
    reversed.push({
      glyph: d.glyph,
      kanaKey: d.kanaKey,
      kind: d.kind,
      sokuon: d.sokuon,
      promptIndex: d.promptIndex,
      spellings,
    });
  }
  const fresh = reversed.reverse();

  // The bare n of a trailing ん was waiting for this context; its index stays, its set changes.
  const last = m.tokens.at(-1);
  const head =
    last?.kind === 'n'
      ? [
          ...m.tokens.slice(0, -1),
          {
            ...last,
            spellings: last.spellings.map((sp) =>
              sp.text === 'n'
                ? { text: 'n', next: bareNext(last.promptIndex, fresh[0], strictness) }
                : sp,
            ),
          },
        ]
      : m.tokens;

  return {
    tokens: [...head, ...fresh],
    promptStarts: [...m.promptStarts, ...promptStarts],
    strictness,
  };
}

function draftOf(
  raw: Raw,
  promptIndex: number,
  before: readonly Draft[],
  promptStart: number,
  strictness: Strictness,
): Draft {
  const base = { glyph: raw.glyph, promptIndex, sokuon: raw.kind === 'kana' && raw.sokuon };
  switch (raw.kind) {
    case 'kana': {
      const texts = kanaTexts(raw.info, strictness);
      return {
        ...base,
        kanaKey: raw.info.kanaKey,
        kind: 'kana',
        texts: raw.sokuon ? sokuonTexts(texts) : texts,
      };
    }
    case 'sokuon':
      return { ...base, kanaKey: null, kind: 'sokuon', texts: [...SOKUON_PREFIXES] };
    case 'choonpu':
      return {
        ...base,
        kanaKey: null,
        kind: 'choonpu',
        texts: choonpuTexts(before, promptStart, strictness),
      };
    case 'n':
      return { ...base, kanaKey: raw.kanaKey, kind: 'n', texts: ['nn', "n'"] };
    case 'skip':
      return { ...base, kanaKey: null, kind: 'skip', texts: [] };
  }
}
