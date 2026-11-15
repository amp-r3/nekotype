# Input sources

Part of the [architecture description](README.md) of the current code.

The input layer feeds one stream of `KeyIntent`s from several sources (ADR 038, spec [Frontend](../spec/frontend.md)). `shared/lib/input/input-adapter.ts` classifies a key or a character; `shared/lib/input/input-source.ts` listens to the DOM:

```
[ keydown (desktop) ]──────────┐
[ beforeinput insertText ]─────┤
[ input diff (Gboard) ]────────┼─► [ input-source ] ─► KeyIntent { kind: 'char', char: 'k' }
[ On-Screen Touch Pad ]────────┘          │                              │
                                  notices │ (IME, layout)                ▼
                                          ▼                         [ Session ]
                                   [ TestStage ]                         │
                                                                         ▼
                                                                 [ NFA Engine.step ]
```

- `keydown` with a Latin letter, `-` or `'` is handled at once and cancelled. `Unidentified` (mobile) and `Process` (IME) are skipped.
- `beforeinput` of type `insertText` is handled and cancelled; when it cannot be cancelled (Gboard composition), `input` compares the field with the last value and processes only the characters added at its end. The field is cleared when a composition ends and after every input that is not part of one.
- A letter outside the Latin alphabet is not translated by `event.code`: it is dropped without a mistake and asks for the layout. Kana or kanji ask to turn the IME off.
- Latin text of a composition is held until the IME is shown to be off (a latin vowel, the end of a composition without kana, or a key typed directly); kana drop it (ADR 051). A latin vowel in a composition also hides the IME notice.
- A repeated `keydown` is cancelled and is not input. Ctrl/Cmd+Enter is cancelled only when `Session.canFinish()` says it would end a test.
- Typing outside the field returns the focus to it, except in another text field or while a dialog is open.

## Implementing a Mobile / On-Screen Touch Keyboard

1. Create a touch keyboard component in `apps/web/src/features/training/ui/touch-keyboard.tsx`.
2. When the user taps a virtual key button (e.g. `'k'`, `'a'`, or `Esc`), dispatch the intent directly:
   ```ts
   controller.handleIntent({ kind: 'char', char: 'k' });
   ```
3. No DOM `<input>` refocusing or composition hooks are needed for virtual keys; the session processes the intent directly.
