// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInputSource } from './input-source';
import type { InputSource } from './input-source';
import type { KeyIntent } from './input-adapter';

describe('input source: the hybrid of keydown, beforeinput and input', () => {
  let input: HTMLInputElement;
  let button: HTMLButtonElement;
  let onIntent: ReturnType<typeof vi.fn<(intent: KeyIntent) => void>>;
  let source: InputSource;
  let unbind: () => void;

  const intents = (): KeyIntent[] => onIntent.mock.calls.map((call) => call[0]);
  const chars = (): string[] =>
    intents().flatMap((intent) => (intent.kind === 'char' ? [intent.char] : []));

  function keydown(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  // What a browser does for an insertion it lets happen: the value changes, then `input` fires.
  function insert(value: string, inputType = 'insertText', data: string | null = null): void {
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { inputType, data, bubbles: true }));
  }

  function beforeInput(data: string, cancelable: boolean, inputType = 'insertText'): InputEvent {
    const event = new InputEvent('beforeinput', { inputType, data, cancelable, bubbles: true });
    input.dispatchEvent(event);
    return event;
  }

  // happy-dom drops `data` from a CompositionEvent; a browser has it.
  const compose = (
    type: 'compositionstart' | 'compositionupdate' | 'compositionend',
    data = '',
  ): void => {
    const event = new CompositionEvent(type, { bubbles: true });
    Object.defineProperty(event, 'data', { value: data });
    input.dispatchEvent(event);
  };

  beforeEach(() => {
    input = document.createElement('input');
    button = document.createElement('button');
    document.body.append(input, button);
    onIntent = vi.fn<(intent: KeyIntent) => void>();
    source = createInputSource({ onIntent });
    unbind = source.bind(input);
    input.focus();
  });

  afterEach(() => {
    unbind();
    input.remove();
    button.remove();
    document.querySelectorAll('textarea, dialog').forEach((el) => {
      el.remove();
    });
  });

  describe('keydown (the desktop path)', () => {
    it('handles a Latin letter at once and cancels it, so nothing is inserted', () => {
      const event = keydown(input, 'a');
      expect(event.defaultPrevented).toBe(true);
      expect(intents()).toEqual([{ kind: 'char', char: 'a' }]);
    });

    it('lower-cases a capital: Caps Lock changes nothing', () => {
      keydown(input, 'K');
      expect(chars()).toEqual(['k']);
    });

    it('takes - and the apostrophe', () => {
      keydown(input, '-');
      keydown(input, "'");
      expect(chars()).toEqual(['-', "'"]);
    });

    it('leaves browser shortcuts alone: Ctrl+R, Ctrl+L, Cmd+A, F5, Tab', () => {
      const events = [
        keydown(input, 'r', { ctrlKey: true }),
        keydown(input, 'l', { ctrlKey: true }),
        keydown(input, 'a', { metaKey: true }),
        keydown(input, 'F5'),
        keydown(input, 'Tab'),
      ];
      for (const event of events) expect(event.defaultPrevented).toBe(false);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('Ctrl+Enter and Cmd+Enter are the finish intent, and are cancelled', () => {
      const ctrl = keydown(input, 'Enter', { ctrlKey: true });
      const meta = keydown(input, 'Enter', { metaKey: true });
      expect(ctrl.defaultPrevented).toBe(true);
      expect(meta.defaultPrevented).toBe(true);
      expect(intents()).toEqual([{ kind: 'finish' }, { kind: 'finish' }]);
    });

    it('Ctrl+Enter pressed on a button is also the finish intent', () => {
      button.focus();
      const event = keydown(button, 'Enter', { ctrlKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(intents()).toEqual([{ kind: 'finish' }]);
    });

    it('Alt+Enter and Ctrl+Alt+Enter are not ours', () => {
      expect(keydown(input, 'Enter', { altKey: true }).defaultPrevented).toBe(false);
      expect(keydown(input, 'Enter', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('Space, Enter and Backspace do nothing and are not cancelled', () => {
      for (const key of [' ', 'Enter', 'Backspace']) {
        expect(keydown(input, key).defaultPrevented).toBe(false);
      }
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('Escape in the field is the hint', () => {
      const event = keydown(input, 'Escape');
      expect(event.defaultPrevented).toBe(true);
      expect(intents()).toEqual([{ kind: 'reveal' }]);
    });

    it('skips Unidentified and Process: the character arrives later', () => {
      expect(keydown(input, 'Unidentified').defaultPrevented).toBe(false);
      expect(keydown(input, 'Process', { isComposing: true }).defaultPrevented).toBe(false);
      expect(onIntent).not.toHaveBeenCalled();
    });
  });

  describe('focus redirection', () => {
    it('a letter pressed on a button returns the focus to the field and is processed', () => {
      button.focus();
      const event = keydown(button, 'k');
      expect(document.activeElement).toBe(input);
      expect(event.defaultPrevented).toBe(true);
      expect(chars()).toEqual(['k']);
    });

    it('Escape on a button only brings the focus back: no hint', () => {
      button.focus();
      const event = keydown(button, 'Escape');
      expect(document.activeElement).toBe(input);
      expect(event.defaultPrevented).toBe(true);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('Tab and Enter on a button are left to the browser', () => {
      button.focus();
      expect(keydown(button, 'Tab').defaultPrevented).toBe(false);
      expect(keydown(button, 'Enter').defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(button);
    });

    it('Ctrl+Enter in another text field or with a dialog open is not intercepted', () => {
      const other = document.createElement('textarea');
      document.body.append(other);
      other.focus();
      expect(keydown(other, 'Enter', { ctrlKey: true }).defaultPrevented).toBe(false);
      other.remove();

      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      document.body.append(dialog);
      expect(keydown(button, 'Enter', { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('keys in another text field are not intercepted', () => {
      const other = document.createElement('textarea');
      document.body.append(other);
      other.focus();
      const event = keydown(other, 'a');
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(other);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('nothing is intercepted while a dialog is open', () => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      document.body.append(dialog);
      button.focus();
      const event = keydown(button, 'a');
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(button);
      expect(onIntent).not.toHaveBeenCalled();
    });
  });

  describe('a keyboard layout that is not Latin (D15)', () => {
    it('a Cyrillic letter is cancelled, is not input, and asks to switch the layout', () => {
      const event = keydown(input, 'ф');
      expect(event.defaultPrevented).toBe(true);
      expect(onIntent).not.toHaveBeenCalled();
      expect(source.layoutNotice.value).toBe(true);
    });

    it('the notice goes away at the next Latin character', () => {
      keydown(input, 'ф');
      keydown(input, 'ы');
      expect(source.layoutNotice.value).toBe(true);
      keydown(input, 'a');
      expect(source.layoutNotice.value).toBe(false);
      expect(chars()).toEqual(['a']);
    });

    it('a digit or a space does not clear it', () => {
      keydown(input, 'ф');
      keydown(input, '1');
      keydown(input, ' ');
      expect(source.layoutNotice.value).toBe(true);
    });

    it('works the same through beforeinput', () => {
      const event = beforeInput('ф', true);
      expect(event.defaultPrevented).toBe(true);
      expect(source.layoutNotice.value).toBe(true);
      expect(onIntent).not.toHaveBeenCalled();
    });
  });

  describe('beforeinput (mobile keyboards whose keydown says Unidentified)', () => {
    it('handles insertText and cancels it, one intent per character', () => {
      keydown(input, 'Unidentified');
      const event = beforeInput('ka', true);
      expect(event.defaultPrevented).toBe(true);
      expect(chars()).toEqual(['k', 'a']);
      expect(input.value).toBe('');
    });

    it('a space is swallowed without an intent', () => {
      const event = beforeInput(' ', true);
      expect(event.defaultPrevented).toBe(true);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('leaves other input types alone', () => {
      expect(beforeInput('', true, 'deleteContentBackward').defaultPrevented).toBe(false);
      expect(beforeInput('kaki', true, 'insertFromPaste').defaultPrevented).toBe(false);
      expect(onIntent).not.toHaveBeenCalled();
    });
  });

  describe('input fallback (beforeinput cannot be cancelled: Gboard)', () => {
    it('Latin composition: only the characters added at the end are processed', () => {
      compose('compositionstart');
      beforeInput('k', false, 'insertCompositionText');
      insert('k', 'insertCompositionText');
      compose('compositionupdate', 'k');
      insert('ka', 'insertCompositionText');
      compose('compositionupdate', 'ka');
      insert('kak', 'insertCompositionText');
      compose('compositionupdate', 'kak');
      expect(chars()).toEqual(['k', 'a', 'k']);
      // The field is not cleared during composition.
      expect(input.value).toBe('kak');
    });

    it('does not show the IME notice for Latin composition', () => {
      compose('compositionstart');
      for (const data of ['k', 'ka', 'kak']) {
        insert(data, 'insertCompositionText');
        compose('compositionupdate', data);
      }
      expect(source.imeNotice.value).toBe(false);
    });

    it('clears the field when the composition ends, and the next one starts afresh', () => {
      compose('compositionstart');
      insert('ka', 'insertCompositionText');
      compose('compositionend', 'ka');
      expect(input.value).toBe('');

      compose('compositionstart');
      insert('n', 'insertCompositionText');
      compose('compositionend', 'n');
      expect(chars()).toEqual(['k', 'a', 'n']);
    });

    it('a suggestion that replaces the word is not typed again', () => {
      compose('compositionstart');
      insert('ka', 'insertCompositionText');
      insert('kana', 'insertCompositionText');
      // The keyboard swaps the word for another that does not start with it.
      insert('nekotype', 'insertReplacementText');
      insert('cat', 'insertCompositionText');
      expect(chars()).toEqual(['k', 'a', 'n', 'a']);
    });

    it('a deletion shortens the value and the next addition counts from there', () => {
      compose('compositionstart');
      insert('ka', 'insertCompositionText');
      insert('k', 'deleteCompositionText');
      insert('ke', 'insertCompositionText');
      expect(chars()).toEqual(['k', 'a', 'e']);
    });

    it('composition text is recognised by its type when compositionstart is missing', () => {
      // Out of order: the first input arrives before any composition event.
      insert('n', 'insertCompositionText');
      compose('compositionstart');
      insert('nn', 'insertCompositionText');
      expect(input.value).toBe('nn');
      // Consonants wait for proof; the end of a composition without kana releases them.
      expect(chars()).toEqual([]);
      compose('compositionend', 'nn');
      expect(chars()).toEqual(['n', 'n']);
    });

    it('a plain insertion that could not be cancelled is processed once and cleared', () => {
      insert('k', 'insertText');
      expect(chars()).toEqual(['k']);
      expect(input.value).toBe('');
      insert('a', 'insertText');
      expect(chars()).toEqual(['k', 'a']);
    });

    it('a paste is not typed', () => {
      insert('kakikukeko', 'insertFromPaste');
      expect(onIntent).not.toHaveBeenCalled();
      expect(input.value).toBe('');
    });

    it('a Cyrillic composition asks for the layout and is not input', () => {
      compose('compositionstart');
      insert('ф', 'insertCompositionText');
      expect(source.layoutNotice.value).toBe(true);
      expect(onIntent).not.toHaveBeenCalled();
    });
  });

  describe('a Japanese IME that is on (desktop)', () => {
    it('shows the notice once the composition holds kana, and does not type the conversion', () => {
      // The first key reaches the field as Latin text, then the IME converts it.
      keydown(input, 'Process', { isComposing: true });
      compose('compositionstart');
      insert('k', 'insertCompositionText');
      compose('compositionupdate', 'k');
      expect(source.imeNotice.value).toBe(false);

      keydown(input, 'Process', { isComposing: true });
      insert('か', 'insertCompositionText');
      compose('compositionupdate', 'か');
      expect(source.imeNotice.value).toBe(true);

      // The held 'k' was the start of the conversion: neither it nor the kana reached the session.
      expect(chars()).toEqual([]);
      expect(source.layoutNotice.value).toBe(false);

      compose('compositionend', 'か');
      expect(input.value).toBe('');
      expect(source.imeNotice.value).toBe(true);
    });

    it('the notice stays through further composition and goes away when a letter is typed directly', () => {
      compose('compositionstart');
      insert('か', 'insertCompositionText');
      compose('compositionupdate', 'か');
      compose('compositionend', 'か');
      // The next composition starts with Latin text; that must not hide the notice.
      compose('compositionstart');
      insert('k', 'insertCompositionText');
      expect(source.imeNotice.value).toBe(true);
      compose('compositionend', 'k');

      // The IME is off now: a real keydown arrives.
      keydown(input, 'a');
      expect(source.imeNotice.value).toBe(false);
    });

    it('kana composed from nothing show the IME notice, not the layout notice', () => {
      compose('compositionstart');
      insert('か', 'insertCompositionText');
      expect(source.imeNotice.value).toBe(true);
      expect(source.layoutNotice.value).toBe(false);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('kana typed straight into the field do the same', () => {
      keydown(input, 'か');
      expect(source.imeNotice.value).toBe(true);
      expect(source.layoutNotice.value).toBe(false);
      beforeInput('き', true);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('kanji and katakana count too', () => {
      compose('compositionupdate', '漢');
      expect(source.imeNotice.value).toBe(true);
    });
  });

  describe('Latin composition waits for proof that the IME is off (frontend.md, input source 7)', () => {
    it('holds a consonant, then releases it in order with the vowel that proves the IME off', () => {
      compose('compositionstart');
      insert('k', 'insertCompositionText');
      expect(chars()).toEqual([]);
      insert('ka', 'insertCompositionText');
      expect(chars()).toEqual(['k', 'a']);
    });

    it('later letters of the composition go straight through', () => {
      compose('compositionstart');
      insert('ka', 'insertCompositionText');
      insert('kak', 'insertCompositionText');
      expect(chars()).toEqual(['k', 'a', 'k']);
    });

    it('kana drop the held letters and start over', () => {
      compose('compositionstart');
      insert('k', 'insertCompositionText');
      insert('か', 'insertCompositionText');
      compose('compositionend', 'か');
      expect(chars()).toEqual([]);
      expect(source.imeNotice.value).toBe(true);

      // The proof is forgotten: the next consonant waits again.
      compose('compositionstart');
      insert('s', 'insertCompositionText');
      expect(chars()).toEqual([]);
    });

    it('a Latin vowel hides the notice that kana raised', () => {
      compose('compositionstart');
      insert('か', 'insertCompositionText');
      compose('compositionend', 'か');
      expect(source.imeNotice.value).toBe(true);

      // The keyboard went back to Latin: an IME that is on would have made あ of it.
      compose('compositionstart');
      insert('a', 'insertCompositionText');
      expect(source.imeNotice.value).toBe(false);
      expect(chars()).toEqual(['a']);
    });

    it('a consonant does not hide the notice', () => {
      compose('compositionstart');
      insert('か', 'insertCompositionText');
      compose('compositionend', 'か');
      compose('compositionstart');
      insert('k', 'insertCompositionText');
      expect(source.imeNotice.value).toBe(true);
    });

    it('a composition that ends without kana releases what it held', () => {
      compose('compositionstart');
      insert('n', 'insertCompositionText');
      compose('compositionend', 'n');
      expect(chars()).toEqual(['n']);
    });

    it('typing directly proves the IME off for the compositions that follow', () => {
      keydown(input, 'a');
      compose('compositionstart');
      insert('k', 'insertCompositionText');
      expect(chars()).toEqual(['a', 'k']);
    });
  });

  describe('keys the browser keeps', () => {
    it('Ctrl+Enter is left alone when there is nothing to finish', () => {
      unbind();
      source = createInputSource({ onIntent, canFinish: () => false });
      unbind = source.bind(input);
      button.focus();
      const event = keydown(button, 'Enter', { ctrlKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(button);
      expect(onIntent).not.toHaveBeenCalled();
    });

    it('Ctrl+Enter finishes when it can', () => {
      unbind();
      source = createInputSource({ onIntent, canFinish: () => true });
      unbind = source.bind(input);
      const event = keydown(input, 'Enter', { ctrlKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(intents()).toEqual([{ kind: 'finish' }]);
    });

    it('a held key is cancelled and is not input', () => {
      const event = keydown(input, 'a', { repeat: true });
      expect(event.defaultPrevented).toBe(true);
      expect(onIntent).not.toHaveBeenCalled();
      keydown(input, 'a');
      expect(chars()).toEqual(['a']);
    });
  });

  describe('lifecycle', () => {
    it('stops listening and clears the notices when unbound', () => {
      keydown(input, 'ф');
      expect(source.layoutNotice.value).toBe(true);
      unbind();
      expect(source.layoutNotice.value).toBe(false);

      onIntent.mockClear();
      expect(keydown(input, 'a').defaultPrevented).toBe(false);
      beforeInput('a', true);
      expect(onIntent).not.toHaveBeenCalled();
      unbind = source.bind(input);
    });

    it('listens on the target it is given', () => {
      unbind();
      const target = new EventTarget();
      const other = createInputSource({ onIntent, target });
      unbind = other.bind(input);
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', cancelable: true }));
      expect(chars()).toEqual(['q']);
    });

    it('an isDialogOpen function replaces the DOM lookup', () => {
      unbind();
      const closed = createInputSource({ onIntent, isDialogOpen: () => true });
      unbind = closed.bind(input);
      expect(keydown(input, 'a').defaultPrevented).toBe(false);
      expect(onIntent).not.toHaveBeenCalled();
    });
  });
});
