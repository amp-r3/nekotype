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

/**
 * A stored or received settings document in the current form, or null. Documents written before
 * ADR 115 carry `learn.targetMs`: the reader drops it (whatever its value) and keeps the rest, so a
 * device's settings, an outbox batch and a pulled page of an earlier version stay readable.
 */
export function readSettings(value: unknown): ValidSettings | null {
  if (isSettings(value)) return value;
  if (!isObject(value)) return null;
  const learn = value['learn'];
  if (!isObject(learn) || !('targetMs' in learn)) return null;
  const current: Record<string, unknown> = { ...value, learn: withoutTargetMs(learn) };
  return isSettings(current) ? current : null;
}

function withoutTargetMs(learn: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...learn };
  delete copy['targetMs'];
  return copy;
}
