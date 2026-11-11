import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTokenizer } from './kuromoji';
import type { Tokenizer } from './kuromoji';
import {
  auditSample,
  buildPhrases,
  buildVocabulary,
  checkCredits,
  normalise,
  phraseScript,
  placeHints,
  splitPhrases,
  toHiragana,
} from './phrases';
import type { PhraseSources, Sentence } from './phrases';

let tokenize: Tokenizer;

// kuromoji is slow to load: once per file.
beforeAll(async () => {
  tokenize = await createTokenizer();
}, 60_000);

const vocabulary = buildVocabulary([
  { seq: 1, kana: 'わたし', kanji: '私', definition: '' },
  { seq: 2, kana: 'ねこ', kanji: '猫', definition: '' },
  { seq: 3, kana: 'がっこう', kanji: '学校', definition: '' },
  { seq: 4, kana: 'いく', kanji: '行く', definition: '' },
  { seq: 5, kana: 'はし', kanji: '橋', definition: '' },
  { seq: 6, kana: 'わたる', kanji: '渡る', definition: '' },
  { seq: 7, kana: 'コーヒー', kanji: '', definition: '' },
]);

function hintsOf(original: string, reading: string) {
  const tokens = tokenize(original);
  const readings = tokens.map((t) => normalise(t.reading ?? t.surface));
  return placeHints(reading, tokens, readings);
}

describe('normalisation', () => {
  it('converts katakana to hiragana and removes skip characters', () => {
    expect(toHiragana('コーヒーヲ')).toBe('こーひーを');
    expect(normalise('ワタシ、ハ　ネコ。')).toBe('わたしはねこ');
    expect(normalise('ごめん…')).toBe('ごめん');
  });

  it('classifies the script of a reading', () => {
    expect(phraseScript('わたしはねこです。')).toBe('hiragana');
    expect(phraseScript('コーヒー！')).toBe('katakana');
    expect(phraseScript('コーヒーをのむ')).toBe('mixed');
  });
});

describe('hint placement', () => {
  it('hints は as a particle', () => {
    expect(hintsOf('私は猫です。', 'わたしはねこです。')).toEqual([
      { tokenIndex: 3, learner: ['wa'] },
    ]);
  });

  it('hints へ, counting a merged っX as one token', () => {
    expect(hintsOf('学校へ行く', 'がっこうへいく')).toEqual([{ tokenIndex: 3, learner: ['e'] }]);
  });

  it('counts skip tokens', () => {
    expect(hintsOf('今、私は猫。', 'いま、わたしはねこ。')).toEqual([
      { tokenIndex: 6, learner: ['wa'] },
    ]);
  });

  it('gives no hint to a は that is not a particle', () => {
    expect(hintsOf('はしを渡る', 'はしをわたる')).toEqual([]);
  });
});

function sentence(text: string, author: string | null = 'ann'): Sentence {
  return { text, author };
}

interface Case {
  id: number;
  jpn: Sentence;
  transcription?: Sentence;
  english?: Sentence | undefined;
  negative?: boolean;
  translationNegative?: boolean;
}

function sourcesOf(cases: readonly Case[]): PhraseSources {
  const japanese = new Map<number, Sentence>();
  const english = new Map<number, Sentence>();
  const links = new Map<number, number[]>();
  const transcriptions = new Map<number, Sentence>();
  const negative = new Set<number>();
  for (const c of cases) {
    japanese.set(c.id, c.jpn);
    if (c.transcription !== undefined) transcriptions.set(c.id, c.transcription);
    if (c.english !== undefined) {
      english.set(c.id + 1_000_000, c.english);
      links.set(c.id, [c.id + 1_000_000]);
      if (c.translationNegative === true) negative.add(c.id + 1_000_000);
    }
    if (c.negative === true) negative.add(c.id);
  }
  return { japanese, english, links, transcriptions, negative };
}

