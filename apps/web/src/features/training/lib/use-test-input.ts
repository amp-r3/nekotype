import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';
import { useSignalEffect } from '@preact/signals';
import type { Session } from '../model/session';
import { createInputSource } from '@/shared/lib';
import type { InputSource } from '@/shared/lib';

export type TestInput = {
  readonly source: InputSource;
  /** The hidden field that takes the keyboard. */
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** The element that shows whether the field has the focus (`data-input-focused`). */
  readonly stageRef: RefObject<HTMLDivElement | null>;
  /** Gives the keyboard to the field. Safe inside a click handler: the focus is synchronous. */
  readonly focusInput: () => void;
  readonly onInputFocus: () => void;
  readonly onInputBlur: () => void;
};

/**
 * Everything the trainer page needs to take the keyboard: the input source bound to the hidden
 * field, and the focus. The field belongs to the page and outlives the test screen, so Restart,
 * Finish and Next test can give it the focus inside their click, which a phone needs to keep its
 * keyboard open (docs/spec/frontend.md, "Input", 9). The source listens while `active` is true; the
 * results screen is not active, so a key there is left to its own controls. The DOM is written
 * through refs, not state, so a key or a focus change renders no component (frontend.md, "Hot
 * path").
 */
export function useTestInput(session: Session, active: boolean): TestInput {
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const source = useMemo(
    () =>
      createInputSource({
        onIntent: (intent) => {
          session.handleIntent(intent);
        },
        canFinish: () => session.canFinish(),
        // A digit, a space or a letter of another layout keeps the idle wait from running out.
        onActivity: () => {
          session.noteActivity();
        },
      }),
    [session],
  );

  // Focus the field and listen to the keyboard from the first frame, so a key pressed at once is
  // not lost.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || !active) return undefined;
    input.focus();
    return source.bind(input);
  }, [source, active]);

  const markFocus = (focused: boolean): void => {
    stageRef.current?.setAttribute('data-input-focused', String(focused));
  };

  return {
    source,
    inputRef,
    stageRef,
    focusInput: () => {
      inputRef.current?.focus();
    },
    onInputFocus: () => {
      markFocus(true);
    },
    onInputBlur: () => {
      markFocus(false);
    },
  };
}

/**
 * The ref of the Finish button of a zen test, enabled while the test runs. It is enabled through
 * the DOM, not through a prop: the first key must not render the screen. A new button starts
 * disabled, as a test that has not started.
 */
export function useFinishButton(session: Session): RefObject<HTMLButtonElement | null> {
  const finishRef = useRef<HTMLButtonElement>(null);
  useSignalEffect(() => {
    // The phase is read first, always: an effect that reads nothing is never run again, and the
    // button may not exist yet (it appears when the test is switched to zen).
    const running = session.phase.value === 'running';
    if (finishRef.current) finishRef.current.disabled = !running;
  });
  return finishRef;
}
