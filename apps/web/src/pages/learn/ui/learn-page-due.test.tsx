// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { tPlural } from '@/shared/i18n';
import { LearnPage } from './learn-page';
import { key, seedLog } from '../lib/test-util';

// A file of its own: the learning store is read once per page load, so the log is seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));
const DAY = 24 * 3600 * 1000;

describe('learn page: the reason when kana are due', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('counts the due kana of both tracks in the reason, and plans the session in the outline', async () => {
    const db = await getDatabase();
    await seedLog(db, Date.now() - 30 * DAY, (store, clock) => {
      for (const kana of ['あ', 'い']) {
        store.introduce(key(kana));
        for (let i = 0; i < 5; i++) {
          clock.time += 40_000;
          store.recordAnswer({
            task: 'recall',
            key: key(kana),
            ok: true,
            keystrokes: [{ t: 700, accepted: true }],
            hint: false,
            wrong: null,
            alt: null,
          });
        }
      }
      // A katakana kana learned a month ago counts too: `continue` reviews both tracks.
      store.introduce('katakana:ア');
      for (let i = 0; i < 5; i++) {
        clock.time += 40_000;
        store.recordAnswer({
          task: 'recall',
          key: 'katakana:ア',
          ok: true,
          keystrokes: [{ t: 700, accepted: true }],
          hint: false,
          wrong: null,
          alt: null,
        });
      }
      // Introduced and not learned: it carries no due mark and is not counted.
      store.introduce(key('う'));
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);

    expect(container.querySelector('[data-testid="home-reason"]')?.textContent).toBe(
      tPlural('learn.reason.review', 3),
    );
    expect(container.querySelector('[data-testid="home-reason"]')?.textContent).toBe(
      '3 kana are due for review',
    );
    // The outline comes from the insights, a moment after the reason.
    for (
      let i = 0;
      i < 100 && container.querySelector('[data-testid="home-outline"]') === null;
      i++
    ) {
      await act(settle);
    }
    expect(container.querySelector('[data-testid="home-outline"]')?.textContent).toMatch(
      /^about \d+ tasks: \d+ reviews?/,
    );
    // The chart is on /progress: the home draws no table.
    expect(container.querySelector('[data-testid="kana-chart"]')).toBeNull();
  });
});