const good = (id: number, extra: Partial<Case> = {}): Case => ({
  id,
  jpn: sentence('私は猫です。'),
  transcription: sentence('[私|わたし]は[猫|ねこ]です。'),
  english: sentence('I am a cat.'),
  ...extra,
});

describe('buildPhrases', () => {
  const limits = { min: 0, max: 500 };
  const run = (cases: Case[]) => buildPhrases(sourcesOf(cases), vocabulary, tokenize, limits);

  it('selects a phrase with its hints, translation and credit', () => {
    const { phrases, report } = run([good(1)]);
    expect(report.selected).toBe(1);
    expect(phrases[0]?.item).toEqual({
      id: 'p:1',
      text: 'わたしはねこです。',
      script: 'hiragana',
      meaning: { en: 'I am a cat.' },
      readingHints: [{ tokenIndex: 3, learner: ['wa'] }],
      tatoebaId: 1,
    });
    expect(phrases[0]?.credit).toEqual({
      id: 'p:1',
      text: 'わたしはねこです。',
      sentence: { id: 1, author: 'ann' },
      translation: { id: 1_000_001, author: 'ann' },
      transcriptionAuthor: 'ann',
    });
  });

  it('counts each reason in the filter order', () => {
    const { report } = run([
      good(1),
      good(2, { jpn: sentence('私は猫です。', null) }), // noAuthor
      good(3, { negative: true }), // negativeRating
      { id: 4, jpn: sentence('私は猫です。'), english: sentence('x') }, // noTranscription
      good(5, { transcription: sentence('[私|わたし]は[猫|]です。') }), // transcriptionUnreadable
      { ...good(6), english: undefined }, // noTranslation (no link)
      good(7, { english: sentence('x', null) }), // noTranslation (no author)
      good(8, { translationNegative: true }), // noTranslation (rated -1)
      good(9, { english: sentence('x'.repeat(81)) }), // noTranslation (too long)
      good(10, { transcription: sentence('wa[私|わたし]') }), // unsupportedCharacter
      good(11, {
        jpn: sentence('私は猫です。'),
        transcription: sentence('わたしはねこですわたしはねこですわたしはねこです'),
      }), // tooLong
      good(12, { transcription: sentence('[私|わたし]へ[猫|ねこ]です。') }), // readingMismatch (contributor, へ)
      good(13, {
        jpn: sentence('私は犬です。'),
        transcription: sentence('[私|わたし]は[犬|いぬ]です。'),
      }), // outsideVocabulary (犬)
      good(14, { transcription: sentence('[私|わたし]は[猫|ねこ]です。', null) }),
    ]);
    expect(report.excluded).toEqual({
      noAuthor: 1,
      negativeRating: 1,
      noTranscription: 1,
      transcriptionUnreadable: 1,
      noTranslation: 4,
      unsupportedCharacter: 1,
      tooLong: 1,
      readingMismatch: 1,
      outsideVocabulary: 1,
      compileFailed: 0,
    });
    expect(report.qualifying).toBe(2); // ids 1 and 14
  });

  it('uses the translation with the lowest id that qualifies', () => {
    const base = sourcesOf([good(1)]);
    const sources: PhraseSources = {
      ...base,
      english: new Map([
        [5, sentence('too long'.repeat(20))],
        [7, sentence('Seven.')],
        [9, sentence('Nine.')],
      ]),
      links: new Map([[1, [9, 7, 5]]]),
    };
    const { phrases } = buildPhrases(sources, vocabulary, tokenize, limits);
    expect(phrases[0]?.item.meaning.en).toBe('Seven.');
    expect(phrases[0]?.credit.translation.id).toBe(7);
  });

  it('accepts a machine transcription only when it equals the kuromoji reading', () => {
    const machine = (text: string) => run([good(1, { transcription: sentence(text, null) })]);
    expect(machine('[私|わたし]は[猫|ねこ]です。').report.qualifying).toBe(1);
    expect(machine('[私|わたくし]は[猫|ねこ]です。').report.excluded.readingMismatch).toBe(1);
  });

  it('accepts a contributor reading without は/へ even if it differs from kuromoji', () => {
    const cases = [
      good(1, {
        jpn: sentence('学校に行く'),
        transcription: sentence('[学校|がっこう]に[行|ゆ]く'),
      }),
    ];
    expect(run(cases).report.qualifying).toBe(1);
  });

  it('exempts particles, auxiliaries and katakana proper nouns from the vocabulary filter', () => {
    const cases = [
      good(1, {
        jpn: sentence('トムは学校へ行く'),
        transcription: sentence('トムは[学校|がっこう]へ[行|い]く'),
      }),
    ];
    expect(run(cases).report.qualifying).toBe(1);
  });

  it('keeps the script of the transcription and marks mixed phrases', () => {
    const { phrases } = run([
      good(1, {
        jpn: sentence('トムは猫です。'),
        transcription: sentence('トムは[猫|ねこ]です。'),
      }),
    ]);
    expect(phrases[0]?.item.script).toBe('mixed');
    expect(phrases[0]?.item.text).toBe('トムはねこです。');
  });

  it('orders by sha256 of the sentence id and takes the first max', () => {
    const ids = Array.from({ length: 12 }, (_, i) => 100 + i);
    const expected = [...ids]
      .sort((a, b) => {
        const ha = createHash('sha256').update(String(a)).digest('hex');
        const hb = createHash('sha256').update(String(b)).digest('hex');
        return ha < hb ? -1 : 1;
      })
      .slice(0, 5)
      .map((id) => `p:${id}`);
    const { phrases, report } = buildPhrases(
      sourcesOf(ids.map((id) => good(id))),
      vocabulary,
      tokenize,
      { min: 5, max: 5 },
    );
    expect(phrases.map((p) => p.item.id)).toEqual(expected);
    expect(report.qualifying).toBe(12);
    expect(report.selected).toBe(5);
  });

  it('fails when fewer than the minimum qualify', () => {
    expect(() =>
      buildPhrases(sourcesOf([good(1), good(2)]), vocabulary, tokenize, { min: 3, max: 5 }),
    ).toThrow(/at least 3/);
  });
});

