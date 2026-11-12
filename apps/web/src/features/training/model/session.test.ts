import { describe, it, expect, beforeEach, vi } from 'vitest';
import { effect } from '@preact/signals';
import { createSession } from './session';
import { AHEAD_TOKENS, HARD_BEHIND_TOKENS, MIN_AHEAD_TOKENS, MIN_TRIM_TOKENS } from './stream';
import type { Session } from './session';
import { setupSettingsResetWatcher } from './settings-watcher';
import { setTestConfig, testConfig } from '@/entities/settings';
import type { TestConfig } from '@/entities/settings';
import type { PromptItem } from '@/entities/prompt';
import type { EndedTest } from './types';
import type { Clock, Scheduler, TimeoutHandle } from '@/shared/lib';

class FakeClock implements Clock {
  currentTime = 1000;
  now(): number {
    return this.currentTime;
  }
  advance(ms: number): void {
    this.currentTime += ms;
  }
}

type ScheduledTask = {
  id: number;
  fn: () => void;
  triggerAt: number;
  interval?: number;
};

class FakeScheduler implements Scheduler {
  private nextId = 1;
  private tasks = new Map<number, ScheduledTask>();

  setTimeout(fn: () => void, ms: number): TimeoutHandle {
    const id = this.nextId++;
    this.tasks.set(id, { id, fn, triggerAt: ms });
    return { id };
  }

  clearTimeout(handle: TimeoutHandle): void {
    if (typeof handle.id === 'number') {
      this.tasks.delete(handle.id);
    }
  }

  setInterval(fn: () => void, ms: number): TimeoutHandle {
    const id = this.nextId++;
    this.tasks.set(id, { id, fn, triggerAt: ms, interval: ms });
    return { id };
  }

  clearInterval(handle: TimeoutHandle): void {
    if (typeof handle.id === 'number') {
      this.tasks.delete(handle.id);
    }
  }

  advance(ms: number): void {
    const toRun: (() => void)[] = [];
    for (const [id, task] of Array.from(this.tasks.entries())) {
      task.triggerAt -= ms;
      if (task.triggerAt <= 0) {
        toRun.push(task.fn);
        if (task.interval !== undefined) {
          task.triggerAt += task.interval;
        } else {
          this.tasks.delete(id);
        }
      }
    }
    for (const fn of toRun) {
      fn();
    }
  }
}

