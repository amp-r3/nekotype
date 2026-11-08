import { describe, expect, it } from 'vitest';
import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import { keyOf, keysOfTrack } from '@/entities/learn';
import { spellingsFor } from '@/entities/prompt';
import type { Strictness } from '@/entities/prompt';
import { distractorsFor, recognitionOptions } from './distractors';
import { key, seededRng } from './test-util';

const STRICTNESS: Strictness[] = ['learner', 'ime'];

function options(
  track: Track,
  answer: LearnKanaKey,
  strictness: Strictness,
  unlocked: readonly LearnKanaKey[] = keysOfTrack(track).slice(0, 5),
  mixups: Record<LearnKanaKey, number> = {},
  seed = 1,
) {
  return recognitionOptions({
    track,
    answer,
    unlocked,
    stat: { recognitions: 0, recognitionErrors: 0, mixups },
    strictness,
    rng: seededRng(seed),
  });
}

describe('recognition options', () => {
  it('has 4 distinct options in every state of both tracks, starting with the vowels', () => {
    for (const track of ['hiragana', 'katakana'] as const) {
      const keys = keysOfTrack(track);
      for (let count = 5; count <= keys.length; count++) {
        const unlocked = keys.slice(0, count);
        for (const answer of unlocked) {
          for (const strictness of STRICTNESS) {
            const list = options(track, answer, strictness, unlocked);
            expect(list).toHaveLength(4);
            expect(new Set(list).size).toBe(4);
            expect(list).toContain(answer);
          }
        }
      }
    }
  });

  it('keeps the same script', () => {
    const list = options('katakana', keyOf('katakana', 'シ'), 'learner');
    expect(list.every((k) => k.startsWith('katakana:'))).toBe(true);
  });

  it('shares no spelling with the answer in either strictness (じ/ぢ, ず/づ, お/を)', () => {
    for (const track of ['hiragana', 'katakana'] as const) {
      const keys = keysOfTrack(track);
      for (const answer of keys) {
        for (const strictness of STRICTNESS) {
          for (const seed of [1, 2, 3]) {
            const list = distractorsFor({
              track,
              answer,
              unlocked: keys,
              stat: undefined,
              strictness,
              rng: seededRng(seed),
            });
            const own = new Set(spellingsFor(answer, strictness));
            for (const other of list) {
              expect(spellingsFor(other, strictness).some((s) => own.has(s))).toBe(false);
            }
          }
        }
      }
    }
  });

  it('never offers お beside を or じ beside ぢ in relaxed mode', () => {
    const keys = keysOfTrack('hiragana');
    for (const seed of [1, 2, 3, 4, 5]) {
      const forWo = options('hiragana', key('を'), 'learner', keys, {}, seed);
      expect(forWo).not.toContain(key('お'));
      const forJi = options('hiragana', key('じ'), 'learner', keys, {}, seed);
      expect(forJi).not.toContain(key('ぢ'));
    }
  });

  it('puts the top mixup first, then a similar kana, then the same row', () => {
    const keys = keysOfTrack('hiragana');
    const list = distractorsFor({
      track: 'hiragana',
      answer: key('さ'),
      unlocked: keys,
      stat: { recognitions: 5, recognitionErrors: 2, mixups: { [key('ふ')]: 1, [key('へ')]: 3 } },
      strictness: 'learner',
      rng: seededRng(1),
    });
    expect(list[0]).toBe(key('へ'));
    expect(list[1]).toBe(key('ち'));
    expect(list).toHaveLength(3);
    expect(['し', 'す', 'せ', 'そ'].map(key)).toContain(list[2]);
  });

  it('takes at most one mixup and one similar kana', () => {
    const keys = keysOfTrack('hiragana');
    const list = distractorsFor({
      track: 'hiragana',
      answer: key('ぬ'),
      unlocked: keys,
      stat: {
        recognitions: 5,
        recognitionErrors: 5,
        mixups: { [key('ふ')]: 3, [key('へ')]: 2, [key('ほ')]: 1 },
      },
      strictness: 'learner',
      rng: seededRng(1),
    });
    const mixupHits = list.filter((k) => ['ふ', 'へ', 'ほ'].map(key).includes(k));
    // ふ as the mixup; へ and ほ are not of ぬ's row, so they cannot return as row-mates.
    expect(mixupHits).toEqual([key('ふ')]);
  });

  it('ignores a mixup that is not in the track', () => {
    const list = distractorsFor({
      track: 'hiragana',
      answer: key('あ'),
      unlocked: keysOfTrack('hiragana').slice(0, 5),
      stat: { recognitions: 1, recognitionErrors: 1, mixups: { 'katakana:ア': 5 } },
      strictness: 'learner',
      rng: seededRng(1),
    });
    expect(list.every((k) => k.startsWith('hiragana:'))).toBe(true);
  });

  it('takes the row-mates first, then unlocked kana of the rest of the track', () => {
    // ん has no similar kana; its row (w_n) gives わ and を, the first unlocked kana gives あ.
    const list = distractorsFor({
      track: 'hiragana',
      answer: key('ん'),
      unlocked: keysOfTrack('hiragana').slice(0, 5),
      stat: undefined,
      strictness: 'learner',
      rng: seededRng(1),
    });
    expect(list.slice(0, 2).sort()).toEqual([key('わ'), key('を')].sort());
    expect(list[2]).toBe(key('あ'));
  });

  it('is reproducible with the same seed', () => {
    const keys = keysOfTrack('hiragana');
    expect(options('hiragana', key('か'), 'learner', keys, {}, 7)).toEqual(
      options('hiragana', key('か'), 'learner', keys, {}, 7),
    );
  });

  it('shuffles the position of the right option', () => {
    const keys = keysOfTrack('hiragana');
    const positions = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      positions.add(options('hiragana', key('か'), 'learner', keys, {}, seed).indexOf(key('か')));
    }
    expect(positions.size).toBe(4);
  });
});
