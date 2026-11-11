import { createEngine, engineTable } from '@nekotype/engine';
import type { Script, Strictness } from '@nekotype/engine';

const engine = createEngine(engineTable);
const STRICTNESS: readonly Strictness[] = ['learner', 'ime'];

/** True when the engine compiles the text in both strictness modes (content.md, "Build checks"). */
export function compiles(text: string, script: Script): boolean {
  try {
    for (const strictness of STRICTNESS) {
      engine.compile([{ key: text, text, script }], strictness);
    }
    return true;
  } catch {
    return false;
  }
}
