// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { SettingsPage } from './settings-page';
import { introduce, keyOf, learnState } from '@/entities/learn';
import { t } from '@/shared/i18n';
import { learnTargetMs } from '@/entities/settings';

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
    introduce(keyOf('hiragana', 'あ'));
    expect(Object.keys(learnState.value.entries)).toHaveLength(1);

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

    expect(learnState.value.entries).toEqual({});
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
      t('settings.typing.title'),
      t('settings.data.title'),
    ]);
    expect(container.textContent).toContain(t('settings.learn.strictnessHint'));
    expect(container.textContent).toContain(t('settings.learn.targetHint'));
    expect(container.querySelector('input[type="range"]')).toBeNull();
    // The labels are lower case.
    expect(t('settings.learn.strictness')).toBe('learning strictness');
    expect(t('settings.data.reset')).toBe('reset progress');
  });
});
