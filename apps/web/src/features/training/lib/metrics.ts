import type { KeyTally } from './key-tally';
import type { PromptResult, SessionMetrics } from '../model/types';

export function computeMetrics(
  keys: KeyTally,
  promptResults: readonly PromptResult[],
  endTimeMs?: number,
): SessionMetrics {
  const correct = keys.correct;
  const rejected = keys.rejected;

  // 1 mistake per reveal / assisted prompt (Section 6.2 & 7.2)
  let assistedMistakes = 0;
  for (const p of promptResults) {
    if (p.assisted) {
      assistedMistakes += 1;
    }
  }

  const mistakes = rejected + assistedMistakes;

  let endTimestamp = endTimeMs;
  if (endTimestamp === undefined) {
    if (promptResults.length > 0) {
      const lastPrompt = promptResults[promptResults.length - 1];
      endTimestamp = lastPrompt ? lastPrompt.endedAt : keys.lastAt;
    } else {
      endTimestamp = keys.lastAt;
    }
  }

  const startTimestamp = keys.firstAt;
  const elapsedMs =
    startTimestamp !== undefined && endTimestamp !== undefined && endTimestamp > startTimestamp
      ? endTimestamp - startTimestamp
      : 0;

  const totalKeys = correct + mistakes;
  const accuracy = totalKeys > 0 ? correct / totalKeys : 1.0;

  return {
    elapsedMs,
    correct,
    mistakes,
    accuracy,
    promptsCompleted: promptResults.length,
  };
}
