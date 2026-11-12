// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTrainer } from './trainer';
import * as promptModule from '@/entities/prompt';
import { CONTENT_VERSION } from '@/entities/prompt';
import type { SaveTestInput, SavedTest } from '@/entities/stats';
import { createTypingStore } from '@/entities/stats';
import type { ContentItem, PromptItem } from '@/entities/prompt';
import {
  contentSetting,
  initSettings,
  setContent,
  setScript,
  setTestConfig,
  strictnessSetting,
} from '@/entities/settings';
import { createMemoryDb } from '@/shared/lib';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const word: ContentItem = {
  id: 'word:neko',
  text: 'ねこ',
  script: 'hiragana',
  meaning: { en: 'cat' },
};

describe('trainer: prompt source, restarts and content loading', () => {
  beforeEach(async () => {
    await initSettings(Promise.resolve(createMemoryDb()));
    // The vocabulary: the real chunks are not under test here.
    vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([word]);
    setContent('words');
    setScript('both');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('start() shows a first prompt and stop() ends the following of the settings', async () => {
    const picked: PromptItem = { key: 'basic:a', text: 'あ' };
    const next = vi.fn(() => picked);
    const trainer = createTrainer({ nextPrompt: next });
    expect(trainer.session.currentPrompt.value).toBeNull();

    const stop = trainer.start();
    await flush();
    expect(trainer.session.currentPrompt.value?.text).toBe('あ');
    const afterStart = next.mock.calls.length;

    setScript('katakana');
    expect(next.mock.calls.length).toBeGreaterThan(afterStart);

    stop();
    const afterStop = next.mock.calls.length;
    setScript('hiragana');
    expect(next.mock.calls.length).toBe(afterStop);
  });

  it('restart() discards a running test and loads a fresh prompt', async () => {
    const picked: PromptItem = { key: 'word:neko', text: 'ねこ' };
    const trainer = createTrainer({ nextPrompt: () => picked });
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'n' });
    expect(trainer.session.phase.value).toBe('running');

    trainer.restart();
    expect(trainer.session.phase.value).toBe('idle');
    expect(trainer.session.romajiBuffer.value).toBe('');
    expect(trainer.session.currentPrompt.value?.text).toBe('ねこ');
    stop();
  });

  it('the default source draws from the pool of the selected settings', async () => {
    const pan: ContentItem = {
      id: 'word:pan',
      text: 'パン',
      script: 'katakana',
      meaning: { en: 'bread' },
    };
    vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([word, pan]);
    setScript('katakana');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    await flush();
    expect(trainer.session.currentPrompt.value?.script).toBe('katakana');
    stop();
  });

  it('loads vocabulary once per kind, and restarts with it', async () => {
    const load = vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([word]);
    setScript('hiragana');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    expect(trainer.isLoadingContent.value).toBe(true);
    expect(trainer.session.currentPrompt.value).toBeNull();
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('words-hiragana');
    expect(trainer.isLoadingContent.value).toBe(false);
    expect(trainer.contentLoadFailed.value).toBe(false);
    expect(trainer.session.currentPrompt.value?.text).toBe('ねこ');

    // Back and forth does not fetch a kind again.
    setContent('phrases');
    await flush();
    setContent('words');
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    stop();
  });

  it('loads the chunks of the selected script, each once, and the union for both', async () => {
    const load = vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([word]);
    setScript('hiragana');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    await flush();
    expect(load.mock.calls).toEqual([['words-hiragana']]);

    setScript('both');
    await flush();
    expect(load.mock.calls).toEqual([['words-hiragana'], ['words-katakana']]);

    setScript('katakana');
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    stop();
  });

  it('with both scripts the pool waits for every chunk of the kind', async () => {
    const resolvers = new Map<string, (items: readonly ContentItem[]) => void>();
    vi.spyOn(promptModule, 'loadChunk').mockImplementation(
      (chunk) =>
        new Promise((r) => {
          resolvers.set(chunk, r);
        }),
    );
    setScript('both');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    resolvers.get('words-hiragana')?.([word]);
    await flush();
    expect(trainer.isLoadingContent.value).toBe(true);
    expect(trainer.session.currentPrompt.value).toBeNull();
    resolvers.get('words-katakana')?.([]);
    await flush();
    expect(trainer.isLoadingContent.value).toBe(false);
    expect(trainer.session.currentPrompt.value?.text).toBe('ねこ');
    stop();
  });

  // Spec "Loading" (frontend.md): a failed load keeps the setting; there is nothing to type until
  // Retry succeeds.
  it('a failed load reports it, keeps the setting and shows no prompt until Retry', async () => {
    const load = vi
      .spyOn(promptModule, 'loadChunk')
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue([word]);
    setScript('hiragana');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    await flush();

    expect(trainer.contentLoadFailed.value).toBe(true);
    expect(trainer.isLoadingContent.value).toBe(false);
    expect(contentSetting.value).toBe('words');
    expect(trainer.session.currentPrompt.value).toBeNull();
    trainer.session.handleIntent({ kind: 'char', char: 'n' });
    expect(trainer.session.phase.value).toBe('idle');

    trainer.retryContent();
    expect(trainer.isLoadingContent.value).toBe(true);
    expect(trainer.contentLoadFailed.value).toBe(false);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(trainer.contentLoadFailed.value).toBe(false);
    expect(trainer.session.currentPrompt.value?.text).toBe('ねこ');
    stop();
  });

  it('a failure of a kind that is no longer selected shows nothing and keeps the test', async () => {
    let fail: (error: Error) => void = () => {};
    vi.spyOn(promptModule, 'loadChunk').mockImplementation((chunk) =>
      chunk.startsWith('words')
        ? new Promise((_, reject) => {
            fail = reject;
          })
        : Promise.resolve([word]),
    );
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    setContent('phrases');
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'n' });
    expect(trainer.session.phase.value).toBe('running');

    fail(new Error('chunk failed'));
    await flush();

    expect(contentSetting.value).toBe('phrases');
    expect(trainer.contentLoadFailed.value).toBe(false);
    expect(trainer.session.phase.value).toBe('running');
    stop();
  });

  it('a chunk that arrives late does not reset a running test of another content', async () => {
    let resolveWords: (items: readonly ContentItem[]) => void = () => {};
    vi.spyOn(promptModule, 'loadChunk').mockImplementation((chunk) =>
      chunk.startsWith('words')
        ? new Promise((r) => {
            resolveWords = r;
          })
        : Promise.resolve([word]),
    );
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    setContent('phrases');
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'n' });
    const phase = trainer.session.phase.value;
    expect(phase).toBe('running');

    resolveWords([word]);
    await flush();

    expect(trainer.session.phase.value).toBe('running');
    stop();
  });

  it('input is blocked and no prompt is shown while the selected content loads', async () => {
    let resolve: (items: readonly ContentItem[]) => void = () => {};
    vi.spyOn(promptModule, 'loadChunk').mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    setContent('words');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    expect(trainer.isLoadingContent.value).toBe(true);
    expect(trainer.session.currentPrompt.value).toBeNull();

    trainer.session.handleIntent({ kind: 'char', char: 'n' });
    expect(trainer.session.phase.value).toBe('idle');

    resolve([word]);
    await flush();
    expect(trainer.session.currentPrompt.value?.text).toBe('ねこ');
    trainer.session.handleIntent({ kind: 'char', char: 'n' });
    expect(trainer.session.phase.value).toBe('running');
    stop();
  });

  it("parallel loads do not clear each other's indicator", async () => {
    const resolvers = new Map<string, (items: readonly ContentItem[]) => void>();
    vi.spyOn(promptModule, 'loadChunk').mockImplementation(
      (chunk) =>
        new Promise((r) => {
          resolvers.set(chunk.split('-')[0] ?? chunk, r);
        }),
    );
    setScript('hiragana');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    setContent('words');
    setContent('phrases');
    resolvers.get('words')?.([word]);
    await flush();
    expect(trainer.isLoadingContent.value).toBe(true);
    resolvers.get('phrases')?.([word]);
    await flush();
    expect(trainer.isLoadingContent.value).toBe(false);
    stop();
  });

  it('stop() ends a running test: no timers stay alive and the deadline does not fire', async () => {
    setTestConfig({ kind: 'time', seconds: 15 });
    const live = new Set<number>();
    let nextId = 1;
    const deadlines: (() => void)[] = [];
    const scheduler = {
      setTimeout: (fn: () => void) => {
        const id = nextId++;
        live.add(id);
        deadlines.push(() => {
          if (live.has(id)) fn();
        });
        return { id };
      },
      clearTimeout: (h: { id: unknown }) => {
        live.delete(Number(h.id));
      },
      setInterval: () => {
        const id = nextId++;
        live.add(id);
        return { id };
      },
      clearInterval: (h: { id: unknown }) => {
        live.delete(Number(h.id));
      },
    };
    const trainer = createTrainer({
      nextPrompt: () => ({ key: 'basic:a', text: 'あ' }),
      scheduler,
    });
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    expect(live.size).toBeGreaterThan(0);

    stop();

    expect(live.size).toBe(0);
    for (const run of deadlines) run();
    expect(trainer.session.phase.value).not.toBe('finished');
  });

  it('a load that finishes after stop() does not touch the session', async () => {
    let resolve: (items: readonly ContentItem[]) => void = () => {};
    vi.spyOn(promptModule, 'loadChunk').mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const next = vi.fn((): PromptItem => ({ key: 'basic:a', text: 'あ' }));
    const trainer = createTrainer({ nextPrompt: next });
    const stop = trainer.start();
    setContent('words');
    stop();
    const calls = next.mock.calls.length;

    resolve([word]);
    await flush();
    expect(next.mock.calls.length).toBe(calls);
  });

  it('restart loads the prompt with the strictness of the settings', () => {
    const trainer = createTrainer({ nextPrompt: () => ({ key: 'word:pan', text: 'パン' }) });
    expect(strictnessSetting.value).toBe('learner');
    trainer.restart();
    expect(trainer.session.currentPrompt.value?.text).toBe('パン');
  });

  it('a zen test ended with nothing to keep starts a fresh one, with no result', async () => {
    setTestConfig({ kind: 'zen' });
    const next = vi.fn((): PromptItem => ({ key: 'word:pan', text: 'パン' }));
    const trainer = createTrainer({ nextPrompt: next });
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'p' });
    expect(trainer.session.phase.value).toBe('running');
    const asked = next.mock.calls.length;

    trainer.session.handleIntent({ kind: 'finish' });

    expect(trainer.session.phase.value).toBe('idle');
    expect(trainer.session.metrics.value).toBeNull();
    expect(next.mock.calls.length).toBeGreaterThan(asked);
    expect(trainer.session.currentPrompt.value?.text).toBe('パン');
    stop();
  });

  it('a zen test with a completed prompt shows its result', async () => {
    setTestConfig({ kind: 'zen' });
    const clock = { now: vi.fn(() => 1000) };
    const trainer = createTrainer({ nextPrompt: () => ({ key: 'basic:a', text: 'あ' }), clock });
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    clock.now.mockReturnValue(2500);
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    trainer.session.handleIntent({ kind: 'finish' });

    expect(trainer.session.phase.value).toBe('finished');
    expect(trainer.session.metrics.value?.promptsCompleted).toBe(2);
    stop();
  });
});

