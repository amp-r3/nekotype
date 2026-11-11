import { createHash } from 'node:crypto';
import { createEngine, engineTable, SKIP_CHARACTERS } from '@nekotype/engine';
import type { ReadingHint } from '@nekotype/engine';
import { compiles } from './compile';
import type { JlptRow } from './jlpt';
import type { MorphToken, Tokenizer } from './kuromoji';
import { parseTranscription } from './tatoeba/transcription';
import type { ContentItem, ContentScript, PhraseCredit } from './types';

export const MAX_KANA = 15;
export const MAX_TRANSLATION = 80;
export const SELECT_MAX = 500;
export const SELECT_MIN = 300;
export const AUDIT_SIZE = 50;

const engine = createEngine(engineTable);

export interface Sentence {
  text: string;
  /** `null` when the export has no username. */
  author: string | null;
}

/** The Tatoeba data the phrase step reads, already indexed (see `tatoeba/load.ts`). */
export interface PhraseSources {
  /** Every Japanese sentence by id. */
  japanese: ReadonlyMap<number, Sentence>;
  /** English sentences by id; at least the ones linked from a Japanese sentence. */
  english: ReadonlyMap<number, Sentence>;
  /** Direct links: Japanese sentence id → English sentence ids. */
  links: ReadonlyMap<number, readonly number[]>;
  /** The transcription chosen for each Japanese sentence (a contributor's before a machine's). */
  transcriptions: ReadonlyMap<number, Sentence>;
  /** Ids of sentences with at least one rating of -1. */
  negative: ReadonlySet<number>;
}

/** The N5–N4 spellings the vocabulary filter accepts. */
export interface Vocabulary {
  /** `kanji` and `kana` columns as written. */
  spellings: ReadonlySet<string>;
  /** `kana` columns in hiragana. */
  readings: ReadonlySet<string>;
}

export const REASONS = [
  'noAuthor',
  'negativeRating',
  'noTranscription',
  'transcriptionUnreadable',
  'noTranslation',
  'unsupportedCharacter',
  'tooLong',
  'readingMismatch',
  'outsideVocabulary',
] as const;
export type Reason = (typeof REASONS)[number];

export interface SelectedPhrase {
  item: ContentItem;
  credit: PhraseCredit;
  /** The sentence as Tatoeba stores it, for the audit sample. */
  original: string;
  /** The transcription as Tatoeba stores it. */
  transcription: string;
}

export interface PhraseReport {
  /** Japanese sentences read. */
  sentences: number;
  excluded: Record<Reason | 'compileFailed', number>;
  /** Sentences that passed filters 1–8 (the base of the 5% compile-failure threshold). */
  passedFilters: number;
  compileFailed: { id: string; text: string }[];
  /** Sentences that passed every filter. */
  qualifying: number;
  selected: number;
}

export function toHiragana(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }
  return out;
}

/** Skip characters removed (content.md, "Phrases" step 4). */
function withoutSkips(text: string): string {
  return Array.from(text)
    .filter((ch) => !SKIP_CHARACTERS.has(ch))
    .join('');
}

/** Katakana to hiragana and skip characters removed: the form two readings are compared in. */
export function normalise(reading: string): string {
  return withoutSkips(toHiragana(reading));
}

export function buildVocabulary(rows: readonly JlptRow[]): Vocabulary {
  const spellings = new Set<string>();
  const readings = new Set<string>();
  for (const { kana, kanji } of rows) {
    spellings.add(kana);
    if (kanji !== '') spellings.add(kanji);
    readings.add(toHiragana(kana));
  }
  return { spellings, readings };
}

/** The script of a reading: skip characters and ー do not count. `mixed` has both kinds. */
export function phraseScript(reading: string): ContentScript {
  const hira = /[ぁ-ゖ]/u.test(reading);
  const kata = /[ァ-ヺ]/u.test(reading);
  if (hira && kata) return 'mixed';
  return kata ? 'katakana' : 'hiragana';
}

const SUPPORTED = /^[ぁ-ゖァ-ヺー]$/u;

function supported(reading: string): boolean {
  return Array.from(reading).every((ch) => SKIP_CHARACTERS.has(ch) || SUPPORTED.test(ch));
}

const EXEMPT_POS = new Set(['助詞', '助動詞', '記号', 'フィラー']);
const EXEMPT_DETAIL = new Set(['非自立', '接尾']);

