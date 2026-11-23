import { isLearnKanaKey } from '../log-codec';
import type { LearnKanaKey, Track } from '../types';
import raw from './kana-keys.json';

export type KanaKeys = Readonly<Record<Track, readonly LearnKanaKey[]>>;

/** The kana keys of both tracks in track order; a test in `apps/web` keeps them equal to the engine's table. */
export const KANA_KEYS: KanaKeys = {
  hiragana: raw.hiragana.filter(isLearnKanaKey),
  katakana: raw.katakana.filter(isLearnKanaKey),
};
