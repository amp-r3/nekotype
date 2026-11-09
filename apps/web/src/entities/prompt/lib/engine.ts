import { createEngine, createErrorLog, engineTable } from '@nekotype/engine';
import type { Engine, KanaKey } from '@nekotype/engine';

export type {
  Token,
  Matcher,
  Position,
  MatchState,
  EngineView,
  TokenTiming,
  ErrorLog,
} from '@nekotype/engine';

// The engine is created without side effects, and every function is a wrapper: reading a property
// of the created engine at the top level counts as a side effect, which would keep this module (and
// the whole matcher) in the initial chunk for the first screen's `canonicalFor`.
const engine = /* @__PURE__ */ createEngine(engineTable);

export const compile: Engine['compile'] = (...args) => engine.compile(...args);
export const extend: Engine['extend'] = (...args) => engine.extend(...args);
export const start: Engine['start'] = (...args) => engine.start(...args);
export const step: Engine['step'] = (...args) => engine.step(...args);
export const isComplete: Engine['isComplete'] = (...args) => engine.isComplete(...args);
export const committedPrompts: Engine['committedPrompts'] = (...args) =>
  engine.committedPrompts(...args);
export const committedTimings: Engine['committedTimings'] = (...args) =>
  engine.committedTimings(...args);
export const settledPrompts: Engine['settledPrompts'] = (...args) => engine.settledPrompts(...args);
export const view: Engine['view'] = (...args) => engine.view(...args);
export const errorTarget: Engine['errorTarget'] = (...args) => engine.errorTarget(...args);
export const compact: Engine['compact'] = (...args) => engine.compact(...args);
export const canonical: Engine['canonical'] = (...args) => engine.canonical(...args);
export const spellingsFor: Engine['spellingsFor'] = (...args) => engine.spellingsFor(...args);

export { createErrorLog };

// Statistics are stored under plain strings; this narrows one back to a KanaKey.
export function isKanaKey(value: string): value is KanaKey {
  return value.startsWith('hiragana:') || value.startsWith('katakana:');
}
