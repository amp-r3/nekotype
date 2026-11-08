import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';
import { createInputSource } from '@/shared/lib';
import type { InputSource } from '@/shared/lib';
import type { TaskController } from '@/shared/ui/task-controller';
import type { LearnSession } from '../model/session';

export type SessionInput = {
  readonly source: InputSource;
  /** Hand the controller of a task on screen to the session and to the focus markers. */
  readonly onReady: (controller: TaskController) => void;
};

// The number row and the numeric keypad: `Digit1`–`Digit4`, `Numpad1`–`Numpad4`.
function optionIndex(event: KeyboardEvent): number {
  const match = /^(?:Digit|Numpad)([1-4])$/.exec(event.code);
  return match?.[1] === undefined ? -1 : Number(match[1]) - 1;
}

function isLinkOrControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('a, button, select, textarea, [role="radio"], dialog[open]') !== null
  );
}

/**
 * Binds a learning session to the keyboard: letters through the input source (also Esc), the
 * numbers 1–4 and Enter or Space for the choice and the pause after a wrong one, and the markers
 * of a task that lost the window or the field. The hidden field belongs to the page and keeps the
 * focus through the session. Nothing here sets component state, so a key renders nothing.
 */
export function useSessionInput(
  session: LearnSession,
  inputRef: RefObject<HTMLInputElement | null>,
): SessionInput {
  const controller = useRef<TaskController | null>(null);

  const source = useMemo(
    () =>
      createInputSource({
        onIntent: (intent) => {
          session.handleIntent(intent);
        },
        canFinish: () => false,
      }),
    [session],
  );

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null) return undefined;
    input.focus();
    const unbind = source.bind(input);
    const onFocus = (): void => {
      controller.current?.setInputFocus(true);
    };
    const onBlur = (): void => {
      controller.current?.setInputFocus(false);
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    return () => {
      unbind();
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
    };
  }, [source, inputRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const index = optionIndex(event);
      if (index >= 0 && session.phase.value === 'task') {
        event.preventDefault();
        if (!event.repeat) session.choose(index);
        return;
      }
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        session.phase.value === 'waiting' &&
        !isLinkOrControl(event.target)
      ) {
        event.preventDefault();
        if (!event.repeat) session.advance();
      }
    };
    const onWindowFocus = (on: boolean) => (): void => {
      controller.current?.setWindowFocus(on);
    };
    const onFocus = onWindowFocus(true);
    const onBlur = onWindowFocus(false);
    let wasHidden = false;
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') wasHidden = true;
      else if (wasHidden) {
        wasHidden = false;
        session.restart();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session]);

  return {
    source,
    onReady: (next) => {
      controller.current = next;
      next.setWindowFocus(document.hasFocus());
      next.setInputFocus(document.activeElement === inputRef.current);
      session.attach(next);
    },
  };
}
