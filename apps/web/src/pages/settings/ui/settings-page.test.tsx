// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { SettingsPage } from './settings-page';
import {
  initLearn,
  introduce,
  keyOf,
  learnView,
  legacyInitLearn,
  legacyIntroduce,
  legacyLearnState,
} from '@/entities/learn';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { learnTargetMs } from '@/entities/settings';
import { initUser } from '@/entities/user';
import { createMemoryDb } from '@/shared/lib';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('settings');

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((el) =>
    el.textContent.includes(label),
  );
  if (!found) throw new Error(`no button "${label}"`);
  return found;
}

describe('settings page: Reset progress', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('also clears the learning state', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const key = keyOf('hiragana', 'あ');
    await legacyInitLearn(() => 1500);
    legacyIntroduce(key);
    expect(Object.keys(legacyLearnState.value.entries)).toHaveLength(1);
    await initLearn(() => 1500);
    introduce(key);
    expect(learnView.value?.kana.get(key)?.state).toBe('learning');

    render(<SettingsPage />, container);
    await act(() => {
      button(container, t('settings.data.resetAction')).click();
    });
    await act(() => {
      const dialog = container.querySelector('dialog');
      if (dialog === null) throw new Error('no dialog');
      button(dialog, t('reset.action')).click();
    });
    await act(settle);

    expect(legacyLearnState.value.entries).toEqual({});
    expect(learnView.value?.kana.get(key)?.state).toBe('locked');
  });

  it('changes the target answer time with a select of nine values', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<SettingsPage />, container);
    const select = container.querySelector<HTMLSelectElement>('[data-testid="settings-target-ms"]');
    if (!select) throw new Error('no select');
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(
      [1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000].map((ms) => `${String(ms)} ms`),
    );
    expect(select.value).toBe('1500');
    await act(() => {
      select.value = '2250';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(learnTargetMs.value).toBe(2250);
  });

  it('is in sections, with what each setting does, and no range input', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<SettingsPage />, container);
    const headings = Array.from(container.querySelectorAll('h2')).filter(
      (heading) => heading.closest('dialog') === null,
    );
    expect(headings.map((heading) => heading.textContent)).toEqual([
      t('settings.learn.title'),
      t('settings.data.title'),
      t('settings.account.title'),
    ]);
    expect(container.textContent).toContain(t('settings.learn.strictnessHint'));
    expect(container.textContent).toContain(t('settings.learn.targetHint'));
    expect(container.querySelector('input[type="range"]')).toBeNull();
    // The labels are lower case.
    expect(t('settings.learn.strictness')).toBe('learning strictness');
    expect(t('settings.data.reset')).toBe('reset progress');
  });
});

describe('settings page: account section', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows a guest what signing in gives, and the two buttons on the production host', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    await initUser(createMemoryDb(), 'nekotype.pages.dev');
    render(<SettingsPage />, container);
    await act(settle);
    expect(container.textContent).toContain(t('settings.account.guest'));
    button(container, t('settings.account.google'));
    button(container, t('settings.account.github'));
    expect(container.textContent).toContain(t('settings.data.reset'));
  });

  it('offers nothing to press on a preview (D20)', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    await initUser(createMemoryDb(), 'abc123.nekotype.pages.dev');
    render(<SettingsPage />, container);
    await act(settle);
    expect(container.textContent).toContain(t('settings.account.guest'));
    expect(container.textContent).not.toContain(t('settings.account.google'));
    expect(container.textContent).not.toContain(t('settings.account.github'));
  });

  it.each([false, true])(
    'hides reset progress from a signed-in user (expired session: %s, A33)',
    async (expired) => {
      container = document.createElement('div');
      document.body.appendChild(container);
      const db = createMemoryDb();
      await db.put('meta', 'userId', 'user-1');
      if (expired) await db.put('meta', 'sessionExpired', true);
      await initUser(db, 'nekotype.pages.dev');
      render(<SettingsPage />, container);
      await act(settle);
      expect(container.textContent).not.toContain(t('settings.data.reset'));
      expect(container.textContent).not.toContain(t('settings.account.guest'));
    },
  );

  it('loads the account section for a signed-in user', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const db = createMemoryDb();
    await db.put('meta', 'userId', 'user-1');
    await initUser(db);
    render(<SettingsPage />, container);
    await vi.waitFor(() => {
      expect(container.textContent).toContain(t('settings.account.title'));
    });
  });
});
