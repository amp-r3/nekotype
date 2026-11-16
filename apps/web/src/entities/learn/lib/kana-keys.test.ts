import { describe, it, expect } from 'vitest';
import { KANA_KEYS } from '@nekotype/shared/testing';
import { keysOfTrack } from './tracks';

describe('the kana keys of shared/testing', () => {
  it('equal the keys of the engine table, track by track', () => {
    expect(KANA_KEYS.hiragana).toEqual(keysOfTrack('hiragana'));
    expect(KANA_KEYS.katakana).toEqual(keysOfTrack('katakana'));
  });
});
