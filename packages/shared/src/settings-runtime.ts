import type { ValidSettings } from './types';
import { isObject } from './object';

function isLearnSettings(value: unknown): value is ValidSettings['learn'] {
  if (!isObject(value)) return false;
  const strictness = value['strictness'];
  if (strictness !== 'learner' && strictness !== 'ime') return false;
  const track = value['track'];
  if (track !== 'hiragana' && track !== 'katakana') return false;
  if (Object.keys(value).length !== 3) return false;
  return typeof value['sound'] === 'boolean';
}

/**
 * Strict: a document with any other key (the `typing` block of earlier versions, or `learn.targetMs`
 * before ADR 115) is not valid.
 */
export function isSettings(value: unknown): value is ValidSettings {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('learn') || !keys.includes('updatedAt')) return false;
  const updatedAt = value['updatedAt'];
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return false;
  return isLearnSettings(value['learn']);
}
