// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { useEnterForNext } from './use-enter-for-next';

function Probe({ onNext }: { readonly onNext: () => void }): null {
  useEnterForNext(onNext);
  return null;
}

function key(target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('useEnterForNext', () => {
  let container: HTMLDivElement;
  let onNext: () => void;

  beforeEach(() => {
    onNext = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<Probe onNext={onNext} />, container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('runs the action when the focus is on nothing, and takes the key', () => {
    const event = key(document.body);
    expect(event.defaultPrevented).toBe(true);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('leaves Enter to a link, a button and an open dialog', () => {
    const link = document.createElement('a');
    link.href = '#';
    const button = document.createElement('button');
    document.body.append(link, button);
    expect(key(link).defaultPrevented).toBe(false);
    expect(key(button).defaultPrevented).toBe(false);
    link.remove();
    button.remove();

    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    expect(key(document.body).defaultPrevented).toBe(false);
    dialog.remove();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('ignores modifiers and a held key', () => {
    key(document.body, { ctrlKey: true });
    key(document.body, { metaKey: true });
    key(document.body, { altKey: true });
    key(document.body, { shiftKey: true });
    key(document.body, { repeat: true });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('stops listening when the screen goes away', () => {
    render(null, container);
    key(document.body);
    expect(onNext).not.toHaveBeenCalled();
  });
});
