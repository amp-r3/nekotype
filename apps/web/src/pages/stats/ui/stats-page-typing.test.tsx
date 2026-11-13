// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { TestResult } from '@nekotype/shared/types';
import { getDatabase } from '@/shared/lib';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { StatsPage } from './stats-page';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('stats');

// A file of its own: the typing store is read once per page load, so the records are seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

// The page reads the stores, then the section reads the results: several turns of the event loop.
async function until(done: () => boolean): Promise<void> {
  for (let turn = 0; turn < 100 && !done(); turn++) await act(settle);
}

function result(n: number, patch: Partial<TestResult> = {}): TestResult {
  return {
    id: `r${String(n).padStart(2, '0')}`,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: n * 100_000,
    endedAt: n * 100_000 + 60_000,
    durationMs: 60_000,
    tokens: 100,
    erroredTokens: 5,
    items: 20,
    keystrokes: 150,
    rejectedKeystrokes: 6,
    assisted: 0,
    kpm: 60 + n,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c',
    appVersion: 'a',
    ...patch,
  };
}

describe('stats page: typing section', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows the bests, the chart without repeats and the history in pages of 10', async () => {
    // 12 tests, oldest first; the 11th is a repeat and the 12th a count test of phrases.
    const results = Array.from({ length: 12 }, (_, i) =>
      result(i + 1, {
        ...(i === 10 ? { repeated: true } : {}),
        ...(i === 11
          ? { content: 'phrases', config: { kind: 'count', prompts: 25 }, durationMs: 12_540 }
          : {}),
      }),
    );
    const db = await getDatabase();
    for (const item of results) await db.put('results', item.id, { ...item, synced: 0 });
    await db.put('records', 'current', {
      'words|hiragana|learner|time:60': { best: { kpm: 70, resultId: 'r10' }, recent: [] },
      'phrases|hiragana|learner|count:25': { best: { kpm: 72, resultId: 'r12' }, recent: [] },
    });
    await db.put('delta', 'typing', {
      kanaStats: {},
      counters: { started: { typing: 14, learn: 0 }, finished: { typing: 12, learn: 0 } },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await until(() => container.querySelector('[data-testid="history-row"]') !== null);
    await until(() => container.querySelector('[data-testid="stats-kpm-chart"]') !== null);

    // Typing data alone is enough for the page: no empty state, though nothing was learned.
    expect(container.textContent).not.toContain(t('stats.empty.title'));
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual([
      t('stats.learn.title'),
      t('stats.typing.title'),
      t('stats.counters.title'),
    ]);

    const bests = Array.from(container.querySelectorAll('[data-testid="stats-bests"] tr')).map(
      (item) => item.textContent,
    );
    expect(bests).toEqual([
      'phrases · hiragana · relaxed · 2572 kpm',
      'words · hiragana · relaxed · 60 s70 kpm',
    ]);

    // 11 points in one line, so none is marked (design ResultChart: only isolated points are);
    // the repeat is not on the chart.
    const chart = container.querySelector('[data-testid="stats-kpm-chart"]');
    expect(chart?.querySelectorAll('[data-testid="chart-dot"]')).toHaveLength(0);
    expect(chart?.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(11);
    expect(
      Array.from(chart?.querySelectorAll('[data-testid="axis-tick"]') ?? []).map(
        (tick) => tick.textContent,
      ),
    ).toEqual(['0', '60', '120']);
    const svg = chart?.querySelector('svg');
    await act(() => {
      svg?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(chart?.querySelector('[data-testid="chart-tip"]')?.textContent).toBe(
      t('stats.typing.tip', { n: 1, kpm: 61 }),
    );

    const rows = (): string[][] =>
      Array.from(container.querySelectorAll('[data-testid="history-row"]')).map((row) =>
        Array.from(row.querySelectorAll('td'))
          .slice(1)
          .map((cell) => cell.textContent),
      );
    // Newest first; a repeat is a word in the mode column and the current bests carry the badge.
    expect(rows()).toHaveLength(10);
    expect(rows().slice(0, 3)).toEqual([
      [`phrases · 25${t('badge.personalBest')}`, '72', '95%', '12.5 s'],
      ['words · 60 s · repeat', '71', '95%', '60 s'],
      [`words · 60 s${t('badge.personalBest')}`, '70', '95%', '60 s'],
    ]);
    expect(rows()[3]).toEqual(['words · 60 s', '69', '95%', '60 s']);

    const pages = container.querySelector(`nav[aria-label="${t('stats.history.pages')}"]`);
    expect(Array.from(pages?.children ?? []).map((item) => item.textContent)).toEqual([
      t('stats.history.newer'),
      '1',
      '2',
      t('stats.history.older'),
    ]);
    const older = Array.from(pages?.querySelectorAll('button') ?? []).find(
      (item) => item.textContent === t('stats.history.older'),
    );
    await act(() => {
      older?.click();
    });
    await until(() => container.querySelectorAll('[data-testid="history-row"]').length === 2);
    expect(rows()).toEqual([
      ['words · 60 s', '62', '95%', '60 s'],
      ['words · 60 s', '61', '95%', '60 s'],
    ]);
    expect(pages?.querySelector('[aria-current="page"]')?.textContent).toBe('2');

    const text = (id: string): string | null | undefined =>
      container.querySelector(`[data-testid="${id}"]`)?.textContent;
    expect(text('stats-started-typing')).toBe('14');
    expect(text('stats-finished-typing')).toBe('12');
  });
});
