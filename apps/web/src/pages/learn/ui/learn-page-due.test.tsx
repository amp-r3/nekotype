// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { RecallAnswer } from '@nekotype/shared/types';
import { getDatabase } from '@/shared/lib';
import { t } from '@/shared/i18n';
import { initialCounters, initialLearnState, keyOf } from '@/entities/learn';
import { LearnPage } from './learn-page';

// A file of its own: the learning store is read once per page load, so the record is seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));
const DAY = 24 * 3600 * 1000;
const answers = (ms: number): RecallAnswer[] =>
  Array.from({ length: 10 }, (_, i) => ({ at: i + 1, ms, ok: true }));

describe('learn page: review (N) and the due marks', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('counts exactly the kana that carry the due mark (ADR 062)', async () => {
    const now = Date.now();
    const a = keyOf('hiragana', 'あ');
    const i = keyOf('hiragana', 'い');
    const u = keyOf('hiragana', 'う');
    const learn = {
      ...initialLearnState(),
      entries: {
        // Due and confident: marked and counted.
        [a]: { box: 2, dueAt: now - DAY, updatedAt: 1 },
        // Due by date but slow, so learning: neither marked nor counted.
        [i]: { box: 1, dueAt: now - DAY, updatedAt: 1 },
        // Confident, not due yet.
        [u]: { box: 3, dueAt: now + DAY, updatedAt: 1 },
      },
      recent: { [a]: answers(900), [i]: answers(2400), [u]: answers(900) },
    };
    const db = await getDatabase();
    await db.put('delta', 'learn', { learn, counters: initialCounters() });

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);

    const marked = container.querySelectorAll('[data-testid="kana-cell"][data-due="true"]');
    expect(Array.from(marked).map((cell) => cell.textContent)).toEqual(['あ']);
    const review = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === t('learn.review', { n: 1 }),
    );
    expect(review?.hasAttribute('disabled')).toBe(false);
  });
});
