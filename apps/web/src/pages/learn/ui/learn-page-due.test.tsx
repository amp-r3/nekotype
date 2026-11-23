// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { t } from '@/shared/i18n';
import { LearnPage } from './learn-page';
import { key, seedLog } from '../lib/test-util';

// A file of its own: the learning store is read once per page load, so the log is seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));
const DAY = 24 * 3600 * 1000;

describe('learn page: due: N and the due marks', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('counts the due kana of both tracks and marks the learned ones among them', async () => {
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

    const marked = container.querySelectorAll('[data-testid="kana-cell"][data-due="true"]');
    expect(Array.from(marked).map((cell) => cell.textContent)).toEqual(['あ', 'い']);
    expect(container.querySelector('[data-testid="learn-due"]')?.textContent).toBe(
      t('learn.due', { n: 3 }),
    );
    // Introduced kana are shown whatever their state; the rest is locked.
    const open = container.querySelectorAll('[data-testid="kana-cell"]:not([data-state="locked"])');
    expect(Array.from(open).map((cell) => cell.textContent)).toEqual(['あ', 'い', 'う']);
  });
});
