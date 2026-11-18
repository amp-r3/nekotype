import { isObject } from '../object';

/** RFC 7396 (JSON Merge Patch): the reference for what SQLite's `json_patch` does. */
export function applyMergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) return patch;
  const result = new Map<string, unknown>(isObject(target) ? Object.entries(target) : []);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) result.delete(key);
    else result.set(key, applyMergePatch(result.get(key), value));
  }
  return Object.fromEntries(result);
}