describe('credits', () => {
  it('are complete and sorted by sentence id', () => {
    const built = buildPhrases(sourcesOf([good(9), good(3), good(5)]), vocabulary, tokenize, {
      min: 1,
      max: 10,
    });
    const { credits, items } = splitPhrases(built.phrases);
    expect(credits.map((c) => c.sentence.id)).toEqual([3, 5, 9]);
    expect(items.hiragana).toHaveLength(3);
    for (const credit of credits) {
      expect(credit.sentence.author).not.toBe('');
      expect(credit.translation.author).not.toBe('');
    }
  });

  it('fail the build when an author is missing', () => {
    const built = buildPhrases(sourcesOf([good(1)]), vocabulary, tokenize, { min: 1, max: 1 });
    const [phrase] = built.phrases;
    if (phrase === undefined) throw new Error('no phrase');
    const broken = { ...phrase, credit: { ...phrase.credit, translation: { id: 1, author: '' } } };
    expect(() => {
      checkCredits([broken]);
    }).toThrow(/lacks author data/);
  });
});

describe('audit sample', () => {
  it('lists the sentence, transcription, reading, hints and translation', () => {
    const built = buildPhrases(sourcesOf([good(1)]), vocabulary, tokenize, { min: 1, max: 1 });
    const text = auditSample(built.phrases);
    expect(text).toContain('## p:1');
    expect(text).toContain('- Japanese: 私は猫です。');
    expect(text).toContain('- Transcription: [私|わたし]は[猫|ねこ]です。');
    expect(text).toContain('- Reading: わたしはねこです。');
    expect(text).toContain('- Hints: 3:wa');
    expect(text).toContain('- English: I am a cat.');
  });
});
