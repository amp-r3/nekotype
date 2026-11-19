import { useLayoutEffect } from 'preact/hooks';

// A control that handles Enter itself: Enter there is its own, not the screen's action.
const OWN_ENTER =
  'a, button, input, select, textarea, summary, dialog, [contenteditable], [role=button], [role=link]';

/**
 * Enter runs the screen's main action (`go home` on the not-found screen) wherever the focus is, as
 * long as it is not on a control, a link or a dialog, which handle Enter themselves
 * (docs/spec/frontend.md, "Keyboard"). The button holds the focus when the screen opens, but a
 * click beside it moves the focus to the page, and Enter must still work then. Modifiers and a held
 * key are not "Enter".
 */
export function useEnterForNext(onNext: () => void): void {
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest(OWN_ENTER) !== null) return;
      if (document.querySelector('dialog[open]') !== null) return;
      event.preventDefault();
      onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onNext]);
}
