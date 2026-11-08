import { describe, expect, it } from 'vitest';
import { chooseKana, chooseTask, kanaWeight } from './task-choice';
import { answers, key, seededRng, stateWith } from './test-util';

const T = 1500;
const VOWELS = ['あ', 'い', 'う', 'え', 'お'];

function allIntroduced(recent: Record<string, ReturnType<typeof answers>>) {
  return stateWith({
    entries: Object.fromEntries(VOWELS.map((k) => [k, {}])),
    recent,
  });
}

describe('kanaWeight', () => {
  it('is 1 for a confident kana without errors', () => {
    const state = allIntroduced({ あ: answers(10, 1000) });
    expect(kanaWeight(state, key('あ'), T)).toBe(1);
  });
  it('is 5 for a kana twice as slow as the target', () => {
    const state = allIntroduced({ あ: answers(10, 3000) });
    expect(kanaWeight(state, key('あ'), T)).toBe(5);
  });
  it('is 5 for a kana wrong in half its answers', () => {
    const state = allIntroduced({ あ: answers(10, 1000, 2) });
    expect(kanaWeight(state, key('あ'), T)).toBe(5);
  });
  it('grows with the median answer time and with errors', () => {
    const at = (ms: number, okEvery = 0) =>
      kanaWeight(allIntroduced({ あ: answers(10, ms, okEvery) }), key('あ'), T);
    expect(at(1500)).toBeLessThan(at(2000));
    expect(at(2000)).toBeLessThan(at(2500));
    expect(at(1000)).toBeLessThan(at(1000, 5));
    expect(at(1000, 5)).toBeLessThan(at(1000, 3));
  });
});

describe('chooseKana', () => {
  it('returns null when nothing is introduced', () => {
    const rng = seededRng(1);
    expect(
      chooseKana({ track: 'hiragana', state: stateWith({}), targetMs: T, previous: null, rng }),
    ).toBeNull();
  });

  it('takes only introduced, unlocked kana', () => {
    const state = stateWith({ entries: { あ: {}, い: {} } });
    const rng = seededRng(2);
    for (let i = 0; i < 200; i++) {
      const picked = chooseKana({ track: 'hiragana', state, targetMs: T, previous: null, rng });
      expect([key('あ'), key('い')]).toContain(picked);
    }
  });

  it('never repeats the previous kana when another is available', () => {
    const state = allIntroduced({});
    const rng = seededRng(3);
    let previous = key('あ');
    for (let i = 0; i < 10_000; i++) {
      const picked = chooseKana({ track: 'hiragana', state, targetMs: T, previous, rng });
      expect(picked).not.toBe(previous);
      if (picked !== null) previous = picked;
    }
  });

  it('repeats the only kana', () => {
    const state = stateWith({ entries: { あ: {} } });
    expect(
      chooseKana({ track: 'hiragana', state, targetMs: T, previous: key('あ'), rng: seededRng(4) }),
    ).toBe(key('あ'));
  });

  it('takes a kana in focus half of the time when others are out of focus', () => {
    // あ is in focus (3 answers); the rest have 10 answers.
    const state = allIntroduced({
      あ: answers(3, 1000),
      い: answers(10, 1000),
      う: answers(10, 1000),
      え: answers(10, 1000),
      お: answers(10, 1000),
    });
    const rng = seededRng(5);
    let focus = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      if (
        chooseKana({ track: 'hiragana', state, targetMs: T, previous: null, rng }) === key('あ')
      ) {
        focus++;
      }
    }
    // The out-of-focus draws never pick あ, so its share is FOCUS_SHARE itself.
    expect(Math.abs(focus / n - 0.5)).toBeLessThan(0.02);
  });

  it('shares focus equally among kana in focus', () => {
    const state = allIntroduced({
      あ: answers(2, 1000),
      い: answers(2, 1000),
      う: answers(10, 1000),
      え: answers(10, 1000),
      お: answers(10, 1000),
    });
    const rng = seededRng(6);
    const counts = new Map<string, number>();
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const picked = chooseKana({ track: 'hiragana', state, targetMs: T, previous: null, rng });
      if (picked !== null) counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    const a = (counts.get(key('あ')) ?? 0) / n;
    const i = (counts.get(key('い')) ?? 0) / n;
    expect(a).toBeGreaterThan(0.23);
    expect(a).toBeLessThan(0.27);
    expect(Math.abs(a - i)).toBeLessThan(0.03);
  });

  it('takes a kana in focus with probability 1 when all are in focus', () => {
    const state = allIntroduced({ あ: answers(1, 1000) });
    const rng = seededRng(7);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const picked = chooseKana({ track: 'hiragana', state, targetMs: T, previous: null, rng });
      if (picked !== null) seen.add(picked);
    }
    expect(seen.size).toBe(5);
  });

  it('never takes a kana in focus when none is', () => {
    const recent = Object.fromEntries(VOWELS.map((k) => [k, answers(10, 1000)]));
    const state = allIntroduced(recent);
    const rng = seededRng(8);
    for (let i = 0; i < 500; i++) {
      expect(
        chooseKana({ track: 'hiragana', state, targetMs: T, previous: null, rng }),
      ).not.toBeNull();
    }
  });

  it('is monotonic in the median answer time and in errors (weights 1 : 3 : 5)', () => {
    const state = allIntroduced({
      あ: answers(10, 1500),
      い: answers(10, 2250),
      う: answers(10, 3000),
      え: answers(10, 1500),
      お: answers(10, 1500),
    });
    const rng = seededRng(9);
    const counts = new Map<string, number>();
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const picked = chooseKana({ track: 'hiragana', state, targetMs: T, previous: null, rng });
      if (picked !== null) counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    const c = (k: string) => counts.get(key(k)) ?? 0;
    expect(c('あ')).toBeLessThan(c('い'));
    expect(c('い')).toBeLessThan(c('う'));
  });

  it('weights errors: more errors, more draws', () => {
    const state = allIntroduced({
      あ: answers(10, 1000),
      い: answers(10, 1000, 5),
      う: answers(10, 1000, 3),
      え: answers(10, 1000),
      お: answers(10, 1000),
    });
    const rng = seededRng(10);
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) {
      const picked = chooseKana({ track: 'hiragana', state, targetMs: T, previous: null, rng });
      if (picked !== null) counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    const c = (k: string) => counts.get(key(k)) ?? 0;
    expect(c('あ')).toBeLessThan(c('い'));
    expect(c('い')).toBeLessThan(c('う'));
  });
});

describe('chooseTask', () => {
  it('is a recognition task with probability 1/3', () => {
    const recent = Object.fromEntries(VOWELS.map((k) => [k, answers(10, 1000)]));
    const state = allIntroduced(recent);
    const rng = seededRng(11);
    let recognition = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const task = chooseTask({ track: 'hiragana', state, targetMs: T, previous: null, rng });
      if (task?.kind === 'recognition') recognition++;
    }
    expect(Math.abs(recognition / n - 1 / 3)).toBeLessThan(0.02);
  });

  it('returns null with nothing introduced', () => {
    expect(
      chooseTask({
        track: 'hiragana',
        state: stateWith({}),
        targetMs: T,
        previous: null,
        rng: seededRng(1),
      }),
    ).toBeNull();
  });
});
