import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTrainer } from './trainer';
import * as promptModule from '@/entities/prompt';
import type { ContentItem, PromptItem } from '@/entities/prompt';
import {
  contentSetting,
  initSettings,
  setContent,
  setScript,
  setTestConfig,
  strictnessSetting,
} from '@/entities/settings';
import { MemoryKeyValueStore } from '@/shared/lib';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const word: ContentItem = {
  id: 'word:neko',
  text: 'ねこ',
  script: 'hiragana',
  meaning: { en: 'cat', ru: 'кошка' },
};

describe('trainer: prompt source, restarts and content loading', () => {
  beforeEach(() => {
    initSettings(new MemoryKeyValueStore());
    // The vocabulary: the real chunks are not under test here.
    vi.spyOn(promptModule, 'loadContent').mockResolvedValue([word]);
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
      meaning: { en: 'bread', ru: 'хлеб' },
    };
    vi.spyOn(promptModule, 'loadContent').mockResolvedValue([word, pan]);
    setScript('katakana');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    await flush();
    expect(trainer.session.currentPrompt.value?.script).toBe('katakana');
    stop();
  });

  it('loads vocabulary once per kind, and restarts with it', async () => {
    const load = vi.spyOn(promptModule, 'loadContent').mockResolvedValue([word]);
    setScript('hiragana');
    const trainer = createTrainer({ rng: { next: () => 0 } });
    const stop = trainer.start();
    expect(trainer.isLoadingContent.value).toBe(true);
    expect(trainer.session.currentPrompt.value).toBeNull();
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('words');
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

  // Spec "Loading" (frontend.md): a failed load keeps the setting; there is nothing to type until
  // Retry succeeds.
  it('a failed load reports it, keeps the setting and shows no prompt until Retry', async () => {
    const load = vi
      .spyOn(promptModule, 'loadContent')
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue([word]);
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
    vi.spyOn(promptModule, 'loadContent').mockImplementation((kind) =>
      kind === 'words'
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
    vi.spyOn(promptModule, 'loadContent').mockImplementation((kind) =>
      kind === 'words'
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
    vi.spyOn(promptModule, 'loadContent').mockReturnValue(
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
    vi.spyOn(promptModule, 'loadContent').mockImplementation(
      (kind) =>
        new Promise((r) => {
          resolvers.set(kind, r);
        }),
    );
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
    vi.spyOn(promptModule, 'loadContent').mockReturnValue(
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
