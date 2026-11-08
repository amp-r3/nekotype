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
      button(container, t('app.reset')).click();
    });
    await act(() => {
      button(document.body, t('reset.action')).click();
    });
    await act(settle);

    expect(learnState.value.entries).toEqual({});
  });

  it('changes the target answer time', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<SettingsPage />, container);
    const range = container.querySelector<HTMLInputElement>('[data-testid="settings-target-ms"]');
    if (!range) throw new Error('no range');
    await act(() => {
      range.value = '2250';
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(learnTargetMs.value).toBe(2250);
  });
});
