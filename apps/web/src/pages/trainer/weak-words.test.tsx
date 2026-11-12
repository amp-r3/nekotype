// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { TrainerPage } from './ui/trainer-page';
import { buildPool, loadContent } from '@/entities/prompt';
import { getPracticeSettings, setContent, setScript, setWeakFocus } from '@/entities/settings';
import { resetTyping, saveTest } from '@/entities/stats';
import type { TestResult } from '@nekotype/shared/types';
import { createPromptWeights } from '@/features/training';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('D20: weak kana steer which word the trainer picks', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    setScript('katakana');
    setWeakFocus(true);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
    void resetTyping();
    setContent('words');
    setScript('both');
  });

  it('the first word shown is the one the kana weights select, not the one a flat pool would', async () => {
    const words = await loadContent('words', 'both');
    setContent('words');
    const pool = buildPool(getPracticeSettings(), words);
    const weakWord = pool[0];
    if (weakWord === undefined) throw new Error('katakana word pool is empty');

    // Only the first word's kana are weak; everything else in the pool is well known.
    const stats: Record<string, { attempts: number; erroredAttempts: number }> = {};
    for (const item of pool) {
      for (const ch of item.text) {
        stats[`katakana:${ch}`] = weakWord.text.includes(ch)
          ? { attempts: 20, erroredAttempts: 20 }
          : { attempts: 50, erroredAttempts: 0 };
      }
    }
    const result: TestResult = {
      id: 'seed',
      content: 'words',
      script: 'both',
      strictness: 'learner',
      config: { kind: 'zen' },
      endReason: 'manual',
      repeated: false,
      startedAt: 0,
      endedAt: 1,
      durationMs: 1,
      tokens: 0,
      erroredTokens: 0,
      items: 1,
      keystrokes: 0,
      rejectedKeystrokes: 0,
      assisted: 0,
      kpm: 0,
      kanaAccuracy: 1,
      celebratedPersonalBest: false,
      contentVersion: 'test',
      appVersion: 'test',
    };
    await saveTest({ result, kanaDelta: stats, startedIncrement: 1 });

    // A roll inside the weak word's share of the weighted pool, but beyond the first
    // item of a flat pool: only weights applied to words can make this pick the weak word.
    const weights = createPromptWeights()(pool, stats);
    let total = 0;
    for (const item of pool) total += weights.get(item.key) ?? 1;
    const share = (weights.get(weakWord.key) ?? 0) / total;
    const roll = share * 0.9;
    expect(roll * pool.length).toBeGreaterThan(1);
    vi.spyOn(Math, 'random').mockReturnValue(roll);

    render(<TrainerPage />, container);
    await settle();

    const shown = container.querySelector('[data-testid="prompt-text"]')?.textContent ?? '';
    expect(shown).toBe(weakWord.text);
  });
});
