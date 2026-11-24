// @vitest-environment happy-dom
import { signal } from '@preact/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { loadDictionaryPart, t } from '@/shared/i18n';
import { setImmersive } from '@/shared/lib';
import { KEY_A, KEY_I, KEY_U, sampleView } from '../test-view';
import { closeKanaDetails, openKanaDetails, openKanaKey } from '../model/open';
import { KanaDetailsHost } from './kana-details-host';

const view = sampleView();

vi.mock('@/entities/learn', async (original) => {
  const actual: Record<string, unknown> = await original();
  return { ...actual, learnView: signal(view) };
});

await loadDictionaryPart('details');

describe('the kana details dialog', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const opener = document.createElement('button');
  opener.textContent = 'opener';
  document.body.appendChild(opener);

  afterEach(async () => {
    setImmersive(false);
    await act(() => {
      closeKanaDetails();
    });
    render(null, container);
  });

  const dialog = (): HTMLDialogElement | null => container.querySelector('dialog');

  async function open(key: typeof KEY_A): Promise<void> {
    opener.focus();
    await act(() => {
      render(<KanaDetailsHost />, container);
      openKanaDetails(key);
    });
    // The first open fetches the dialog's chunk.
    await vi.waitFor(() => {
      expect(dialog()?.open).toBe(true);
    });
  }

  it('draws nothing until a kana is opened', async () => {
    await act(() => {
      render(<KanaDetailsHost />, container);
    });
    expect(container.innerHTML).toBe('');
  });

  it('opens with the kana and its romaji as the title, and the rows', async () => {
    await open(KEY_A);
    expect(dialog()?.open).toBe(true);
    const title = dialog()?.querySelector('h2');
    expect(title?.textContent).toBe('あ a');
    expect(title?.querySelector('[lang="ja"]')?.textContent).toBe('あ');
    expect(dialog()?.getAttribute('aria-labelledby')).toBe(title?.id);
    const captions = Array.from(dialog()?.querySelectorAll('dt') ?? []).map((dt) => dt.textContent);
    expect(captions).toEqual(['state', 'memory', 'recall', 'mixed up with', 'recognition']);
    expect(dialog()?.querySelector('[data-testid="kana-details-memory"]')).not.toBeNull();
  });

  it('closes by ✕ and gives the focus back to the opener', async () => {
    await open(KEY_A);
    const close = dialog()?.querySelector<HTMLButtonElement>(
      `[aria-label="${t('details.close')}"]`,
    );
    await act(() => {
      close?.click();
    });
    expect(openKanaKey.value).toBeNull();
    expect(dialog()?.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('closes as Esc does (the dialog fires close) and gives the focus back', async () => {
    await open(KEY_I);
    await act(() => {
      dialog()?.close();
    });
    expect(openKanaKey.value).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('opens a second time after it was closed', async () => {
    await open(KEY_A);
    await act(() => {
      closeKanaDetails();
    });
    await act(() => {
      openKanaDetails(KEY_I);
    });
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.querySelector('h2')?.textContent).toBe('い i');
  });

  it('has no details for a locked kana, and none during a session', async () => {
    await open(KEY_A);
    await act(() => {
      closeKanaDetails();
    });
    await act(() => {
      openKanaDetails(KEY_U);
    });
    expect(dialog()?.open).toBe(false);
    await act(() => {
      closeKanaDetails();
    });
    setImmersive(true);
    await act(() => {
      openKanaDetails(KEY_A);
    });
    expect(dialog()?.open).toBe(false);
  });
});
