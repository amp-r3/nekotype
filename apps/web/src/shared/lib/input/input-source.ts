import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';
import { classifyChar, classifyKeyDown, isJapaneseText } from './input-adapter';
import { startKeystrokeProbe } from './latency-probe';
import type { InputClass, KeyIntent } from './input-adapter';

export type InputSourceDeps = {
  readonly onIntent: (intent: KeyIntent) => void;
  // Where keydown is listened to; the document, unless a test passes another.
  readonly target?: EventTarget;
  readonly isDialogOpen?: () => boolean;
  // Whether Ctrl/Cmd+Enter would end a test now. When it would not, the key is left to the browser.
  readonly canFinish?: () => boolean;
};

export type InputSource = {
  // "Turn off the Japanese IME": composition data held kana or kanji.
  readonly imeNotice: ReadonlySignal<boolean>;
  // "Switch your keyboard layout to English": a letter outside the Latin alphabet was typed.
  readonly layoutNotice: ReadonlySignal<boolean>;
  // Starts listening on the document and on the hidden input. Returns the function that stops it.
  readonly bind: (input: HTMLInputElement) => () => void;
};

// Latin vowels: a Latin one in a composition shows the IME is off.
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function isOtherTextField(target: EventTarget | null, input: HTMLInputElement): boolean {
  if (!(target instanceof HTMLElement) || target === input) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * The hybrid input source of docs/spec/frontend.md. Three paths feed one stream of intents:
 *
 * 1. `keydown` with a Latin letter, `-` or `'` (the desktop path), cancelled so nothing is inserted;
 * 2. `beforeinput` of type `insertText`, for mobile keyboards whose keydown says `Unidentified`;
 * 3. `input`, when `beforeinput` cannot be cancelled (Gboard composition): the value is compared with
 *    the last one seen and only the characters added to its end are processed.
 *
 * Latin letters of a composition wait until the IME is shown to be off, so a Japanese IME that is on
 * cannot start a test with its placeholder letter (ADR 051). Everything else goes straight through.
 *
 * The hidden input is never read as text beyond that: it is cleared once a composition ends, and
 * after every input that is not part of one.
 */
export function createInputSource(deps: InputSourceDeps): InputSource {
  const imeNotice = signal(false);
  const layoutNotice = signal(false);

  const bind = (input: HTMLInputElement): (() => void) => {
    const target = deps.target ?? document;
    let lastValue = '';
    let composing = false;
    // Latin composition text is held until it is clear the IME is off (frontend.md, input source 7):
    // with the IME on, `k` is a Latin placeholder that becomes か. `imeOff` is that proof.
    let imeOff = false;
    let held: KeyIntent[] = [];

    const release = (): void => {
      const queue = held;
      held = [];
      for (const cls of queue) deps.onIntent(cls);
    };

    // Kana appeared: the held letters were the start of a conversion, not input.
    const imeIsOn = (): void => {
      held = [];
      imeOff = false;
      imeNotice.value = true;
    };

    const dialogOpen = (): boolean =>
      deps.isDialogOpen ? deps.isDialogOpen() : Boolean(document.querySelector('dialog[open]'));

    // `typed` is true for a character typed straight into the field, false for composition text.
    const dispatch = (cls: InputClass, typed: boolean): void => {
      if (cls.kind === 'foreign') {
        layoutNotice.value = true;
        return;
      }
      if (cls.kind === 'japanese') {
        imeIsOn();
        return;
      }
      if (cls.kind === 'char') {
        layoutNotice.value = false;
        // Direct typing proves the IME is off. So does a Latin vowel in a composition: an IME that
        // is on would have turned it into kana. A consonant proves nothing and waits.
        if (typed || VOWELS.has(cls.char)) {
          imeOff = true;
          imeNotice.value = false;
          release();
        } else if (!imeOff) {
          held.push(cls);
          return;
        }
      }
      if (cls.kind !== 'ignore') deps.onIntent(cls);
    };

    const dispatchText = (text: string, typed: boolean): void => {
      for (const char of Array.from(text)) dispatch(classifyChar(char), typed);
    };

    const onKeyDown = (event: Event): void => {
      if (!(event instanceof KeyboardEvent)) return;
      // Modifier combinations (Ctrl, Meta, Alt) belong to the browser. The classification lets
      // only Ctrl/Cmd+Enter through, and only while it would end a test.
      const cls = classifyKeyDown(event);
      if (cls.kind === 'ignore') return;
      if (dialogOpen()) return;
      if (isOtherTextField(event.target, input)) return;
      if (cls.kind === 'finish' && deps.canFinish && !deps.canFinish()) return;
      // A held key is not input: cancelled, so it types nothing and counts nothing.
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      // Esc on a button outside the input only brings the focus back; it is not a hint.
      if (cls.kind === 'reveal' && event.target !== input) {
        event.preventDefault();
        input.focus();
        return;
      }

      const endProbe = startKeystrokeProbe();
      event.preventDefault();
      if (event.target !== input) input.focus();
      dispatch(cls, true);
      endProbe?.();
    };

    const onBeforeInput = (event: Event): void => {
      if (!(event instanceof InputEvent)) return;
      // Composition text and everything else is read from the `input` event.
      if (event.inputType !== 'insertText' || event.isComposing || !event.cancelable) return;
      event.preventDefault();
      if (event.data !== null) dispatchText(event.data, true);
    };

    const onInput = (event: Event): void => {
      const value = input.value;
      const type = event instanceof InputEvent ? event.inputType : '';
      // Composition text is recognised by its own type as well as by the composition events, so
      // the field is not cleared in the middle of a word if an event arrives out of order.
      const inComposition =
        composing ||
        type === 'insertCompositionText' ||
        (event instanceof InputEvent && event.isComposing);
      // A replacement (a suggestion, an IME conversion), a paste or a deletion is not typing.
      const isTyping = type === 'insertText' || type === 'insertCompositionText';
      if (isTyping && value.length > lastValue.length && value.startsWith(lastValue)) {
        dispatchText(value.slice(lastValue.length), !inComposition);
      }
      lastValue = value;
      if (!inComposition) {
        input.value = '';
        lastValue = '';
      }
    };

    const onCompositionStart = (): void => {
      composing = true;
    };

    const onCompositionUpdate = (event: Event): void => {
      if (event instanceof CompositionEvent && isJapaneseText(event.data)) imeIsOn();
    };

    const onCompositionEnd = (event: Event): void => {
      composing = false;
      // A composition that ended without kana was Latin text after all.
      if (event instanceof CompositionEvent && isJapaneseText(event.data)) imeIsOn();
      else release();
      input.value = '';
      lastValue = '';
    };

    target.addEventListener('keydown', onKeyDown);
    input.addEventListener('beforeinput', onBeforeInput);
    input.addEventListener('input', onInput);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionupdate', onCompositionUpdate);
    input.addEventListener('compositionend', onCompositionEnd);

    return () => {
      target.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('beforeinput', onBeforeInput);
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionupdate', onCompositionUpdate);
      input.removeEventListener('compositionend', onCompositionEnd);
      held = [];
      imeNotice.value = false;
      layoutNotice.value = false;
    };
  };

  return { imeNotice, layoutNotice, bind };
}