/** Vocabulary filter (C7 step 8) for one token. */
function inVocabulary(token: MorphToken, vocabulary: Vocabulary): boolean {
  if (EXEMPT_POS.has(token.pos) || EXEMPT_DETAIL.has(token.posDetail1)) return true;
  if (token.posDetail1 === '固有名詞' && /^[ァ-ヺー]+$/u.test(token.surface)) return true;
  const word = token.basicForm === '*' ? token.surface : token.basicForm;
  if (vocabulary.spellings.has(word)) return true;
  return token.reading !== null && vocabulary.readings.has(toHiragana(token.reading));
}

/** kuromoji's normalised reading of one token; `null` when the token has no usable reading. */
function tokenReading(token: MorphToken): string | null {
  const reading = token.reading ?? (withoutSkips(token.surface) === '' ? '' : null);
  return reading === null ? null : normalise(reading);
}

const PARTICLE_HINTS: Readonly<Record<string, string>> = { は: 'wa', へ: 'e' };

/**
 * Hints for は/へ that kuromoji tags as particles (content.md, "Phrases" step 5): the kana offset of
 * the particle in the normalised reading becomes the engine's token index of the prompt. Returns
 * `null` when a particle has no token of its own (for example a merged っは).
 */
export function placeHints(
  text: string,
  tokens: readonly MorphToken[],
  readings: readonly string[],
): ReadingHint[] | null {
  const offsets = new Map<number, string>();
  let offset = 0;
  tokens.forEach((token, i) => {
    const hint = PARTICLE_HINTS[token.surface];
    if (token.pos === '助詞' && hint !== undefined) offsets.set(offset, hint);
    offset += readings[i]?.length ?? 0;
  });
  if (offsets.size === 0) return [];
  const matcher = engine.compile([{ key: text, text, script: 'hiragana' }], 'learner');
  const hints: ReadingHint[] = [];
  let position = 0;
  matcher.tokens.forEach((token, tokenIndex) => {
    const spelling = offsets.get(position);
    if (spelling !== undefined && token.kind === 'kana' && token.glyph.length === 1) {
      hints.push({ tokenIndex, learner: [spelling] });
      offsets.delete(position);
    }
    if (token.kind !== 'skip') position += token.glyph.length;
  });
  return offsets.size === 0 ? hints : null;
}

function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** The translation of C7 step 4: the English sentence with the lowest id that qualifies. */
function pickTranslation(
  id: number,
  sources: PhraseSources,
): { id: number; sentence: Sentence } | null {
  const candidates = [...(sources.links.get(id) ?? [])].sort((a, b) => a - b);
  for (const english of candidates) {
    const sentence = sources.english.get(english);
    if (
      sentence !== undefined &&
      sentence.author !== null &&
      !sources.negative.has(english) &&
      sentence.text.length <= MAX_TRANSLATION
    ) {
      return { id: english, sentence };
    }
  }
  return null;
}

/**
 * C7 and C8: the filter chain, then the selection. `min` and `max` are parameters so a test can
 * run the rules on a small fixture; the build uses the defaults.
 */
