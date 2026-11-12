// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { ResultsPanel } from './ui/results-panel';
import type { FinishedTest } from '@/features/training';
import { loadDictionaryPart } from '@/shared/i18n';
import type { TestResult } from '@nekotype/shared/types';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('type');

const base: TestResult = {
  id: 'r',
  content: 'words',
  script: 'hiragana',
  strictness: 'learner',
  config: { kind: 'time', seconds: 60 },
  endReason: 'complete',
  repeated: false,
  startedAt: 0,
  endedAt: 60000,
  durationMs: 60000,
  tokens: 100,
  erroredTokens: 4,
  items: 10,
  keystrokes: 110,
  rejectedKeystrokes: 4,
  assisted: 0,
  kpm: 92,
  kanaAccuracy: 0.96,
  celebratedPersonalBest: false,
  contentVersion: 't',
  appVersion: 't',
};

function finished(
  patch: Partial<Omit<FinishedTest, 'result'>> & { result?: Partial<TestResult> } = {},
): FinishedTest {
  const { result, ...rest } = patch;
  return {
    result: { ...base, ...result },
    average: null,
    previousBest: null,
    isBest: false,
    kanaDelta: { 'hiragana:つ': { attempts: 5, erroredAttempts: 3 } },
    ...rest,
  };
}

describe('results panel', () => {
  let container: HTMLDivElement;

  function show(
    f: FinishedTest | null,
    onNextTest = (): void => {},
    onRepeat = (): void => {},
  ): void {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<ResultsPanel finished={f} onNextTest={onNextTest} onRepeat={onRepeat} />, container);
  }

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  const text = (): string => container.textContent;

  // Spec "Keyboard": Enter on the results screen is "Next test". The button must have the focus the
  // moment the screen is on display; a key pressed right after it appears must not be lost.
  it('has the focus on Next test as soon as it is rendered, with no wait for an effect', () => {
    let started = 0;
    show(finished(), () => {
      started += 1;
    });
    const next = container.querySelector('button');
    expect(next?.textContent).toContain('Next Test');
    expect(document.activeElement).toBe(next);
    next?.click();
    expect(started).toBe(1);
  });

  it('offers Repeat after Next test, and a click on it repeats', () => {
    let repeated = 0;
    show(finished(), undefined, () => {
      repeated += 1;
    });
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Next Test'),
      'Repeat',
    ]);
    buttons[1]?.click();
    expect(repeated).toBe(1);
  });

  it('offers Next test alone while the result is being saved', () => {
    show(null);
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.querySelector('[data-testid="results-panel"]')).toBeNull();
  });

  it('a first test: mode line, KPM, accuracy and time, no comparisons, no badge', () => {
    show(finished());
    expect(container.querySelector('[data-testid="mode-line"]')?.textContent).toBe(
      'words · hiragana · relaxed · 60 s',
    );
    expect(text()).toContain('92');
    expect(text()).toContain('96 %');
    expect(text()).toContain('60 s');
    expect(text()).not.toContain('vs ');
    expect(text()).not.toContain('personal best');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('a later test: the comparisons with the average and the personal best', () => {
    show(finished({ average: 84, previousBest: 101 }));
    expect(text()).toContain('+8 vs average (84)');
    expect(text()).toContain('−9 vs personal best (101)');
  });

  it('a personal best: badge, cat and the previous best instead of the best line', () => {
    show(finished({ average: 84, previousBest: 89, isBest: true }));
    expect(text()).toContain('personal best');
    expect(text()).toContain('+3 vs previous best (89)');
    expect(container.querySelector('[role="img"] svg')).not.toBeNull();
  });

  it('a personal best without a previous one: the badge and the cat only', () => {
    show(finished({ isBest: true }));
    expect(text()).toContain('personal best');
    expect(text()).not.toContain('vs ');
    expect(container.querySelector('[role="img"] svg')).not.toBeNull();
  });

  it('lists the mistyped kana with the spellings and the errors', () => {
    show(finished());
    const row = container.querySelector('[data-testid="weak-kana"] li');
    expect(row?.textContent).toContain('つ');
    expect(row?.textContent).toContain('tsu · tu');
    expect(row?.textContent).toContain('3');
  });

  it('has no mistyped kana section without errors', () => {
    show(finished({ kanaDelta: {} }));
    expect(container.querySelector('[data-testid="weak-kana"]')).toBeNull();
  });

  it('states why an idle or hidden test ended', () => {
    show(finished({ result: { endReason: 'idle' } }));
    expect(text()).toContain('test ended: 5 seconds without input');
    render(null, container);
    container.remove();
    show(finished({ result: { endReason: 'hidden' } }));
    expect(text()).toContain('test ended: the tab was hidden');
  });

  it('shows the zen mode in the mode line and no notice for a manual finish', () => {
    show(finished({ result: { config: { kind: 'zen' }, endReason: 'manual' } }));
    expect(container.querySelector('[data-testid="mode-line"]')?.textContent).toBe(
      'words · hiragana · relaxed · zen',
    );
    expect(text()).not.toContain('test ended');
  });
});
