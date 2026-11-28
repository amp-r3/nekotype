import { describe, expect, it } from 'vitest';
import type { Strictness } from '../types';
import { allKanaRows, SKIP_CHARACTERS, standaloneRows } from '../data';
import { engine, prompts, Rng } from './test-util';
import type { Matcher, MatchState } from './types';

const ALPHABET = "abcdefghijklmnopqrstuvwxyz-'".split('');

const GLYPHS: string[] = [
  ...[...allKanaRows, ...standaloneRows].flatMap((r) =>
    r.entries.flatMap((e) => (e.hiragana === undefined ? [e.katakana] : [e.hiragana, e.katakana])),
  ),
  ...['っ', 'ッ', 'ん', 'ン', 'ー', 'ん', 'っ', 'ー'],
  ...Array.from(SKIP_CHARACTERS),
];

function randomPrompts(rng: Rng): string[] {
  const count = rng.int(1, 3);
  return Array.from({ length: count }, () =>
    Array.from({ length: rng.int(1, 5) }, () => rng.pick(GLYPHS)).join(''),
  );
}

function acceptedKeys(m: Matcher, s: MatchState): string[] {
  return ALPHABET.filter((k) => engine.step(m, s, k) !== null);
}

// Walks the matcher with random accepted keys until the stream is complete.
function walk(m: Matcher, rng: Rng): { keys: string; state: MatchState } {
  let state = engine.start(m);
  let keys = '';
  for (let guard = 0; guard < 400; guard++) {
    const accepted = acceptedKeys(m, state);
    if (accepted.length === 0 || (engine.isComplete(m, state) && rng.next() < 0.4)) break;
    const key = rng.pick(accepted);
    const next = engine.step(m, state, key);
    if (next === null) throw new Error('an accepted key was rejected');
    state = next;
    keys += key;
  }
  return { keys, state };
}

describe('properties over random streams', () => {
  const rng = new Rng(20261102);
  const cases = Array.from({ length: 300 }, () => randomPrompts(rng));

  it('without っ or ー no rejected key is a rule error', () => {
    for (const texts of cases.map((c) => c.map((t) => t.replace(/[っッー]/g, '') || 'あ'))) {
      for (const mode of ['learner', 'ime'] as const) {
        const m = engine.compile(prompts(...texts), mode);
        let state = engine.start(m);
        for (const key of [...Array.from(walk(m, rng).keys), '']) {
          for (const rejected of ALPHABET) {
            if (engine.step(m, state, rejected) !== null) continue;
            expect(engine.ruleError(m, state, rejected), `${texts.join('|')} ${rejected}`).toBe(
              false,
            );
          }
          if (key !== '') state = engine.step(m, state, key) ?? state;
        }
      }
    }
  });

  it('every stream compiles in both modes', () => {
    for (const texts of cases) {
      for (const mode of ['learner', 'ime'] as const) {
        expect(engine.compile(prompts(...texts), mode).tokens.length).toBeGreaterThan(0);
      }
    }
  });

  it('has no dead ends: every walk ends in a complete stream', () => {
    for (const texts of cases) {
      for (const mode of ['learner', 'ime'] as const satisfies readonly Strictness[]) {
        const m = engine.compile(prompts(...texts), mode);
        const { keys, state } = walk(m, rng);
        expect(engine.isComplete(m, state), `${texts.join('|')} ${mode} ← ${keys}`).toBe(true);
      }
    }
  });

  it('relaxed accepts every input strict accepts (invariant)', () => {
    for (const texts of cases) {
      const strict = engine.compile(prompts(...texts), 'ime');
      const relaxed = engine.compile(prompts(...texts), 'learner');
      for (let w = 0; w < 4; w++) {
        const { keys, state } = walk(strict, rng);
        let s: MatchState | null = engine.start(relaxed);
        for (const key of keys) {
          s = s === null ? null : engine.step(relaxed, s, key);
          expect(s, `${texts.join('|')} ← ${keys} at ${key}`).not.toBeNull();
        }
        expect(s !== null && engine.isComplete(relaxed, s)).toBe(engine.isComplete(strict, state));
      }
    }
  });

  it('rejects a mutated key only when another valid path exists', () => {
    for (const texts of cases.slice(0, 100)) {
      const m = engine.compile(prompts(...texts), 'ime');
      const { keys } = walk(m, rng);
      if (keys.length === 0) continue;
      const at = rng.int(0, keys.length - 1);
      const wrong = rng.pick(ALPHABET.filter((k) => k !== keys.charAt(at)));
      let s: MatchState | null = engine.start(m);
      for (let i = 0; i < at && s !== null; i++) s = engine.step(m, s, keys.charAt(i));
      expect(s).not.toBeNull();
      if (s === null) continue;
      expect(engine.step(m, s, wrong) === null).toBe(!acceptedKeys(m, s).includes(wrong));
    }
  });
});

// Spellings of a bare n that the appended context ruled out stay in place with an empty set so that
// indices do not move; a stream compiled in one go simply omits them.
function normalised(m: Matcher): unknown {
  return {
    ...m,
    tokens: m.tokens.map((t) => ({
      ...t,
      spellings: t.spellings.filter((s) => s.next?.length !== 0),
    })),
  };
}