describe('trainer: saving the finished test (ADR 073)', () => {
  const a: PromptItem = { key: 'basic:a', text: 'あ' };

  function setup() {
    const saveTest = vi.fn((input: SaveTestInput): Promise<SavedTest> =>
      Promise.resolve({ result: input.result, average: 80, previousBest: 90, isBest: false }),
    );
    const recordDiscarded = vi.fn(() => Promise.resolve());
    const clock = { now: vi.fn(() => 1000) };
    const trainer = createTrainer({
      nextPrompt: () => a,
      clock,
      typing: { saveTest, recordDiscarded },
      newId: (now) => `id-${now}`,
    });
    return { saveTest, recordDiscarded, clock, trainer };
  }

  beforeEach(async () => {
    await initSettings(Promise.resolve(createMemoryDb()));
    vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([word]);
    setContent('phrases');
    setScript('hiragana');
    setTestConfig({ kind: 'zen' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setContent('words');
    setScript('both');
  });

  it('assembles the result from the report and the settings, and keeps what was compared', async () => {
    const { saveTest, clock, trainer } = setup();
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    clock.now.mockReturnValue(7000);
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    clock.now.mockReturnValue(31000);
    trainer.session.handleIntent({ kind: 'finish' });
    await flush();

    expect(saveTest).toHaveBeenCalledTimes(1);
    const input = saveTest.mock.calls[0]?.[0];
    expect(input?.startedIncrement).toBe(1);
    expect(input?.kanaDelta).toEqual({ 'hiragana:あ': { attempts: 2, erroredAttempts: 0 } });
    expect(input?.result).toEqual({
      id: 'id-31000',
      content: 'phrases',
      script: 'hiragana',
      strictness: 'learner',
      config: { kind: 'zen' },
      endReason: 'manual',
      repeated: false,
      startedAt: 1000,
      endedAt: 31000,
      durationMs: 30000,
      tokens: 2,
      erroredTokens: 0,
      items: 2,
      keystrokes: 2,
      rejectedKeystrokes: 0,
      assisted: 0,
      // 2 tokens in half a minute.
      kpm: 4,
      kanaAccuracy: 1,
      celebratedPersonalBest: false,
      contentVersion: CONTENT_VERSION,
      appVersion: 'test',
    });
    expect(trainer.lastSaved.value).toMatchObject({ average: 80, previousBest: 90 });
    stop();
  });

  it('a hidden tab saves the running test at once, ended at the last keystroke', async () => {
    const { saveTest, clock, trainer } = setup();
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    clock.now.mockReturnValue(4000);
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    clock.now.mockReturnValue(20000);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    visibility.mockRestore();

    expect(saveTest).toHaveBeenCalledTimes(1);
    expect(saveTest.mock.calls[0]?.[0].result).toMatchObject({
      endReason: 'hidden',
      endedAt: 4000,
      durationMs: 3000,
    });
    stop();
  });

  it('a hidden tab before any keystroke does nothing, and stop() removes the listener', async () => {
    const { saveTest, recordDiscarded, clock, trainer } = setup();
    const stop = trainer.start();
    await flush();
    const hide = (): void => {
      const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      visibility.mockRestore();
    };
    hide();
    expect(trainer.session.phase.value).toBe('idle');

    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    stop();
    clock.now.mockReturnValue(9000);
    hide();
    expect(saveTest).not.toHaveBeenCalled();
    expect(recordDiscarded).toHaveBeenCalledTimes(1);
  });

  it('a test with no time has KPM 0', async () => {
    const { saveTest, trainer } = setup();
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    // The same instant: no time passed, so it is dropped, not saved.
    trainer.session.handleIntent({ kind: 'finish' });
    expect(saveTest).not.toHaveBeenCalled();
    stop();
  });

  it('a restart of a running test counts it as started only; an idle or finished one counts nothing', async () => {
    const { saveTest, recordDiscarded, clock, trainer } = setup();
    const stop = trainer.start();
    await flush();
    trainer.restart();
    expect(recordDiscarded).not.toHaveBeenCalled();

    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    trainer.restart();
    expect(recordDiscarded).toHaveBeenCalledTimes(1);

    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    clock.now.mockReturnValue(5000);
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    trainer.session.handleIntent({ kind: 'finish' });
    await flush();
    expect(saveTest).toHaveBeenCalledTimes(1);
    trainer.restart();
    expect(recordDiscarded).toHaveBeenCalledTimes(1);
    expect(trainer.lastSaved.value).toBeNull();
    stop();
  });

  it('leaving the screen during a test counts it as started only', async () => {
    const { saveTest, recordDiscarded, trainer } = setup();
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    stop();
    expect(recordDiscarded).toHaveBeenCalledTimes(1);
    expect(saveTest).not.toHaveBeenCalled();
  });

  it('a zen finish with nothing to keep counts as started only, once', async () => {
    const { saveTest, recordDiscarded, trainer } = setup();
    const stop = trainer.start();
    await flush();
    trainer.session.handleIntent({ kind: 'char', char: 'x' });
    trainer.session.handleIntent({ kind: 'finish' });
    expect(recordDiscarded).toHaveBeenCalledTimes(1);
    expect(saveTest).not.toHaveBeenCalled();
    stop();
    expect(recordDiscarded).toHaveBeenCalledTimes(1);
  });

  it('writes nothing inside the keystroke that ends a test', async () => {
    setTestConfig({ kind: 'count', prompts: 10 });
    const db = createMemoryDb();
    const writes: unknown[] = [];
    const original = db.write.bind(db);
    db.write = (batch) => {
      writes.push(batch);
      return original(batch);
    };
    const store = createTypingStore({ db: () => Promise.resolve(db) });
    const trainer = createTrainer({ nextPrompt: () => a, typing: store });
    const stop = trainer.start();
    await flush();
    for (let i = 0; i < 10; i++) {
      trainer.session.handleIntent({ kind: 'char', char: 'a' });
      expect(writes).toHaveLength(0);
    }
    expect(trainer.session.phase.value).toBe('finished');
    await flush();
    expect(writes).toHaveLength(1);
    expect(store.counters.value.finished.typing).toBe(1);
    stop();
  });
});
