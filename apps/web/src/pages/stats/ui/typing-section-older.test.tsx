// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { TestResult } from '@nekotype/shared/types';
import { loadDictionaryPart, t } from '@/shared/i18n';
import { dayStart, localDay } from '@/entities/learn';
import type * as statsModule from '@/entities/stats';
import { StatsPage } from './stats-page';
import { TypingSection } from './typing-section';

// The server side of the history and the account, shared with the hoisted mocks.
const mocks = await vi.hoisted(async () => {
  const emptyList = (): unknown[] => [];
  const { signal } = await import('@preact/signals');
  return {
    older: signal<'unknown' | 'loading' | 'exhausted' | 'failed'>('unknown'),
    load: vi.fn<() => Promise<boolean>>(),
    read: { held: emptyList(), calls: 0 },
    counters: signal({
      started: { typing: 25, learn: 0 },
      finished: { typing: 25, learn: 0 },
    }),
    userId: signal<string | null>(null),
    sessionExpired: signal(false),
  };
});

vi.mock('@/entities/stats', async (importOriginal) => {
  const original = await importOriginal<typeof statsModule>();
  return {
    ...original,
    typingCounters: mocks.counters,
    olderResults: mocks.older,
    loadOlderResults: () => mocks.load(),
    readAllResults: () => {
      mocks.read.calls += 1;
      return Promise.resolve([...mocks.read.held]);
    },
  };
});
vi.mock('@/entities/user', () => ({
  userId: mocks.userId,
  sessionExpired: mocks.sessionExpired,
}));

await loadDictionaryPart('stats');

const DAY = localDay(Date.now());
const noon = (daysBack: number): number => dayStart(DAY - daysBack) + 12 * 3_600_000;

function result(n: number, endedAt: number): TestResult {
  return {
    id: `r${String(n).padStart(3, '0')}`,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: endedAt - 60_000,
    endedAt,
    durationMs: 60_000,
    tokens: 100,
    erroredTokens: 5,
    items: 20,
    keystrokes: 150,
    rejectedKeystrokes: 6,
    assisted: 0,
    kpm: 60,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c',
    appVersion: 'a',
  };
}

// Oldest first, as the store returns them: `count` results, the oldest `span` days back.
function history(count: number, span = 1): TestResult[] {
  return Array.from({ length: count }, (_, index) =>
    result(index, noon(span) + Math.round((index / count) * span) * 86_400_000 + index * 1000),
  );
}

let held: TestResult[] = [];
const hold = (rows: TestResult[]): void => {
  held = rows;
  mocks.read.held = rows;
};
let container: HTMLElement;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mocks.older.value = 'unknown';
  mocks.read.calls = 0;
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(false);
  mocks.userId.value = null;
  mocks.sessionExpired.value = false;
  hold([]);
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => {
  render(null, container);
  container.remove();
});

const section = (props: Partial<Parameters<typeof TypingSection>[0]> = {}) => (
  <TypingSection results={held} today={DAY} failed={false} onRetry={() => {}} {...props} />
);

describe('TypingSection: older results', () => {
  it('asks for older results when the last page is on show', async () => {
    hold(history(5));
    const asked = vi.fn();
    render(section({ onReachedEnd: asked }), container);
    await act(settle);
    expect(asked).toHaveBeenCalled();
  });

  it('does not ask while a later page exists, and asks on reaching the last one', async () => {
    hold(history(25));
    const asked = vi.fn();
    render(section({ onReachedEnd: asked }), container);
    await act(settle);
    expect(asked).not.toHaveBeenCalled();
    const older = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === t('stats.history.older'),
    );
    for (let page = 0; page < 2; page += 1) {
      older?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await act(settle);
    }
    expect(asked).toHaveBeenCalled();
  });

  it('does not ask when the results held reach past the start of the period', async () => {
    // The default period is 30 days; the oldest result is 40 days back.
    hold([result(0, noon(40)), ...history(3)]);
    const asked = vi.fn();
    render(section({ onReachedEnd: asked }), container);
    await act(settle);
    expect(asked).not.toHaveBeenCalled();
  });

  it('does not ask before the results are read or after a failed read', async () => {
    const asked = vi.fn();
    render(section({ results: null, onReachedEnd: asked }), container);
    await act(settle);
    render(section({ failed: true, onReachedEnd: asked }), container);
    await act(settle);
    expect(asked).not.toHaveBeenCalled();
  });

  it('shows the loading notice under the table while a request runs', async () => {
    hold(history(5));
    render(section({ loadingOlder: true }), container);
    await act(settle);
    const history_ = container.querySelector('[data-testid="stats-history"]');
    expect(history_?.parentElement?.textContent).toContain(t('stats.history.loading'));
    render(section({ loadingOlder: false }), container);
    await act(settle);
    expect(container.textContent).not.toContain(t('stats.history.loading'));
  });
});

describe('StatsPage: asking the server for older results', () => {
  async function open(): Promise<void> {
    window.location.hash = '#typing';
    render(<StatsPage />, container);
    for (let turn = 0; turn < 30; turn += 1) await act(settle);
  }

  it('a signed-in user online asks, and reads the list again after a page that added results', async () => {
    hold(history(5));
    mocks.userId.value = 'u1';
    mocks.load.mockResolvedValueOnce(true).mockResolvedValue(false);
    await open();
    // The first request added results: the list is read again, and the last page asks once more.
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(mocks.read.calls).toBeGreaterThanOrEqual(2);
  });

  it('a guest never asks', async () => {
    hold(history(5));
    await open();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('an expired session never asks', async () => {
    hold(history(5));
    mocks.userId.value = 'u1';
    mocks.sessionExpired.value = true;
    await open();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('offline never asks', async () => {
    hold(history(5));
    mocks.userId.value = 'u1';
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await open();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('stops once the server has no more', async () => {
    hold(history(5));
    mocks.userId.value = 'u1';
    mocks.older.value = 'exhausted';
    await open();
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