describe('session: timing, lifecycle and scripted typing sessions', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;

  beforeEach(() => {
    clock = new FakeClock();
    scheduler = new FakeScheduler();
  });

  // Spec D3, A15: ん at the end of a prompt takes its context from the next prompt, so a single n
  // is final only once the next key settles it; the absorption window of the baseline is gone.
  it('runs scripted session yielding exact metrics with rejected key, reveal, and ん resolved by the next prompt', () => {
    setTestConfig({ kind: 'count', prompts: 10 });

    const prompt1: PromptItem = { key: 'word:pan', text: 'パン' };
    const prompt2: PromptItem = { key: 'word:neko', text: 'ねこ' };

    const controller = createSession({
      nextPrompt: () => prompt2,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(prompt1, 'learner');
    expect(controller.phase.value).toBe('idle');
    expect(controller.currentPrompt.value?.text).toBe('パン');

    // 1. First key 'p' at time 1000 -> starts test, advances phase to running
    clock.currentTime = 1000;
    controller.handleIntent({ kind: 'char', char: 'p' });
    expect(controller.phase.value).toBe('running');
    expect(controller.romajiBuffer.value).toBe('p');
    expect(controller.correctKeystrokes.value).toBe(1);

    // 2. Key 'a' at time 1200: パ is complete, the caret stands before ン
    clock.advance(200); // 1200
    controller.handleIntent({ kind: 'char', char: 'a' });
    expect(controller.romajiBuffer.value).toBe('');
    expect(controller.caret.value).toBe(1);
    expect(controller.correctKeystrokes.value).toBe(2);

    // 3. Rejected key 'x' at time 1400 -> a mistake event on ン, buffer and caret unchanged
    clock.advance(200); // 1400
    controller.handleIntent({ kind: 'char', char: 'x' });
    expect(controller.mistake.value).toMatchObject({ kind: 'rejected', token: 1 });
    expect(controller.romajiBuffer.value).toBe('');
    expect(controller.caret.value).toBe(1);

    // 4. Key 'n' at time 1600: a bare n reaches the end of パン, so ねこ is shown, but the prompt
    // is not committed yet: the n may still turn out to be the first half of `nn`.
    clock.advance(200); // 1600
    controller.handleIntent({ kind: 'char', char: 'n' });
    expect(controller.currentPrompt.value?.text).toBe('ねこ');
    expect(controller.romajiBuffer.value).toBe('');
    expect(controller.promptResults.value).toHaveLength(0);
    expect(controller.phase.value).toBe('running');

    // 5. Second n at time 1700: accepted both as the end of `nn` and as the start of ね. The
    // prompt is now committed in every reading, but the two readings disagree on the keys of ん.
    clock.advance(100); // 1700
    controller.handleIntent({ kind: 'char', char: 'n' });
    // Two readings are alive (ン = n and the start of ね, or ン = nn); the display takes the one with
    // the shortest pending Latin, ン = nn, so the buffer is empty and the caret stands before ね.
    expect(controller.romajiBuffer.value).toBe('');
    expect(controller.caret.value).toBe(2);
    expect(controller.correctKeystrokes.value).toBe(4);
    expect(controller.promptResults.value).toHaveLength(0);

    // 6. User presses Esc (reveal) at time 2000: charged to the prompt on screen
    clock.advance(300); // 2000
    controller.handleIntent({ kind: 'reveal' });
    expect(controller.isAssisted.value).toBe(true); // 1 rejected + 1 reveal

    // 7. 'e' at time 2200 settles it: ん was a bare n. パン is recorded, ended by the key that
    // committed it (time 1700).
    clock.advance(200); // 2200
    controller.handleIntent({ kind: 'char', char: 'e' });
    expect(controller.promptResults.value).toHaveLength(1);
    const first = controller.promptResults.value[0];
    expect(first?.key).toBe('word:pan');
    expect(first?.startedAt).toBe(1000);
    expect(first?.endedAt).toBe(1700);
    expect(first?.mistakes).toBe(1);
    expect(first?.assisted).toBe(false);
    // パ: the first token of the test has no reaction time (spec metrics.md); ン: one key (1600),
    // 400 ms after the previous token, the rejected x included. The second n belongs to ね, not
    // to ん.
    expect(first?.tokenOutcomes).toEqual([
      { kanaKey: 'katakana:パ', mistakes: 0, ms: 0 },
      { kanaKey: 'katakana:ン', mistakes: 1, ms: 400 },
    ]);

    // 8. 'ko' finishes ねこ
    clock.advance(200); // 2400
    controller.handleIntent({ kind: 'char', char: 'k' });
    clock.advance(200); // 2600
    controller.handleIntent({ kind: 'char', char: 'o' });
    expect(controller.promptResults.value).toHaveLength(2);
    expect(controller.promptResults.value[1]?.assisted).toBe(true);

    // Type prompts 3 through 10 to finish count test automatically:
    for (let p = 3; p <= 10; p++) {
      for (const char of 'neko') {
        clock.advance(100);
        controller.handleIntent({ kind: 'char', char });
      }
    }

    // Automatically finished on the 10th prompt by itself!
    expect(controller.phase.value).toBe('finished');

    const m = controller.metrics.value;
    expect(m).not.toBeNull();
    if (!m) return;

    expect(m.promptsCompleted).toBe(10);
    // Correct keystrokes: p, a, n, n, e, k, o = 7 for the first two prompts + 8 * 4 = 39
    expect(m.correct).toBe(39);
    // Mistakes: 1 rejected ('x') + 1 reveal = 2
    expect(m.mistakes).toBe(2);
    // Live counters match computeMetrics derived output
    expect(controller.correctKeystrokes.value).toBe(m.correct);
  });

  it('count test (10 prompts) auto-finishes on the last prompt by itself', () => {
    setTestConfig({ kind: 'count', prompts: 10 });
    const prompt: PromptItem = { key: 'basic:a', text: 'あ' };
    const controller = createSession({
      nextPrompt: () => prompt,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(prompt, 'learner');

    // Type 'a' 10 times to complete 10 prompts
    for (let i = 1; i <= 10; i++) {
      clock.advance(100);
      controller.handleIntent({ kind: 'char', char: 'a' });
    }

    // Must be finished automatically by itself
    expect(controller.phase.value).toBe('finished');
    expect(controller.metrics.value).not.toBeNull();
    expect(controller.metrics.value?.promptsCompleted).toBe(10);
  });

  it('the shake flag clears after ~280 ms', () => {
    const prompt: PromptItem = { key: 'basic:a', text: 'あ' };
    const controller = createSession({
      nextPrompt: () => prompt,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(prompt, 'learner');

    // Each rejected keystroke is its own mistake event: the view flashes the caret for each, with
    // no timer of the session involved, even twice on the same token.
    controller.handleIntent({ kind: 'char', char: 'z' });
    const first = controller.mistake.value;
    expect(first).toMatchObject({ kind: 'rejected', token: 0 });
    controller.handleIntent({ kind: 'char', char: 'z' });
    const second = controller.mistake.value;
    expect(second).toMatchObject({ kind: 'rejected', token: 0 });
    expect(second?.seq).toBeGreaterThan(first?.seq ?? 0);
  });

  it('time test ends mid-prompt at deadline with partial prompt keystrokes counted', () => {
    setTestConfig({ kind: 'time', seconds: 15 });
    const prompt1: PromptItem = { key: 'word:pan', text: 'パン' };
    const prompt2: PromptItem = { key: 'word:neko', text: 'ねこ' };

    const controller = createSession({
      nextPrompt: () => prompt2,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(prompt1, 'learner');

    // Start at t = 1000
    clock.currentTime = 1000;
    controller.handleIntent({ kind: 'char', char: 'p' });
    expect(controller.phase.value).toBe('running');

    controller.handleIntent({ kind: 'char', char: 'a' });
    controller.handleIntent({ kind: 'char', char: 'n' });
    // Prompt 1 complete: 3 keystrokes accepted, 1 prompt completed

    // Prompt 2 (ねこ): user types 'n' and 'e'
    clock.advance(2000);
    controller.handleIntent({ kind: 'char', char: 'n' });
    controller.handleIntent({ kind: 'char', char: 'e' });
    // パン is tokens 0-1, so ね is token 2 and the caret now stands before こ.
    expect(controller.caret.value).toBe(3);

    // Now advance scheduler by 15000 ms -> deadline fires!
    clock.advance(13000); // reaches 15000 ms total test duration
    scheduler.advance(15000);

    // Test finishes mid-prompt!
    expect(controller.phase.value).toBe('finished');

    const m = controller.metrics.value;
    expect(m).not.toBeNull();
    if (!m) return;

    // Completed prompts is exactly 1 (partial prompt does not count as complete)
    expect(m.promptsCompleted).toBe(1);
    // But all keystrokes are counted (3 from prompt 1 + 2 from partial prompt 2 = 5)
    expect(m.correct).toBe(5);
    expect(m.mistakes).toBe(0);
  });

  it('resets everything on restart and changing a setting resets to idle', () => {
    const prompt: PromptItem = { key: 'word:pan', text: 'パン' };
    const controller = createSession({
      nextPrompt: () => prompt,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(prompt, 'learner');

    controller.handleIntent({ kind: 'char', char: 'p' });
    expect(controller.phase.value).toBe('running');
    expect(controller.romajiBuffer.value).toBe('p');

    // Calling reset() on controller resets state and session to idle
    controller.reset();
    expect(controller.phase.value).toBe('idle');
    expect(controller.romajiBuffer.value).toBe('');

    // Changing testConfig also resets to idle: the settings slice cannot import the session slice,
    // so the watcher (installed by the trainer) does it.
    const dispose = setupSettingsResetWatcher(() => {
      controller.reset();
    });
    controller.loadPrompt(prompt, 'learner');
    controller.handleIntent({ kind: 'char', char: 'p' });
    expect(controller.phase.value).toBe('running');

    setTestConfig({ kind: 'time', seconds: 60 });
    expect(controller.phase.value).toBe('idle');
    dispose();
  });

  it('1 Hz ticker updates tickerNow while test is running', () => {
    const prompt: PromptItem = { key: 'word:pan', text: 'パン' };
    const controller = createSession({
      nextPrompt: () => prompt,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(prompt, 'learner');

    clock.currentTime = 5000;
    controller.handleIntent({ kind: 'char', char: 'p' });
    expect(controller.tickerNow.value).toBe(5000);

    // 1 second passes:
    clock.advance(1000);
    scheduler.advance(1000);
    expect(controller.tickerNow.value).toBe(6000);

    // Another second passes:
    clock.advance(1000);
    scheduler.advance(1000);
    expect(controller.tickerNow.value).toBe(7000);
  });
});

describe('session: prompt stream (spec D3, A15)', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;

  beforeEach(() => {
    clock = new FakeClock();
    scheduler = new FakeScheduler();
  });

  const pan: PromptItem = { key: 'word:pan', text: 'パン' };
  const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };

  function type(controller: Session, keys: string): void {
    for (const char of keys) {
      clock.advance(100);
      controller.handleIntent({ kind: 'char', char });
    }
  }

  // Spec "Window": at least one prompt beyond the displayed one. The stream shows lines of text, so
  // the session keeps AHEAD_TOKENS tokens after the displayed prompt (ねこ is two tokens).
  it('keeps enough prompts after the displayed one to fill the stream, and no more than a count test needs', () => {
    let asked = 0;
    const supply = (): PromptItem => {
      asked += 1;
      return neko;
    };

    setTestConfig({ kind: 'time', seconds: 30 });
    const open = createSession({
      nextPrompt: supply,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    open.loadPrompt(neko, 'learner');
    expect(asked).toBe(AHEAD_TOKENS / 2);
    type(open, 'neko');
    // One prompt was typed, so one more is needed to keep the same number of tokens ahead.
    expect(asked).toBe(AHEAD_TOKENS / 2 + 1);

    setTestConfig({ kind: 'count', prompts: 10 });
    asked = 0;
    const counted = createSession({
      nextPrompt: supply,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    counted.loadPrompt(neko, 'learner');
    // The whole test is already in the window; nothing is asked beyond it.
    expect(asked).toBe(9);
    for (let i = 0; i < 10; i++) type(counted, 'neko');
    expect(counted.phase.value).toBe('finished');
    expect(asked).toBe(9);
  });

  it('strict mode needs nn at the end of a prompt before an n: the prompt switches on the second n', () => {
    const controller = createSession({
      nextPrompt: () => neko,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(pan, 'ime');
    type(controller, 'pan');
    // The ン still waits for its second n.
    expect(controller.currentPrompt.value?.text).toBe('パン');
    expect(controller.romajiBuffer.value).toBe('n');
    type(controller, 'n');
    expect(controller.currentPrompt.value?.text).toBe('ねこ');
    expect(controller.promptResults.value).toHaveLength(1);
  });

  it('relaxed mode takes a single n before a vowel prompt: ほん → あめ is `honame`', () => {
    const ame: PromptItem = { key: 'word:ame', text: 'あめ' };
    const hon: PromptItem = { key: 'word:hon', text: 'ほん' };
    const controller = createSession({
      nextPrompt: () => ame,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(hon, 'learner');
    type(controller, 'hon');
    expect(controller.currentPrompt.value?.text).toBe('あめ');
    type(controller, 'a');
    expect(controller.promptResults.value).toHaveLength(1);
    expect(controller.promptResults.value[0]?.tokenOutcomes.map((t) => t.kanaKey)).toEqual([
      'hiragana:ほ',
      'hiragana:ん',
    ]);
  });

  it('charges a rejected key to the prompt on screen, not to the undecided ん before it (A34)', () => {
    const hon: PromptItem = { key: 'word:hon', text: 'ほん' };
    const controller = createSession({
      nextPrompt: () => neko,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(hon, 'learner');
    type(controller, 'hon');
    type(controller, 'x');
    type(controller, 'ne');
    expect(controller.promptResults.value).toHaveLength(1);
    expect(controller.promptResults.value[0]?.mistakes).toBe(0);
    type(controller, 'ko');
    expect(controller.promptResults.value[1]?.mistakes).toBe(1);
    expect(controller.promptResults.value[1]?.tokenOutcomes.map((t) => t.mistakes)).toEqual([1, 0]);
  });

  it('an Esc before the first key still counts once the test starts', () => {
    const controller = createSession({
      nextPrompt: () => neko,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(neko, 'learner');
    controller.handleIntent({ kind: 'reveal' });
    expect(controller.phase.value).toBe('idle');
    type(controller, 'n');
    expect(controller.phase.value).toBe('running');
  });

  it('an Esc while the ん of the previous prompt is undecided is charged to the prompt on screen', () => {
    const hon: PromptItem = { key: 'word:hon', text: 'ほん' };
    const controller = createSession({
      nextPrompt: () => neko,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(hon, 'learner');
    type(controller, 'hon');
    expect(controller.currentPrompt.value?.text).toBe('ねこ');
    controller.handleIntent({ kind: 'reveal' });
    type(controller, 'neko');
    const [first, second] = controller.promptResults.value;
    expect(first?.mistakes).toBe(0);
    expect(first?.assisted).toBe(false);
    expect(second?.mistakes).toBe(1);
    expect(second?.assisted).toBe(true);
    expect(second?.tokenOutcomes.map((t) => t.mistakes)).toEqual([1, 0]);
  });

  it('an Esc skips the leading skip token of the prompt on screen', () => {
    const quoted: PromptItem = { key: 'phrase:q', text: '「ねこ' };
    const controller = createSession({
      nextPrompt: () => neko,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(quoted, 'learner');
    controller.handleIntent({ kind: 'reveal' });
    type(controller, 'neko');
    expect(controller.promptResults.value[0]?.mistakes).toBe(1);
  });

  it('a single-kana ん that ends a count test is timed from the previous token, not 1 ms', () => {
    setTestConfig({ kind: 'count', prompts: 10 });
    const a: PromptItem = { key: 'basic:a', text: 'あ' };
    const n: PromptItem = { key: 'basic:n', text: 'ん' };
    let asked = 0;
    const controller = createSession({
      nextPrompt: () => (++asked < 9 ? a : n),
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(a, 'learner');
    type(controller, 'aaaaaaaaa');
    clock.advance(500);
    type(controller, 'n');
    expect(controller.phase.value).toBe('finished');
    const last = controller.promptResults.value[9];
    expect(last?.key).toBe('basic:n');
    expect(last?.tokenOutcomes[0]?.ms).toBe(600);
    expect(last?.endedAt).toBe(clock.currentTime);
  });

  it('the first token of a test gets no reaction time, even when its timing is ambiguous', () => {
    setTestConfig({ kind: 'time', seconds: 15 });
    const n: PromptItem = { key: 'basic:n', text: 'ん' };
    const controller = createSession({
      nextPrompt: () => neko,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(n, 'learner');
    type(controller, 'nn');
    scheduler.advance(15000);
    expect(controller.phase.value).toBe('finished');
    expect(controller.promptResults.value[0]?.tokenOutcomes[0]?.ms).toBe(0);
  });

  it('records every prompt before compaction drops it, in order and exactly once', () => {
    setTestConfig({ kind: 'time', seconds: 120 });
    const hon: PromptItem = { key: 'word:hon', text: 'ほん' };
    let i = 0;
    const controller = createSession({
      nextPrompt: () => (i++ % 2 === 0 ? neko : hon),
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(hon, 'learner');
    for (let k = 0; k < 30; k++) type(controller, 'honneko');
    const keys = controller.promptResults.value.map((r) => r.key);
    expect(keys).toHaveLength(60);
    expect(keys.every((key, k) => key === (k % 2 === 0 ? 'word:hon' : 'word:neko'))).toBe(true);
  });

  it('types 100 prompts with ん at the end of prompts, compacting the window on the way', () => {
    setTestConfig({ kind: 'count', prompts: 100 });
    const hon: PromptItem = { key: 'word:hon', text: 'ほん' };
    let i = 0;
    const controller = createSession({
      nextPrompt: () => (i++ % 2 === 0 ? neko : hon),
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(hon, 'learner');
    let guard = 0;
    while (controller.phase.value !== 'finished' && guard++ < 1000) {
      type(controller, controller.canonicalRomaji.value);
    }
    expect(controller.phase.value).toBe('finished');
    expect(controller.promptResults.value).toHaveLength(100);
    expect(controller.metrics.value?.promptsCompleted).toBe(100);
    const measured = controller.promptResults.value.flatMap((r) => r.tokenOutcomes).slice(1);
    for (const result of controller.promptResults.value) {
      expect(result.mistakes).toBe(0);
      expect(result.tokenOutcomes.length).toBe(2);
    }
    for (const token of measured) expect(token.ms).toBeGreaterThanOrEqual(1);
  });

  it('a count test ends on the last prompt even when it ends in ん', () => {
    setTestConfig({ kind: 'count', prompts: 10 });
    const hon: PromptItem = { key: 'word:hon', text: 'ほん' };
    const controller = createSession({
      nextPrompt: () => hon,
      config: () => testConfig.value,
      clock,
      scheduler,
    });
    controller.loadPrompt(hon, 'learner');
    for (let i = 0; i < 9; i++) type(controller, 'honn');
    expect(controller.phase.value).toBe('running');
    type(controller, 'hon');
    expect(controller.phase.value).toBe('finished');
    expect(controller.promptResults.value).toHaveLength(10);
  });
});

describe('session: memory of a long test (ADR 050)', () => {
  it('times the tokens of 1000 prompts right after compact() let the old keystrokes go', () => {
    const clock = new FakeClock();
    const scheduler = new FakeScheduler();
    const hon: PromptItem = { key: 'word:hon', text: 'ほん' };
    const session = createSession({
      nextPrompt: () => hon,
      config: () => ({ kind: 'zen' }),
      clock,
      scheduler,
    });
    session.loadPrompt(hon, 'learner');
    for (let i = 0; i < 1000; i++) {
      for (const char of session.canonicalRomaji.value) {
        clock.advance(100);
        session.handleIntent({ kind: 'char', char });
      }
    }
    session.finish();

    const results = session.promptResults.value;
    expect(session.phase.value).toBe('finished');
    expect(results).toHaveLength(1000);
    const measured = results.flatMap((r) => r.tokenOutcomes).slice(1);
    expect(measured.every((token) => token.ms === 100 || token.ms === 200)).toBe(true);
    expect(results.at(-1)?.startedAt).toBeGreaterThan(results.at(-2)?.startedAt ?? 0);
  });

  it('copies the results only when they change', () => {
    const clock = new FakeClock();
    const a: PromptItem = { key: 'basic:a', text: 'あ' };
    const session = createSession({
      nextPrompt: () => a,
      config: () => ({ kind: 'zen' }),
      clock,
      scheduler: new FakeScheduler(),
    });
    session.loadPrompt(a, 'learner');
    clock.advance(100);
    session.handleIntent({ kind: 'char', char: 'a' });
    clock.advance(100);
    session.handleIntent({ kind: 'char', char: 'a' });
    const first = session.promptResults.value;
    expect(session.promptResults.value).toBe(first);
    clock.advance(100);
    session.handleIntent({ kind: 'char', char: 'a' });
    expect(session.promptResults.value).not.toBe(first);
    expect(first).toHaveLength(2);
  });
});

describe('session: live indicators and independence (D17)', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;

  const a: PromptItem = { key: 'basic:a', text: 'あ' };
  const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };

  const make = (
    nextPrompt: () => PromptItem,
    config: () => TestConfig = () => ({ kind: 'time', seconds: 60 }),
  ): Session => createSession({ nextPrompt, config, clock, scheduler });

  function typeAt(session: Session, char: string, at: number): void {
    clock.currentTime = at;
    session.handleIntent({ kind: 'char', char });
  }

  beforeEach(() => {
    clock = new FakeClock();
    scheduler = new FakeScheduler();
  });

  it('kana per minute counts committed tokens and stays 0 during the first second', () => {
    const session = make(() => a);
    session.loadPrompt(a, 'learner');
    expect(session.liveKpm.value).toBe(0);

    typeAt(session, 'a', 1000);
    typeAt(session, 'a', 1500);
    // Two tokens committed, but only half a second has passed.
    expect(session.liveKpm.value).toBe(0);

    typeAt(session, 'a', 3000);
    // Three committed tokens in 2 s: 90 per minute.
    expect(session.liveKpm.value).toBe(90);
  });

  it('kana accuracy counts committed tokens without errors, and a wrong key errors the token typed', () => {
    const session = make(() => neko);
    session.loadPrompt(neko, 'learner');
    expect(session.liveAccuracy.value).toBe(100);

    typeAt(session, 'x', 1000); // rejected, charged to ね
    typeAt(session, 'n', 1100);
    expect(session.liveAccuracy.value).toBe(100); // ね is not committed yet
    typeAt(session, 'e', 1200);
    expect(session.liveAccuracy.value).toBe(0); // ね committed with an error
    typeAt(session, 'k', 1300);
    typeAt(session, 'o', 1400);
    expect(session.liveAccuracy.value).toBe(50); // こ committed clean
  });

  it('a hint (Esc) errors the token that was waiting', () => {
    const session = make(() => a);
    session.loadPrompt(a, 'learner');
    session.handleIntent({ kind: 'reveal' });
    typeAt(session, 'a', 1000);
    expect(session.liveAccuracy.value).toBe(0);
  });

  it('counters survive compact() over a long run', () => {
    const session = make(
      () => a,
      () => ({ kind: 'count', prompts: 100 }),
    );
    session.loadPrompt(a, 'learner');
    // 60 prompts, 100 ms apart: compact() drops committed prompts several times on the way.
    for (let i = 0; i < 60; i++) typeAt(session, 'a', 1000 + i * 100);
    expect(session.promptResults.value).toHaveLength(60);
    // 60 tokens in 5.9 s.
    expect(session.liveKpm.value).toBe(Math.round(60 / (5900 / 60000)));
    expect(session.liveAccuracy.value).toBe(100);
  });

  it('two sessions share no state', () => {
    const first = make(() => a);
    const second = make(
      () => neko,
      () => ({ kind: 'count', prompts: 10 }),
    );
    first.loadPrompt(a, 'learner');
    second.loadPrompt(neko, 'learner');

    typeAt(first, 'a', 1000);
    typeAt(first, 'x', 1100);

    expect(first.phase.value).toBe('running');
    expect(first.correctKeystrokes.value).toBe(1);
    expect(second.phase.value).toBe('idle');
    expect(second.correctKeystrokes.value).toBe(0);
    expect(second.currentPrompt.value?.text).toBe('ねこ');

    typeAt(second, 'n', 1200);
    expect(second.phase.value).toBe('running');
    first.reset();
    expect(first.phase.value).toBe('idle');
    expect(second.phase.value).toBe('running');
    expect(second.romajiBuffer.value).toBe('n');
  });

  it('a change of the test config in the middle of a test does not affect it', () => {
    let config: TestConfig = { kind: 'time', seconds: 15 };
    const session = make(
      () => a,
      () => config,
    );
    session.loadPrompt(a, 'learner');
    config = { kind: 'count', prompts: 10 };
    typeAt(session, 'a', 1000);
    // Still a time test: one prompt does not end it, the deadline does.
    expect(session.phase.value).toBe('running');
    scheduler.advance(15000);
    expect(session.phase.value).toBe('finished');
  });

  it('loadPrompt without reset() publishes a new stream', () => {
    const session = make(() => a);
    session.loadPrompt(a, 'learner');
    const before = session.stream.value;
    session.loadPrompt(neko, 'learner');
    expect(session.stream.value).not.toBe(before);
    expect(session.stream.value.prompts[0]?.tokens).toHaveLength(2);
  });

  it('each session reads its own test config: one ends on a timer, the other does not', () => {
    const timed = make(
      () => a,
      () => ({ kind: 'time', seconds: 15 }),
    );
    const counted = make(
      () => a,
      () => ({ kind: 'count', prompts: 100 }),
    );
    timed.loadPrompt(a, 'learner');
    counted.loadPrompt(a, 'learner');
    typeAt(timed, 'a', 1000);
    typeAt(counted, 'a', 1000);

    scheduler.advance(15000);
    expect(timed.phase.value).toBe('finished');
    expect(counted.phase.value).toBe('running');
  });

  it('a restarted test starts its counters from zero', () => {
    const session = make(() => a);
    session.loadPrompt(a, 'learner');
    typeAt(session, 'a', 1000);
    typeAt(session, 'x', 1100);
    session.reset();
    session.loadPrompt(a, 'learner');
    expect(session.correctKeystrokes.value).toBe(0);
    expect(session.liveKpm.value).toBe(0);
    expect(session.liveAccuracy.value).toBe(100);
    expect(session.metrics.value).toBeNull();
  });
});

describe('session: the text stream (frontend.md, Text stream and romaji buffer)', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;

  const a: PromptItem = { key: 'basic:a', text: 'あ' };
  const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };
  const comma: PromptItem = { key: 'word:ne-ko', text: 'ね、こ' };

  const make = (nextPrompt: () => PromptItem, config: TestConfig): Session =>
    createSession({ nextPrompt, config: () => config, clock, scheduler });

  const press = (session: Session, keys: string, stepMs = 10): void => {
    for (const char of keys) {
      clock.advance(stepMs);
      session.handleIntent({ kind: 'char', char });
    }
  };

  beforeEach(() => {
    clock = new FakeClock();
    scheduler = new FakeScheduler();
  });

  it('starts with the prompt to type and enough tokens after it to fill the lines', () => {
    const session = make(() => neko, { kind: 'time', seconds: 60 });
    session.loadPrompt(neko, 'learner');

    const prompts = session.stream.value.prompts;
    expect(prompts[0]).toMatchObject({ index: 0, firstToken: 0 });
    expect(prompts[0]?.tokens.map((token) => token.glyph)).toEqual(['ね', 'こ']);
    const tokens = prompts.reduce((sum, prompt) => sum + prompt.tokens.length, 0);
    expect(tokens).toBeGreaterThanOrEqual(2 + AHEAD_TOKENS);
    expect(session.caret.value).toBe(0);
    expect(session.romajiBuffer.value).toBe('');
    expect(session.mistake.value).toBeNull();
    expect(session.erroredTokens().size).toBe(0);
  });

  it('the caret stands before the next token and the buffer holds the Latin typed beyond it', () => {
    const session = make(() => neko, { kind: 'time', seconds: 60 });
    session.loadPrompt(neko, 'learner');

    press(session, 'n');
    expect([session.caret.value, session.romajiBuffer.value]).toEqual([0, 'n']);
    press(session, 'e');
    expect([session.caret.value, session.romajiBuffer.value]).toEqual([1, '']);
    press(session, 'k');
    expect([session.caret.value, session.romajiBuffer.value]).toEqual([1, 'k']);
    press(session, 'o');
    // The caret has moved on to the first token of the next prompt.
    expect([session.caret.value, session.romajiBuffer.value]).toEqual([2, '']);
  });

  it('the caret passes over a token that needs no input', () => {
    const session = make(() => comma, { kind: 'time', seconds: 60 });
    session.loadPrompt(comma, 'learner');
    const tokens = session.stream.value.prompts[0]?.tokens ?? [];
    expect(tokens.map((token) => token.skip)).toEqual([false, true, false]);

    press(session, 'ne');
    // Token 1 is the comma: the caret is already before こ.
    expect(session.caret.value).toBe(2);
  });

  it('the stream changes at most once per completed prompt, never on another key, and far less often than that', () => {
    const session = make(() => neko, { kind: 'time', seconds: 60 });
    session.loadPrompt(neko, 'learner');
    let changes = 0;
    let latest = session.stream.value;
    const stop = effect(() => {
      latest = session.stream.value;
      changes += 1;
    });
    expect(changes).toBe(1);

    // Inside a prompt nothing changes; a completed prompt (2 tokens) usually changes nothing either.
    press(session, 'nek');
    expect(changes).toBe(1);
    press(session, 'o');
    expect(changes).toBe(1);

    // A run of prompts: the view gets a new window only when the one it has is about to run out.
    for (let i = 0; i < 59; i++) press(session, 'neko');
    expect(session.promptResults.value).toHaveLength(60);
    expect(changes).toBeGreaterThan(1);
    expect(changes).toBeLessThanOrEqual(1 + (60 * 2) / (AHEAD_TOKENS - MIN_AHEAD_TOKENS) + 2);
    expect(latest).toBe(session.stream.value);
    stop();
  });

  it('a new window is published before the caret runs out of text, so the lines are always full', () => {
    const session = make(() => a, { kind: 'time', seconds: 120 });
    session.loadPrompt(a, 'learner');

    for (let i = 0; i < 400; i++) {
      press(session, 'a', 1);
      const prompts = session.stream.value.prompts;
      const last = prompts.at(-1);
      const end = last === undefined ? 0 : last.firstToken + last.tokens.length - 1;
      expect(end - session.caret.value, `after ${i + 1} prompts`).toBeGreaterThanOrEqual(
        MIN_AHEAD_TOKENS - 1,
      );
    }
  });

  it('numbers tokens from the start of the test, whatever compact() does to the matcher', () => {
    const session = make(() => a, { kind: 'time', seconds: 120 });
    session.loadPrompt(a, 'learner');

    // 45 prompts: compact() runs at least twice on the way (every 20 committed prompts).
    press(session, 'a'.repeat(45));
    expect(session.caret.value).toBe(45);
    expect(session.promptResults.value).toHaveLength(45);

    // A wrong key now is charged to the token the caret stands before, by its number in the test.
    press(session, 'x');
    expect(session.mistake.value).toMatchObject({ token: 45, kind: 'rejected' });
    expect(session.erroredTokens().has(45)).toBe(true);
  });

  it('keeps a bounded window over 1000 prompts, contiguous and around the caret', () => {
    const session = make(() => a, { kind: 'time', seconds: 120 });
    session.loadPrompt(a, 'learner');

    let widest = 0;
    for (let i = 0; i < 1000; i++) {
      press(session, 'a', 1);
      widest = Math.max(widest, session.stream.value.prompts.length);
    }

    expect(session.caret.value).toBe(1000);
    // One token per prompt, and a view with no layout reports no lines: only the cap on the tokens
    // behind the caret applies, plus ahead and the prompt on display.
    expect(widest).toBeLessThanOrEqual(HARD_BEHIND_TOKENS + MIN_TRIM_TOKENS + AHEAD_TOKENS + 5);
    const prompts = session.stream.value.prompts;
    for (let i = 1; i < prompts.length; i++) {
      const previous = prompts[i - 1];
      const current = prompts[i];
      expect(current?.index).toBe((previous?.index ?? -2) + 1);
      expect(current?.firstToken).toBe(
        (previous?.firstToken ?? 0) + (previous?.tokens.length ?? 0),
      );
    }
    const head = prompts[0];
    expect(head && head.firstToken).toBeGreaterThanOrEqual(
      1000 - HARD_BEHIND_TOKENS - MIN_TRIM_TOKENS - 2,
    );
  });

  it('a wrong key and a hint are charged to a token, by its number, and the mistake event is new each time', () => {
    const session = make(() => neko, { kind: 'time', seconds: 60 });
    session.loadPrompt(neko, 'learner');

    press(session, 'x');
    const first = session.mistake.value;
    expect(first).toMatchObject({ token: 0, kind: 'rejected' });
    press(session, 'x');
    const second = session.mistake.value;
    expect(second).toMatchObject({ token: 0, kind: 'rejected' });
    expect(second?.seq).toBeGreaterThan(first?.seq ?? 0);

    press(session, 'ne');
    session.handleIntent({ kind: 'reveal' });
    expect(session.mistake.value).toMatchObject({ token: 1, kind: 'hint' });
    expect([...session.erroredTokens()].sort()).toEqual([0, 1]);
  });

  it('forgets the errors of tokens that have left the window', () => {
    const session = make(() => a, { kind: 'time', seconds: 120 });
    session.loadPrompt(a, 'learner');
    press(session, 'x');
    expect(session.erroredTokens().has(0)).toBe(true);

    session.setTrimPoint(1);
    press(session, 'a'.repeat(HARD_BEHIND_TOKENS + MIN_TRIM_TOKENS + 10));
    expect(session.erroredTokens().has(0)).toBe(false);
  });

  it('keeps a red mark until the window that still draws the token is replaced', () => {
    const session = make(() => a, { kind: 'time', seconds: 120 });
    session.loadPrompt(a, 'learner');
    press(session, 'x');
    // A line starts at token 50: fewer than MIN_TRIM_TOKENS can leave, so nothing is published.
    press(session, 'a'.repeat(30));
    session.setTrimPoint(50);
    press(session, 'a'.repeat(20));
    expect(session.stream.value.prompts[0]?.firstToken).toBe(0);
    expect(session.erroredTokens().has(0)).toBe(true);

    // The next line start is far enough: the window is cut there and the mark goes with token 0.
    session.setTrimPoint(90);
    press(session, 'a'.repeat(20));
    expect(session.stream.value.prompts[0]?.firstToken).toBe(90);
    expect(session.erroredTokens().has(0)).toBe(false);
  });

  it('cuts the window at the line the view reported, and only by whole prompts', () => {
    const session = make(() => a, { kind: 'time', seconds: 120 });
    session.loadPrompt(a, 'learner');
    session.setTrimPoint(100);
    press(session, 'a'.repeat(130));
    const head = session.stream.value.prompts[0];
    expect(head?.firstToken).toBe(100);
  });

  it('never draws a prompt beyond the end of a count test', () => {
    const session = make(() => neko, { kind: 'count', prompts: 10 });
    session.loadPrompt(neko, 'learner');
    const prompts = session.stream.value.prompts;
    expect(prompts).toHaveLength(10);
    expect(prompts.at(-1)?.index).toBe(9);

    for (let i = 0; i < 10; i++) press(session, 'neko');
    expect(session.phase.value).toBe('finished');
    expect(session.stream.value.prompts.at(-1)?.index).toBe(9);
    // The caret is after the last token.
    expect(session.caret.value).toBe(20);
  });

  it('reset() empties the stream', () => {
    const session = make(() => neko, { kind: 'time', seconds: 60 });
    session.loadPrompt(neko, 'learner');
    press(session, 'nex');
    session.reset();

    expect(session.stream.value.prompts).toEqual([]);
    expect(session.caret.value).toBe(0);
    expect(session.romajiBuffer.value).toBe('');
    expect(session.mistake.value).toBeNull();
    expect(session.erroredTokens().size).toBe(0);
  });

  it('a new test numbers its tokens from zero again', () => {
    const session = make(() => neko, { kind: 'time', seconds: 60 });
    session.loadPrompt(neko, 'learner');
    press(session, 'nekoneko');
    session.reset();
    session.loadPrompt(neko, 'learner');

    expect(session.caret.value).toBe(0);
    expect(session.stream.value.prompts[0]).toMatchObject({ index: 0, firstToken: 0 });
  });
});

describe('session: a zen test, and ending it by hand (metrics.md, Test end)', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;

  const a: PromptItem = { key: 'basic:a', text: 'あ' };
  const pan: PromptItem = { key: 'word:pan', text: 'パン' };
  const zen: TestConfig = { kind: 'zen' };

  const make = (
    config: TestConfig,
    onDiscard?: () => void,
    nextPrompt: () => PromptItem = () => a,
  ): Session =>
    createSession({
      nextPrompt,
      config: () => config,
      clock,
      scheduler,
      ...(onDiscard === undefined ? {} : { onDiscard }),
    });

  const press = (session: Session, keys: string, stepMs = 100): void => {
    for (const char of keys) {
      clock.advance(stepMs);
      session.handleIntent({ kind: 'char', char });
    }
  };

  beforeEach(() => {
    clock = new FakeClock();
    scheduler = new FakeScheduler();
  });

  it('has no deadline and no limit: it goes on until it is ended by hand', () => {
    const session = make(zen);
    session.loadPrompt(a, 'learner');
    press(session, 'a'.repeat(120));
    scheduler.advance(60 * 60 * 1000);

    expect(session.phase.value).toBe('running');
    expect(session.promptResults.value).toHaveLength(120);
  });

  it('finish() keeps a test with a completed prompt and time behind it, and shows the result', () => {
    const session = make(zen);
    session.loadPrompt(a, 'learner');
    press(session, 'aaaa');
    session.finish();

    expect(session.phase.value).toBe('finished');
    expect(session.metrics.value?.promptsCompleted).toBe(4);
    expect(session.metrics.value?.elapsedMs).toBeGreaterThan(0);
  });

  it('canFinish() is true only for a zen test that is running', () => {
    const session = make(zen);
    session.loadPrompt(a, 'learner');
    expect(session.canFinish()).toBe(false);
    press(session, 'a');
    expect(session.canFinish()).toBe(true);
    session.finish();
    expect(session.canFinish()).toBe(false);

    const timed = make({ kind: 'count', prompts: 10 });
    timed.loadPrompt(a, 'learner');
    press(timed, 'a');
    expect(timed.canFinish()).toBe(false);
  });

  it('Ctrl/Cmd+Enter is the same thing as the button', () => {
    const session = make(zen);
    session.loadPrompt(a, 'learner');
    press(session, 'aa');
    session.handleIntent({ kind: 'finish' });
    expect(session.phase.value).toBe('finished');
  });

  it('counts every prompt before the one on screen, and a partial one is not a completed prompt', () => {
    const session = make(zen, undefined, () => pan);
    session.loadPrompt(pan, 'learner');
    press(session, 'pan'); // パ and the ん: the next prompt is on screen now, though the ん is open
    press(session, 'pa'); // the second prompt is partly typed
    session.finish();

    expect(session.phase.value).toBe('finished');
    expect(session.metrics.value?.promptsCompleted).toBe(1);
  });

  it('keeps a test whose only prompt ends in ん, typed with a single n (metrics.md, Test end)', () => {
    const session = make(zen, undefined, () => pan);
    session.loadPrompt(pan, 'learner');
    press(session, 'pan');
    expect(session.completedPrompts.value).toBe(1);
    session.finish();

    expect(session.phase.value).toBe('finished');
    expect(session.promptResults.value).toHaveLength(1);
    expect(session.metrics.value?.promptsCompleted).toBe(1);
  });

  it('counts the prompt on ん the same way when a time test ends on its deadline', () => {
    const session = createSession({
      nextPrompt: () => pan,
      config: () => ({ kind: 'time', seconds: 15 }),
      clock,
      scheduler,
    });
    session.loadPrompt(pan, 'learner');
    press(session, 'pan');
    scheduler.advance(15000);

    expect(session.phase.value).toBe('finished');
    expect(session.metrics.value?.promptsCompleted).toBe(1);
    expect(session.promptResults.value).toHaveLength(1);
  });

  it('shows the same number while it runs as the result holds at the end', () => {
    const session = make(zen, undefined, () => pan);
    session.loadPrompt(pan, 'learner');
    expect(session.completedPrompts.value).toBe(0);
    press(session, 'pan');
    press(session, 'pan');
    press(session, 'pa');
    const shown = session.completedPrompts.value;
    expect(shown).toBe(2);
    session.finish();

    expect(session.promptResults.value).toHaveLength(shown);
    expect(session.metrics.value?.promptsCompleted).toBe(shown);
    expect(session.completedPrompts.value).toBe(shown);
  });

  it('drops a test in which no prompt is completed, like a restart, with no result', () => {
    const onDiscard = vi.fn();
    const session = make(zen, onDiscard);
    session.loadPrompt(pan, 'learner');
    press(session, 'p'); // a keystroke, but not a prompt
    session.finish();

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(session.phase.value).toBe('running');
    expect(session.metrics.value).toBeNull();
  });

  it('drops a test in which no time has passed, though a prompt is completed', () => {
    const onDiscard = vi.fn();
    const session = make(zen, onDiscard);
    session.loadPrompt(a, 'learner');
    press(session, 'a', 0);
    expect(session.promptResults.value).toHaveLength(1);
    session.finish();

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(session.phase.value).not.toBe('finished');
  });

  it('without a discard handler the session resets itself to idle', () => {
    const session = make(zen);
    session.loadPrompt(pan, 'learner');
    press(session, 'p');
    session.finish();

    expect(session.phase.value).toBe('idle');
    expect(session.correctKeystrokes.value).toBe(0);
  });

  it('does nothing before the test has started', () => {
    const onDiscard = vi.fn();
    const session = make(zen, onDiscard);
    session.loadPrompt(a, 'learner');
    session.finish();
    session.handleIntent({ kind: 'finish' });

    expect(onDiscard).not.toHaveBeenCalled();
    expect(session.phase.value).toBe('idle');
  });

  it('is ignored in a time test and in a count test', () => {
    for (const config of [
      { kind: 'time', seconds: 60 },
      { kind: 'count', prompts: 25 },
    ] as const) {
      const onDiscard = vi.fn();
      const session = make(config, onDiscard);
      session.loadPrompt(a, 'learner');
      press(session, 'aa');
      session.finish();
      session.handleIntent({ kind: 'finish' });

      expect(session.phase.value).toBe('running');
      expect(onDiscard).not.toHaveBeenCalled();
    }
  });

  it('a finished test ignores a second finish', () => {
    const onDiscard = vi.fn();
    const session = make(zen, onDiscard);
    session.loadPrompt(a, 'learner');
    press(session, 'aaa');
    session.finish();
    const metrics = session.metrics.value;
    session.finish();
    session.handleIntent({ kind: 'finish' });

    expect(session.metrics.value).toBe(metrics);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('stops the ticker when it is ended, so the live line does not run on', () => {
    const session = make(zen);
    session.loadPrompt(a, 'learner');
    press(session, 'aaa');
    session.finish();
    const at = session.tickerNow.value;
    scheduler.advance(5000);
    expect(session.tickerNow.value).toBe(at);
  });
});

describe('session: the report of an ended test (metrics.md, T4)', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;
  let reports: EndedTest[];

  const a: PromptItem = { key: 'basic:a', text: 'あ' };
  const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };

  const make = (config: TestConfig, nextPrompt: () => PromptItem = () => a): Session =>
    createSession({
      nextPrompt,
      config: () => config,
      clock,
      scheduler,
      onEnd: (ended) => reports.push(ended),
    });

  const typeAt = (session: Session, char: string, at: number): void => {
    clock.currentTime = at;
    session.handleIntent({ kind: 'char', char });
  };

  beforeEach(() => {
    clock = new FakeClock();
    scheduler = new FakeScheduler();
    reports = [];
  });

  it('reports a count test: tokens, errors, keystrokes, hints and the kana of each', () => {
    const session = make({ kind: 'count', prompts: 10 });
    session.loadPrompt(a, 'learner');
    // The first あ: a rejected key and a hint, one errored token. The other nine are clean.
    typeAt(session, 'x', 1000);
    session.handleIntent({ kind: 'reveal' });
    for (let i = 0; i < 10; i++) typeAt(session, 'a', 1100 + i * 100);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toEqual({
      endReason: 'complete',
      config: { kind: 'count', prompts: 10 },
      strictness: 'learner',
      startedAt: 1000,
      endedAt: 2000,
      durationMs: 1000,
      tokens: 10,
      erroredTokens: 1,
      items: 10,
      keystrokes: 11,
      rejectedKeystrokes: 1,
      assisted: 1,
      kanaDelta: { 'hiragana:あ': { attempts: 10, erroredAttempts: 1 } },
    });
  });

  it('counts the committed tokens of an unfinished prompt when a time test runs out', () => {
    const session = make({ kind: 'time', seconds: 15 }, () => neko);
    session.loadPrompt(neko, 'learner');
    typeAt(session, 'n', 1000);
    typeAt(session, 'e', 1100);
    typeAt(session, 'k', 1200);
    clock.currentTime = 16000;
    scheduler.advance(15000);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      endReason: 'complete',
      startedAt: 1000,
      endedAt: 16000,
      durationMs: 15000,
      // ね is committed; こ is not finished.
      tokens: 1,
      erroredTokens: 0,
      items: 0,
      keystrokes: 3,
      kanaDelta: { 'hiragana:ね': { attempts: 1, erroredAttempts: 0 } },
    });
  });

  it('reports a zen test ended by hand as manual, and a dropped one not at all', () => {
    const session = make({ kind: 'zen' });
    session.loadPrompt(a, 'learner');
    typeAt(session, 'a', 1000);
    typeAt(session, 'a', 1500);
    clock.currentTime = 2000;
    session.finish();
    expect(reports.map((r) => r.endReason)).toEqual(['manual']);
    expect(reports[0]).toMatchObject({ items: 2, tokens: 2, durationMs: 1000 });

    const dropped = make({ kind: 'zen' });
    dropped.loadPrompt(a, 'learner');
    dropped.handleIntent({ kind: 'char', char: 'x' });
    dropped.finish();
    dropped.reset();
    expect(reports).toHaveLength(1);
  });

  it('reports nothing for a test that is restarted', () => {
    const session = make({ kind: 'time', seconds: 15 });
    session.loadPrompt(a, 'learner');
    typeAt(session, 'a', 1000);
    session.reset();
    scheduler.advance(20000);
    expect(reports).toEqual([]);
  });

  it('keeps the hints of prompts that compaction dropped', () => {
    const session = make({ kind: 'count', prompts: 100 });
    session.loadPrompt(a, 'learner');
    for (let i = 0; i < 100; i++) {
      session.handleIntent({ kind: 'reveal' });
      typeAt(session, 'a', 1000 + i * 10);
    }
    expect(reports[0]).toMatchObject({
      assisted: 100,
      items: 100,
      tokens: 100,
      erroredTokens: 100,
    });
  });
});
