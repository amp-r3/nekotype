import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSettings,
  settingsReady,
  learnStrictness,
  learnTrack,
  learnTargetMs,
  setLearnStrictness,
  setTrack,
  setTargetMs,
} from './store';
import { createMemoryDb, databaseMode } from '@/shared/lib';
import type { ChangeChannel, Db, Clock } from '@/shared/lib';

const fixedClock = (now: number): Clock => ({ now: () => now });

// Counts the writes the store makes.
function countingDb(): { db: Db; puts: () => number } {
  const inner = createMemoryDb();
  let puts = 0;
  return {
    db: {
      ...inner,
      put: (store, key, value) => {
        puts++;
        return inner.put(store, key, value);
      },
    },
    puts: () => puts,
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const savedDocument = {
  learn: { strictness: 'ime', track: 'katakana', targetMs: 2000, sound: false },
  updatedAt: 42,
};

describe('settings store: actions and persistence in IndexedDB', () => {
  let db: Db;

  beforeEach(async () => {
    db = createMemoryDb();
    await initSettings(Promise.resolve(db));
  });

  it('is ready once loaded, with the defaults on an empty database', () => {
    expect(settingsReady.value).toBe(true);
    expect(learnStrictness.value).toBe('learner');
    expect(learnTrack.value).toBe('hiragana');
    expect(learnTargetMs.value).toBe(1500);
  });

  it('a change is stored at once, without waiting for pagehide, and loads back', async () => {
    setLearnStrictness('ime');
    setTrack('katakana');
    setTargetMs(2250);
    await flush();

    await initSettings(Promise.resolve(db));
    expect(learnStrictness.value).toBe('ime');
    expect(learnTrack.value).toBe('katakana');
    expect(learnTargetMs.value).toBe(2250);
  });

  it('stores the spec shape with updatedAt from the clock', async () => {
    const counting = countingDb();
    await initSettings(Promise.resolve(counting.db), fixedClock(1234));
    setTrack('katakana');
    await flush();
    expect(await counting.db.get('settings', 'current')).toEqual({
      learn: { strictness: 'learner', track: 'katakana', targetMs: 1500, sound: true },
      updatedAt: 1234,
    });
  });

  it('writes once per change and never on load', async () => {
    const counting = countingDb();
    await initSettings(Promise.resolve(counting.db));
    expect(counting.puts()).toBe(0);
    setTrack('katakana');
    setTrack('hiragana');
    expect(counting.puts()).toBe(2);
  });

  it('keeps a saved document, including the sound flag it has no control for yet', async () => {
    await db.put('settings', 'current', savedDocument);
    await initSettings(Promise.resolve(db));
    expect(learnStrictness.value).toBe('ime');
    expect(learnTargetMs.value).toBe(2000);
    setTrack('hiragana');
    await flush();
    expect(await db.get('settings', 'current')).toMatchObject({
      learn: { track: 'hiragana', sound: false, targetMs: 2000 },
    });
  });

  it('a saved value that fails validation is replaced by the defaults (ADR 061)', async () => {
    for (const bad of [
      'x',
      // The document of P5, with its `typing` block.
      { ...savedDocument, typing: { script: 'katakana', content: 'words' } },
      { ...savedDocument, learn: { ...savedDocument.learn, targetMs: 1100 } },
      { v: 1, script: 'katakana', content: 'words', strictness: 'ime', weakFocus: true },
    ]) {
      await db.put('settings', 'current', bad);
      await initSettings(Promise.resolve(db));
      expect(settingsReady.value).toBe(true);
      expect(learnTrack.value).toBe('hiragana');
      expect(learnTargetMs.value).toBe(1500);
    }
  });

  it('an unreadable database leaves the defaults and still becomes ready', async () => {
    await initSettings(Promise.reject(new Error('no database')));
    expect(settingsReady.value).toBe(true);
    expect(learnTrack.value).toBe('hiragana');
  });

  it('a failing write does not break the action', async () => {
    const failing: Db = { ...createMemoryDb(), put: () => Promise.reject(new Error('quota')) };
    await initSettings(Promise.resolve(failing));
    setTrack('katakana');
    await flush();
    expect(learnTrack.value).toBe('katakana');
  });

  it('setTargetMs accepts 1000–3000 in steps of 250 and ignores other values', () => {
    setTargetMs(3000);
    expect(learnTargetMs.value).toBe(3000);
    setTargetMs(1100);
    setTargetMs(500);
    setTargetMs(3250);
    expect(learnTargetMs.value).toBe(3000);
  });
});

describe('settings across tabs and failed writes', () => {
  function fakeChannel() {
    let listener: ((message: 'change' | 'reset') => void) | null = null;
    const posts = { count: 0 };
    const channel: ChangeChannel = {
      post: () => {
        posts.count += 1;
      },
      listen: (onChange) => {
        listener = onChange;
      },
    };
    return { channel, posts, fire: () => listener?.('change') };
  }

  it('returns to the defaults when sign-out deletes the document (Q3)', async () => {
    const db = createMemoryDb();
    await db.put('settings', 'current', savedDocument);
    const fake = fakeChannel();
    await initSettings(Promise.resolve(db), { now: () => 5 }, fake.channel);
    expect(learnTrack.value).toBe('katakana');

    await db.delete('settings', 'current');
    fake.fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(learnTrack.value).toBe('hiragana');
    expect(learnTargetMs.value).toBe(1500);
  });

  it('posts after a write and reads the document again when another tab posts', async () => {
    const db = createMemoryDb();
    const fake = fakeChannel();
    await initSettings(Promise.resolve(db), { now: () => 5 }, fake.channel);
    setTrack('hiragana');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.posts.count).toBe(1);

    await db.put('settings', 'current', {
      learn: { strictness: 'learner', track: 'katakana', targetMs: 2000, sound: true },
      updatedAt: 9,
    });
    fake.fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(learnTrack.value).toBe('katakana');
    expect(learnTargetMs.value).toBe(2000);
  });

  it('switches the database to memory when a write fails', async () => {
    const db: Db = { ...createMemoryDb(), put: () => Promise.reject(new Error('quota')) };
    await initSettings(Promise.resolve(db), { now: () => 5 }, fakeChannel().channel);
    setTrack('katakana');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(databaseMode.value).toBe('memory');
  });
});
