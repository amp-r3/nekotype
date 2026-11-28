import { describe, expect, it } from 'vitest';
import { accepts, acceptsItems, engine, feed, prompts, rejectedAt } from './test-util';

function texts(promptTexts: string[], mode: 'learner' | 'ime', token: number): string[] {
  const m = engine.compile(prompts(...promptTexts), mode);
  return (m.tokens[token]?.spellings ?? []).map((s) => s.text);
}

describe('tokens', () => {
  it('merges っ into the following kana as one token with that kana key (D22)', () => {
    const m = engine.compile(prompts('ちょっと'), 'ime');
    expect(m.tokens.map((t) => t.glyph)).toEqual(['ちょ', 'っと']);
    expect(m.tokens[1]?.kanaKey).toBe('hiragana:と');
    expect(m.tokens[1]?.kind).toBe('kana');
  });

  it('flags the merged っX token as sokuon, and no other token', () => {
    const flags = (...texts: string[]): boolean[] =>
      engine.compile(prompts(...texts), 'learner').tokens.map((t) => t.sokuon);
    expect(flags('きって')).toEqual([false, true]);
    expect(flags('っっあ')).toEqual([false, true]);
    expect(flags('あっ')).toEqual([false, false]);
    expect(flags('ッーん、')).toEqual([false, false, false, false]);
  });

  it('keeps a standalone っ and ー without a kana key', () => {
    const m = engine.compile(prompts('あっ', 'ー'), 'ime');
    expect(m.tokens.map((t) => [t.glyph, t.kind, t.kanaKey])).toEqual([
      ['あ', 'kana', 'hiragana:あ'],
      ['っ', 'sokuon', null],
      ['ー', 'choonpu', null],
    ]);
  });

  it('does not merge っ with ん, ー, another っ or a skip token', () => {
    const kinds = (text: string): string[] =>
      engine.compile(prompts(text), 'ime').tokens.map((t) => t.kind);
    expect(kinds('っん')).toEqual(['sokuon', 'n']);
    expect(kinds('っー')).toEqual(['sokuon', 'choonpu']);
    expect(kinds('っっあ')).toEqual(['sokuon', 'kana']);
    expect(kinds('っ、')).toEqual(['sokuon', 'skip']);
  });

  it('marks skip tokens and gives them no spellings', () => {
    const m = engine.compile(prompts('あ、い'), 'ime');
    expect(m.tokens.map((t) => t.kind)).toEqual(['kana', 'skip', 'kana']);
    expect(m.tokens[1]?.spellings).toEqual([]);
  });

  it('records prompt boundaries', () => {
    const m = engine.compile(prompts('ねこ', 'いぬ', 'とり'), 'ime');
    expect(m.promptStarts).toEqual([0, 2, 4]);
    expect(m.tokens.map((t) => t.promptIndex)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('throws on a character the table cannot represent (D8)', () => {
    expect(() => engine.compile(prompts('あA'), 'ime')).toThrow(/Unrepresentable/);
  });

  it('puts the doubled forms before the prefixed ones, tch before cch', () => {
    expect(texts(['まっち'], 'ime', 1).slice(0, 3)).toEqual(['tchi', 'cchi', 'tti']);
    expect(texts(['きって'], 'ime', 1)).toEqual(['tte', 'xtute', 'ltute', 'xtsute', 'ltsute']);
  });

  it('does not double before a vowel, n or y, only the prefixed forms remain', () => {
    expect(texts(['っあ'], 'ime', 0)).toEqual(['xtua', 'ltua', 'xtsua', 'ltsua']);
    expect(texts(['あっな'], 'ime', 1)).toEqual(['xtuna', 'ltuna', 'xtsuna', 'ltsuna']);
  });
});

describe('ん spelling constraints', () => {
  it('permits a bare n only before the spellings that qualify', () => {
    const m = engine.compile(prompts('かんた'), 'ime');
    const n = m.tokens[1]?.spellings;
    expect(n?.map((s) => s.text)).toEqual(['nn', "n'", 'n']);
    expect(n?.[0]?.next).toBeNull();
    expect(n?.[2]?.next).toEqual([0]);
  });

  it('offers no bare n before a vowel, y or ー', () => {
    expect(texts(['かんい'], 'learner', 1)).toEqual(['nn', "n'"]);
    expect(texts(['かんや'], 'learner', 1)).toEqual(['nn', "n'"]);
    expect(texts(['かんー'], 'learner', 1)).toEqual(['nn', "n'"]);
  });

  it('allows a bare n before n only in relaxed mode', () => {
    expect(texts(['こんな'], 'learner', 1)).toContain('n');
    expect(texts(['こんな'], 'ime', 1)).not.toContain('n');
  });

  it('allows a bare n at the end of the stream and before a skip token', () => {
    expect(texts(['ほん'], 'ime', 1)).toContain('n');
    expect(texts(['ほん。あ'], 'ime', 1)).toContain('n');
    expect(accepts(['ほん。あ'], 'ime', 'hona')).toBe(true);
  });

  it('allows a bare n before any spelling across a boundary in relaxed mode (A15)', () => {
    const m = engine.compile(prompts('ほん', 'やま'), 'learner');
    expect(m.tokens[1]?.spellings[2]?.next).toEqual([0]);
    expect(accepts(['ほん', 'やま'], 'learner', 'honyama')).toBe(true);
    expect(accepts(['ほん', 'やま'], 'ime', 'honyama')).toBe(false);
  });

  it('uses the next prompt only through its first token; a skip first token means the end rule', () => {
    expect(accepts(['ほん', '、あ'], 'ime', 'hona')).toBe(true);
  });

  it('chains through ん ん', () => {
    expect(texts(['ほんん'], 'learner', 1)).toContain('n');
    expect(texts(['ほんん'], 'ime', 1)).not.toContain('n');
  });
});

describe('ー', () => {
  it('takes the vowel from a merged っX', () => {
    expect(accepts(['カッター'], 'learner', 'kattaa')).toBe(true);
    expect(accepts(['カッター'], 'ime', 'kattaa')).toBe(false);
  });

  it('has no vowel at the start of a prompt, even after another prompt', () => {
    expect(rejectedAt(['か', 'ー'], 'learner', 'kaa')).toBe(2);
    expect(accepts(['か', 'ー'], 'learner', 'ka-')).toBe(true);
  });

  it('has no vowel after a skip token or a standalone っ', () => {
    expect(rejectedAt(['か。ー'], 'learner', 'kaa')).toBe(2);
    expect(rejectedAt(['っー'], 'learner', 'xtuu')).toBe(3);
  });
});

describe('readingHints', () => {
  it('count a merged っX and a skip token as one token each', () => {
    const skip = [{ key: 'a', text: 'あ、は', readingHints: [{ tokenIndex: 2, learner: ['wa'] }] }];
    expect(acceptsItems(skip, 'learner', 'awa')).toBe(true);
    const merged = [
      { key: 'b', text: 'あっは', readingHints: [{ tokenIndex: 1, learner: ['wa'] }] },
    ];
    expect(acceptsItems(merged, 'learner', 'awwa')).toBe(true);
    expect(acceptsItems(merged, 'learner', 'axtuwa')).toBe(true);
  });

  it('carry the っ of a merged token, so it cannot be left out (D22)', () => {
    const merged = [
      { key: 'b', text: 'あっは', readingHints: [{ tokenIndex: 1, learner: ['wa'] }] },
    ];
    expect(acceptsItems(merged, 'learner', 'awa')).toBe(false);
  });

  it('are ignored in strict mode and on tokens that take no spelling', () => {
    const items = [{ key: 'a', text: 'あ、', readingHints: [{ tokenIndex: 1, learner: ['x'] }] }];
    expect(acceptsItems(items, 'learner', 'ax')).toBe(false);
    const strict = [{ key: 'b', text: 'は', readingHints: [{ tokenIndex: 0, learner: ['wa'] }] }];
    expect(acceptsItems(strict, 'ime', 'wa')).toBe(false);
  });

  it('feed into the constraint of the preceding ん', () => {
    const items = [
      { key: 'c', text: 'ほんは', readingHints: [{ tokenIndex: 2, learner: ['wa'] }] },
    ];
    expect(acceptsItems(items, 'learner', 'honwa')).toBe(true);
    expect(acceptsItems(items, 'ime', 'honwa')).toBe(false);
  });
});

describe('state', () => {
  it('starts complete for an empty stream or one with only skip tokens', () => {
    for (const p of [[], ['、。']]) {
      const m = engine.compile(prompts(...p), 'ime');
      expect(engine.isComplete(m, engine.start(m))).toBe(true);
      expect(engine.step(m, engine.start(m), 'a')).toBeNull();
    }
  });

  it('lowercases the key, so Caps Lock has no effect', () => {
    const m = engine.compile(prompts('ねこ'), 'ime');
    expect(feed(m, 'neko').state).not.toBeNull();
    const upper = engine.step(m, engine.start(m), 'N');
    expect(upper).not.toBeNull();
  });

  it('does not change the state it steps from', () => {
    const m = engine.compile(prompts('こんな'), 'learner');
    const s = engine.start(m);
    const before = JSON.stringify(s);
    engine.step(m, s, 'k');
    expect(JSON.stringify(s)).toBe(before);
  });

  it('reports the surplus keys of an unfinished ん only once the stream is complete', () => {
    const m = engine.compile(prompts('ほん'), 'learner');
    const half = feed(m, 'ho').state;
    expect(half && engine.extensions(m, half).size).toBe(0);
    const done = feed(m, 'hon').state;
    expect(done && engine.isComplete(m, done)).toBe(true);
    expect(done && Array.from(engine.extensions(m, done)).sort()).toEqual(["'", 'n']);
    const full = feed(m, 'honn').state;
    expect(full && engine.extensions(m, full).size).toBe(0);
  });
});