describe('properties of extend and committedPrompts', () => {
  const rng = new Rng(20261103);
  const cases = Array.from({ length: 300 }, () => {
    const texts = randomPrompts(rng);
    while (texts.length < 2) texts.push(...randomPrompts(rng));
    return texts;
  });

  it('extend gives the same matcher as compiling the whole stream', () => {
    for (const texts of cases) {
      for (const mode of ['learner', 'ime'] as const) {
        const cut = rng.int(1, texts.length - 1);
        const head = engine.compile(prompts(...texts.slice(0, cut)), mode);
        const extended = engine.extend(
          head,
          prompts(...texts.slice(cut)).map((p, i) => ({ ...p, key: `e${i}` })),
        );
        const whole = engine.compile(prompts(...texts), mode);
        expect(normalised(extended), `${texts.join('|')} ${mode} cut ${cut}`).toEqual(
          normalised(whole),
        );
      }
    }
  });

  it('a state made before extend accepts the same continuations as one made after', () => {
    let compared = 0;
    for (const texts of cases) {
      for (const mode of ['learner', 'ime'] as const) {
        const whole = engine.compile(prompts(...texts), mode);
        const { keys } = walk(whole, rng);
        const cut = rng.int(1, texts.length - 1);
        const head = engine.compile(prompts(...texts.slice(0, cut)), mode);
        const split = rng.int(0, keys.length);

        let old: MatchState | null = engine.start(head);
        for (let i = 0; i < split && old !== null; i++)
          old = engine.step(head, old, keys.charAt(i));
        if (old === null) continue; // the keys had already left the head of the stream

        const extended = engine.extend(head, prompts(...texts.slice(cut)));
        let full: MatchState | null = engine.start(whole);
        for (let i = 0; i < split && full !== null; i++)
          full = engine.step(whole, full, keys.charAt(i));
        expect(full).not.toBeNull();
        if (full === null) continue;

        let a: MatchState = old;
        let b: MatchState = full;
        for (let i = split; ; i++) {
          expect(acceptedKeys(extended, a), `${texts.join('|')} ${mode} ← ${keys} at ${i}`).toEqual(
            acceptedKeys(whole, b),
          );
          expect(engine.isComplete(extended, a)).toBe(engine.isComplete(whole, b));
          if (i >= keys.length) break;
          const na = engine.step(extended, a, keys.charAt(i));
          const nb = engine.step(whole, b, keys.charAt(i));
          if (na === null || nb === null) throw new Error('a key of the walk was rejected');
          a = na;
          b = nb;
        }
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('committedPrompts never decreases along a walk and ends at the prompt count', () => {
    for (const texts of cases) {
      const m = engine.compile(prompts(...texts), 'learner');
      let state = engine.start(m);
      let last = engine.committedPrompts(m, state);
      for (let guard = 0; guard < 400; guard++) {
        const accepted = acceptedKeys(m, state);
        if (accepted.length === 0) break;
        const next = engine.step(m, state, rng.pick(accepted));
        if (next === null) throw new Error('an accepted key was rejected');
        state = next;
        const now = engine.committedPrompts(m, state);
        expect(now).toBeGreaterThanOrEqual(last);
        last = now;
      }
      expect(last, texts.join('|')).toBe(texts.length);
    }
  });
});

describe('properties of compact and committedTimings', () => {
  const rng = new Rng(20261104);
  const cases = Array.from({ length: 200 }, () => {
    const texts = randomPrompts(rng);
    while (texts.length < 3) texts.push(...randomPrompts(rng));
    return texts;
  });

  it('compacting after every key does not change what is accepted', () => {
    for (const texts of cases) {
      for (const mode of ['learner', 'ime'] as const) {
        const whole = engine.compile(prompts(...texts), mode);
        const { keys } = walk(whole, rng);
        let a = engine.start(whole);
        let b = engine.start(whole);
        let mb = whole;
        let droppedPrompts = 0;
        for (let i = 0; i <= keys.length; i++) {
          expect(acceptedKeys(mb, b), `${texts.join('|')} ${mode} ← ${keys} at ${i}`).toEqual(
            acceptedKeys(whole, a),
          );
          expect(engine.isComplete(mb, b)).toBe(engine.isComplete(whole, a));
          expect(engine.committedPrompts(mb, b) + droppedPrompts).toBe(
            engine.committedPrompts(whole, a),
          );
          if (i === keys.length) break;
          const na = engine.step(whole, a, keys.charAt(i));
          const nb = engine.step(mb, b, keys.charAt(i));
          if (na === null || nb === null) throw new Error('a key of the walk was rejected');
          a = na;
          const r = engine.compact(mb, nb);
          droppedPrompts += mb.promptStarts.length - r.m.promptStarts.length;
          mb = r.m;
          b = r.s;
        }
      }
    }
  });

  it('timings are ordered, inside the typed keys, and never overlap', () => {
    for (const texts of cases) {
      const m = engine.compile(prompts(...texts), 'learner');
      const { state } = walk(m, rng);
      const timings = engine.committedTimings(m, state);
      let previous = -1;
      for (const t of timings) {
        expect(t.firstKey).toBeLessThanOrEqual(t.lastKey);
        expect(t.firstKey).toBeGreaterThan(previous);
        expect(t.lastKey).toBeLessThan(state.keys);
        previous = t.lastKey;
      }
    }
  });
});
