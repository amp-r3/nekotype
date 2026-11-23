import { describe, it, expect } from 'vitest';
import { SESSION_TASKS as MODEL_SESSION_TASKS } from '@nekotype/model';
import { SESSION_TASKS } from './constants';
import { key } from './test-util';
import { wrongKana } from './wrong-kana';

describe('wrongKana', () => {
  it('names the kana a typed spelling stands for', () => {
    expect(wrongKana('hiragana', 'learner', 'su')).toBe(key('す'));
    expect(wrongKana('hiragana', 'learner', 'a')).toBe(key('あ'));
    expect(wrongKana('katakana', 'learner', 'su')).toBe('katakana:ス');
  });
  it('is null for a spelling that is not complete or belongs to no kana', () => {
    expect(wrongKana('hiragana', 'learner', 'g')).toBeNull();
    expect(wrongKana('hiragana', 'learner', 'x')).toBeNull();
    expect(wrongKana('hiragana', 'learner', '')).toBeNull();
  });
  it('is null when two kana of the track accept the spelling (ji: じ and ぢ in relaxed)', () => {
    expect(wrongKana('hiragana', 'learner', 'ji')).toBeNull();
    expect(wrongKana('hiragana', 'ime', 'ji')).toBe(key('じ'));
  });
});

describe('session constants', () => {
  it('hold as many tasks as the model plans for', () => {
    expect(SESSION_TASKS).toBe(MODEL_SESSION_TASKS);
  });
});
