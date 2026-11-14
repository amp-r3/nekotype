// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { t, loadDictionaryPart } from '@/shared/i18n';
import type * as statsModule from '@/entities/stats';
import { StatsPage } from './stats-page';

// The history read always fails: the weak kana table must not depend on it (All time).
vi.mock('@/entities/stats', async (importOriginal) => {
  const original = await importOriginal<typeof statsModule>();
  return { ...original, readAllResults: () => Promise.reject(new Error('read failed')) };
});

await loadDictionaryPart('stats');

// A file of its own: the typing store is read once per page load, so it is seeded before the render.
const db = await getDatabase();
await db.put('delta', 'typing', {
  kanaStats: {
    'hiragana:あ': { attempts: 4, erroredAttempts: 1 },
    'katakana:ア': { attempts: 2, erroredAttempts: 0 },
  },
  counters: { started: { typing: 3, learn: 0 }, finished: { typing: 3, learn: 0 } },
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('typing section: weak kana table', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
    window.location.hash = '';
  });

  it('shows the script switch from the kana statistics although the history read failed', async () => {
    window.location.hash = '#typing';
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    for (let turn = 0; turn < 100; turn++) {
      if (container.textContent.includes(t('stats.history.error'))) break;
      await act(settle);
    }
    expect(container.textContent).toContain(t('stats.history.error'));

    const heat = container.querySelector('[data-testid="stats-heat"]');
    const radios = Array.from(heat?.querySelectorAll('[role="radio"]') ?? []);
    expect(radios).toHaveLength(2);
    const cells = (): string[] =>
      Array.from(heat?.querySelectorAll('[data-testid="heat-cell"]') ?? []).map(
        (cell) => cell.textContent,
      );
    const before = cells();
    expect(before).toContain('あ');

    await act(() => {
      radios[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(cells()).toContain('ア');
    expect(cells()).not.toEqual(before);
  });
});
