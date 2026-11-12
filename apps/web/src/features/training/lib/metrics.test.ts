import { describe, it, expect } from 'vitest';
import { computeMetrics } from './metrics';
import { createKeyTally } from './key-tally';
import type { KeyTally } from './key-tally';
import type { PromptResult } from '../model/types';

type KeystrokeEvent = { readonly at: number; readonly accepted: boolean };

function tallyOf(events: readonly KeystrokeEvent[]): KeyTally {
  const tally = createKeyTally();
  for (const e of events) tally.record(e.at, e.accepted);
  return tally.snapshot;
}

describe('metrics: pure calculation', () => {
  it('guards elapsedMs = 0 when no keystrokes or elapsed = 0', () => {
    const emptyMetrics = computeMetrics(tallyOf([]), []);
    expect(emptyMetrics.elapsedMs).toBe(0);
    expect(emptyMetrics.accuracy).toBe(1.0);
    expect(emptyMetrics.promptsCompleted).toBe(0);

    const zeroTimeKeystrokes: KeystrokeEvent[] = [
      { at: 1000, accepted: true },
      { at: 1000, accepted: true },
    ];
    const zeroMetrics = computeMetrics(tallyOf(zeroTimeKeystrokes), [], 1000);
    expect(zeroMetrics.elapsedMs).toBe(0);
    expect(zeroMetrics.accuracy).toBe(1.0);
  });

  it('computes exact metrics from fixed event list', () => {
    // 60 seconds (1 minute): 1000 to 61000
    // 50 correct keystrokes, 10 rejected keystrokes
    // 2 completed prompts: 1 perfect (0 mistakes), 1 assisted (1 reveal)
    const keystrokes: KeystrokeEvent[] = [];
    for (let i = 0; i < 50; i++) {
      keystrokes.push({ at: 1000 + i * 1000, accepted: true });
    }
    for (let i = 0; i < 10; i++) {
      keystrokes.push({ at: 51000 + i * 500, accepted: false });
    }

    const promptResults: PromptResult[] = [
      {
        key: 'word:neko',
        startedAt: 1000,
        endedAt: 25000,
        mistakes: 0,
        assisted: false,
        tokenOutcomes: [
          { kanaKey: 'hiragana:ね', mistakes: 0, ms: 500 },
          { kanaKey: 'hiragana:こ', mistakes: 0, ms: 500 },
        ],
      },
      {
        key: 'word:inu',
        startedAt: 25000,
        endedAt: 61000,
        mistakes: 10,
        assisted: true, // +1 reveal mistake
        tokenOutcomes: [
          { kanaKey: 'hiragana:い', mistakes: 5, ms: 1000 },
          { kanaKey: 'hiragana:ぬ', mistakes: 5, ms: 1000 },
        ],
      },
    ];

    const m = computeMetrics(tallyOf(keystrokes), promptResults, 61000);

    expect(m.elapsedMs).toBe(60000);
    expect(m.correct).toBe(50);
    // 10 rejected + 1 assisted = 11 mistakes
    expect(m.mistakes).toBe(11);

    // Accuracy: 50 / (50 + 11) = 50 / 61 = 0.81967...
    expect(m.accuracy).toBeCloseTo(50 / 61, 4);

    expect(m.promptsCompleted).toBe(2);
  });
});
