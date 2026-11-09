// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, createRef } from 'preact';
import { act } from 'preact/test-utils';
import { t } from '@/shared/i18n';
import { SummaryScreen } from './summary-screen';
import type { SessionSummary } from '../lib/summary';

// The panel is a chunk of its own; the actions under test do not depend on it.
const summary: SessionSummary = {
  unlocked: [],
  confident: [],
  faster: [],
  slower: [],
  mixups: [],
  errors: [],
};

describe('summary screen', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  async function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    const inputRef = createRef<HTMLInputElement>();
    const onContinue = vi.fn();
    const onTable = vi.fn();
    await act(() => {
      render(
        <>
          <input ref={inputRef} />
          <SummaryScreen
            summary={summary}
            onContinue={onContinue}
            onTable={onTable}
            inputRef={inputRef}
          />
        </>,
        container,
      );
    });
    return { inputRef, onContinue, onTable };
  }

  const enter = (target: Element): void => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
  };

  it('continues on Enter from the hidden field of the page', async () => {
    const { inputRef, onContinue } = await mount();
    if (inputRef.current === null) throw new Error('no input');
    enter(inputRef.current);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('leaves Enter on a button to the button', async () => {
    const { onContinue } = await mount();
    const button = container.querySelector('button');
    if (button === null) throw new Error('no button');
    enter(button);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('goes to the table on a click of its button', async () => {
    const { onTable } = await mount();
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === t('learn.summary.toTable'),
    );
    button?.click();
    expect(onTable).toHaveBeenCalledTimes(1);
  });
});
