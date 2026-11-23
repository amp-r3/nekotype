// @vitest-environment happy-dom
// IndexedDB is available, so the storage notice does not take the line.
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { LearnPage } from './learn-page';
import { initLearn } from '@/entities/learn';
import { setAuthError, setSignInCheck } from '@/entities/user';
import { t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

// The sign-in notice and the screen behind the "another account" dialog (design decisions 118, 119).
describe('learn page after a sign-in', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // The log and the model chunk load before the page renders, so the notice under test is not
  // hidden behind the loading line on a slow first import.
  beforeAll(async () => {
    await initLearn(() => 1500);
  });
  afterEach(() => {
    render(null, container);
    setAuthError(null);
    setSignInCheck('idle');
  });

  const notice = (): string =>
    Array.from(container.querySelectorAll('[role="status"]'))
      .map((el) => el.textContent)
      .join('|');

  it('says that sign-in was cancelled, in the default tone', async () => {
    setAuthError('denied');
    render(<LearnPage />, container);
    await act(settle);
    expect(notice()).toContain(t('learn.authDenied'));
    const line = Array.from(container.querySelectorAll('[role="status"]')).find(
      (el) => el.textContent === t('learn.authDenied'),
    );
    expect(line?.className).not.toContain('text-miss');
  });

  it('says that sign-in failed as an error', async () => {
    setAuthError('failed');
    render(<LearnPage />, container);
    await act(settle);
    const line = Array.from(container.querySelectorAll('[role="status"]')).find(
      (el) => el.textContent === t('learn.authFailed'),
    );
    expect(line).toBeDefined();
    expect(line?.className ?? '').toContain('text-miss');
  });

  it('stays in its loading state until the returning sign-in is settled', async () => {
    setSignInCheck('choice');
    render(<LearnPage />, container);
    await act(settle);
    expect(notice()).toContain(t('learn.loading'));
    expect(container.querySelector('[data-testid="kana-cell"]')).toBeNull();

    await act(async () => {
      setSignInCheck('idle');
      await settle();
    });
    expect(container.querySelector('[data-testid="kana-cell"]')).not.toBeNull();
  });
});
