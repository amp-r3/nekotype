# Romaji engine contract

Part of the [architecture description](README.md) of the current code.

The romaji engine (`packages/engine/src/matcher/`) is a pure, immutable Non-deterministic Finite Automaton (NFA) evaluator over a **stream of prompts** (spec [Input engine rules](../spec/engine.md)). It does not touch the DOM, timers, or storage, and holds no module-level state: it is created from a kana table. `apps/web/src/entities/prompt/lib/engine.ts` binds it to the app's table (`createEngine(engineTable)`) and re-exports the functions, so the rest of the app imports them from `@/entities/prompt`.

A position is `(token, spelling, offset)` plus the keystroke indices of the path that led to it. A token whose spelling is typed in full is _done_ and waits for the first key of the next token; the spelling's `next` set limits which spellings of that token may follow (this is how a bare `n` is tied to its context). Positions of several readings live side by side, so `hon` in relaxed mode keeps both the bare `n` and the first half of `nn`.

## Public Engine API

```ts
export function createEngine(table: EngineTable): Engine;

type Engine = {
  compile(prompts: readonly PromptItem[], strictness: Strictness): Matcher;
  extend(matcher: Matcher, prompts: readonly PromptItem[]): Matcher; // old states stay valid
  start(matcher: Matcher): MatchState;
  step(matcher: Matcher, state: MatchState, char: string): MatchState | null; // null = rejected
  isComplete(matcher: Matcher, state: MatchState): boolean; // end of the stream reached
  committedPrompts(matcher: Matcher, state: MatchState): number;
  committedTimings(matcher: Matcher, state: MatchState): readonly TokenTiming[];
  settledPrompts(matcher: Matcher, state: MatchState): number; // committed, timings agreed
  extensions(matcher: Matcher, state: MatchState): ReadonlySet<string>;
  view(matcher: Matcher, state: MatchState): EngineView; // live conversion
  errorTarget(matcher: Matcher, state: MatchState): number;
  compact(matcher, state): { m: Matcher; s: MatchState; droppedTokens: number };
  canonical(matcher: Matcher, promptIndex: number): string;
  spellingsFor(key: KanaKey, strictness: Strictness): readonly string[];
  canonicalFor(key: KanaKey): string;
};
```

`createErrorLog()` is a separate pure helper for per-token mistakes and "expected kana → typed character" pairs. `Engine` members are function-typed properties, so they can be destructured. The spec's [API section](../spec/engine.md) is normative; this list only names what the app uses.

- **`step(matcher, state, char)`**: Returns a new `MatchState` if `char` advances at least one position. If rejected, returns `null` without modifying the existing state. The state counts accepted keystrokes only.
- **`committedPrompts`**: Prompts finished in every active position. A prompt ending in ん is not committed until the next key settles whether the ん was a bare `n` or `nn`.
- **`view` and `errorTarget`**: `view` gives the display position for the input field; `errorTarget` charges a rejected key or a hint to the earliest token any position is typing, but never before the prompt on display (D10, A34).
- **`compact`**: Drops the prompts counted by `settledPrompts` and rebases indices; the session calls it after every 20 committed prompts.
- `shouldAbsorb` and the 250 ms absorption window are gone (spec D3): a surplus `n` is resolved by matching the stream.