export function buildPhrases(
  sources: PhraseSources,
  vocabulary: Vocabulary,
  tokenize: Tokenizer,
  limits: { min: number; max: number } = { min: SELECT_MIN, max: SELECT_MAX },
): { phrases: SelectedPhrase[]; report: PhraseReport } {
  const excluded: Record<Reason | 'compileFailed', number> = {
    noAuthor: 0,
    negativeRating: 0,
    noTranscription: 0,
    transcriptionUnreadable: 0,
    noTranslation: 0,
    unsupportedCharacter: 0,
    tooLong: 0,
    readingMismatch: 0,
    outsideVocabulary: 0,
    compileFailed: 0,
  };
  const compileFailed: { id: string; text: string }[] = [];
  const qualifying: SelectedPhrase[] = [];
  let passedFilters = 0;

  for (const [id, sentence] of sources.japanese) {
    const exclude = (reason: Reason): void => {
      excluded[reason] += 1;
    };
    if (sentence.author === null) {
      exclude('noAuthor');
      continue;
    }
    if (sources.negative.has(id)) {
      exclude('negativeRating');
      continue;
    }
    const transcription = sources.transcriptions.get(id);
    if (transcription === undefined) {
      exclude('noTranscription');
      continue;
    }
    const parsed = parseTranscription(transcription.text);
    if (parsed === null) {
      exclude('transcriptionUnreadable');
      continue;
    }
    const translation = pickTranslation(id, sources);
    if (translation === null || translation.sentence.author === null) {
      exclude('noTranslation');
      continue;
    }
    const reading = parsed.reading;
    if (!supported(reading)) {
      exclude('unsupportedCharacter');
      continue;
    }
    const normalised = normalise(reading);
    if (Array.from(normalised).length > MAX_KANA) {
      exclude('tooLong');
      continue;
    }

    const tokens = tokenize(sentence.text);
    const readings = tokens.map(tokenReading);
    const machine = transcription.author === null;
    let hints: ReadingHint[] = [];
    if (machine || /[はへ]/u.test(normalised)) {
      const known = readings.filter((r): r is string => r !== null);
      if (known.length !== readings.length || known.join('') !== normalised) {
        exclude('readingMismatch');
        continue;
      }
      const placed = placeHints(reading, tokens, known);
      if (placed === null) {
        exclude('readingMismatch');
        continue;
      }
      hints = placed;
    }
    if (!tokens.every((token) => inVocabulary(token, vocabulary))) {
      exclude('outsideVocabulary');
      continue;
    }

    passedFilters += 1;
    const script = phraseScript(reading);
    if (!compiles(reading, script === 'katakana' ? 'katakana' : 'hiragana')) {
      excluded.compileFailed += 1;
      compileFailed.push({ id: `p:${id}`, text: reading });
      continue;
    }
    const item: ContentItem = {
      id: `p:${id}`,
      text: reading,
      script,
      meaning: { en: translation.sentence.text },
      tatoebaId: id,
    };
    if (hints.length > 0) item.readingHints = hints;
    qualifying.push({
      item,
      original: sentence.text,
      transcription: transcription.text,
      credit: {
        id: item.id,
        sentence: { id, author: sentence.author },
        translation: { id: translation.id, author: translation.sentence.author },
        transcriptionAuthor: transcription.author,
      },
    });
  }

  if (qualifying.length < limits.min) {
    throw new Error(
      `Only ${qualifying.length} phrases qualify, at least ${limits.min} are required (no relaxation)`,
    );
  }
  const phrases = qualifying
    .map((phrase) => ({ phrase, key: sha(String(phrase.credit.sentence.id)) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, limits.max)
    .map(({ phrase }) => phrase);
  checkCredits(phrases);
  return {
    phrases,
    report: {
      sentences: sources.japanese.size,
      excluded,
      passedFilters,
      compileFailed,
      qualifying: qualifying.length,
      selected: phrases.length,
    },
  };
}

/** C9: the build fails if a phrase lacks the author data the credit needs. */
export function checkCredits(phrases: readonly SelectedPhrase[]): void {
  for (const { credit } of phrases) {
    const missing =
      credit.sentence.author === '' ||
      credit.translation.author === '' ||
      credit.transcriptionAuthor === '';
    if (missing) throw new Error(`Phrase ${credit.id} lacks author data for its credit`);
  }
}

/** The phrases of the generated chunks and the credits, split by script and sorted by sentence id. */
export function splitPhrases(phrases: readonly SelectedPhrase[]): {
  items: Record<ContentScript, ContentItem[]>;
  credits: PhraseCredit[];
} {
  const items: Record<ContentScript, ContentItem[]> = { hiragana: [], katakana: [], mixed: [] };
  for (const { item } of phrases) items[item.script].push(item);
  const credits = phrases.map((phrase) => phrase.credit);
  credits.sort((a, b) => a.sentence.id - b.sentence.id);
  return { items, credits };
}

/** C10: `count` phrases in the order of sha256(`audit:<id>`), as Markdown for review. */
export function auditSample(phrases: readonly SelectedPhrase[], count = AUDIT_SIZE): string {
  const sample = phrases
    .map((phrase) => ({ phrase, key: sha(`audit:${phrase.credit.sentence.id}`) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, count)
    .map(({ phrase }) => phrase);
  const lines = [
    '# Phrase audit sample',
    '',
    `${sample.length} phrases chosen by the order of sha256("audit:<sentence id>"). Check that the kana reading is how the Japanese sentence is read.`,
    '',
  ];
  for (const { item, original, transcription, credit } of sample) {
    const hints = (item.readingHints ?? []).map((h) => `${h.tokenIndex}:${h.learner.join('/')}`);
    lines.push(
      `## ${item.id}`,
      '',
      `- Japanese: ${original}`,
      `- Transcription: ${transcription}${credit.transcriptionAuthor === null ? ' (machine)' : ''}`,
      `- Reading: ${item.text}`,
      `- Hints: ${hints.length === 0 ? 'none' : hints.join(', ')}`,
      `- English: ${item.meaning.en}`,
      '',
    );
  }
  return lines.join('\n');
}
