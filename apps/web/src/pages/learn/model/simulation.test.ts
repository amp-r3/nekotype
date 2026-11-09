import { describe, it, expect, vi } from 'vitest';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { createMemoryDb } from '@/shared/lib';
import { canonicalFor } from '@/entities/prompt';
import { createLearnStore, dependenciesOf, isConfident } from '@/entities/learn';
import { createLearnSession } from './session';
import type { LearnSession, TaskPort } from './session';
import { Clock0, Timers, seededRng } from '../lib/test-util';

const TARGET_MS = 1500;
const KEY_MS = 250;
const SESSIONS = 40;

const noPort: TaskPort = {
  setBuffer: () => undefined,
  type: () => undefined,
  reject: () => undefined,
  finish: () => undefined,
  reset: () => undefined,
};

const kanaOf = (key: LearnKanaKey): string => key.slice(key.indexOf(':') + 1);

/**
 * A learner who gets better with practice: the chance of a mistake on a kana falls from 30 % with
 * every recall answer to 2 %, and every key takes 250 ms. Forty sessions of hiragana from zero
 * show that the unlocking neither skips a dependency nor stalls (ADR 063).
 */
async function simulate() {
  const clock = new Clock0();
  const timers = new Timers();
  const db = createMemoryDb();
  const store = createLearnStore({
    db: () => Promise.resolve(db),
    clock,
    scheduler: timers,
    targetMs: () => TARGET_MS,
  });
  await store.init();
  const rng = seededRng(1);
  const recalled = new Map<LearnKanaKey, number>();
  const seen = new Set<LearnKanaKey>(store.state.value.unlocked.hiragana);
  const violations: string[] = [];
  const unlockedAfter: number[] = [];

  const checkUnlocks = (): void => {
    const state = store.state.value;
    for (const key of state.unlocked.hiragana) {
      if (seen.has(key)) continue;
      seen.add(key);
      for (const dep of dependenciesOf('hiragana', kanaOf(key))) {
        if (!isConfident(state.recent[dep] ?? [], TARGET_MS)) {
          violations.push(`${key} unlocked before ${dep} was confident`);
        }
      }
    }
  };

  const type = (session: LearnSession, text: string): void => {
    for (const char of text) {
      clock.time += KEY_MS;
      session.handleIntent({ kind: 'char', char });
    }
  };

  for (let n = 0; n < SESSIONS; n++) {
    const session = createLearnSession({
      track: 'hiragana',
      store,
      clock,
      scheduler: timers,
      rng,
      audio: { play: vi.fn() },
      strictness: () => 'learner',
      targetMs: () => TARGET_MS,
    });
    session.start();
    while (session.phase.value !== 'summary') {
      const task = session.task.value;
      if (task === null) throw new Error('no task');
      session.attach(noPort);
      const done = recalled.get(task.key) ?? 0;
      const mistake = rng.next() < Math.max(0.02, 0.3 * 0.7 ** done);
      if (task.kind === 'introduction') {
        type(session, task.romaji);
      } else if (task.kind === 'recall') {
        if (mistake) type(session, 'q');
        type(session, canonicalFor(task.key));
        recalled.set(task.key, done + 1);
      } else {
        const right = task.options.indexOf(task.key);
        const wrong = task.options.findIndex((key) => key !== task.key);
        session.choose(mistake ? wrong : right);
        if (session.phase.value === 'waiting') session.advance();
      }
      checkUnlocks();
      timers.flush();
    }
    unlockedAfter.push(store.state.value.unlocked.hiragana.length);
  }

  // The first sessions are the warm-up: the five vowels need 10 recall answers each before the
  // first unlock. A stall is counted from that first unlock on.
  const first = unlockedAfter.findIndex((count) => count > (unlockedAfter[0] ?? 0));
  let stalled = 0;
  let longest = 0;
  for (let i = first + 1; i < unlockedAfter.length; i++) {
    const grew = (unlockedAfter[i] ?? 0) > (unlockedAfter[i - 1] ?? 0);
    stalled = grew ? 0 : stalled + 1;
    longest = Math.max(longest, stalled);
  }
  return { violations, longest, first, unlocked: unlockedAfter[unlockedAfter.length - 1] ?? 0 };
}

describe('simulation: 40 learning sessions of hiragana from zero', () => {
  it('never unlocks a kana before its dependencies are confident, and does not stall', async () => {
    const result = await simulate();
    // Measured with seededRng(1): the first unlock after session 5, the longest stall 2 sessions,
    // 26 kana after 40 sessions. Without ADR 063 (an unconfident kana out of focus): a stall of 7
    // sessions in a row and 21 kana.
    expect(result.violations).toEqual([]);
    expect(result.first).toBeGreaterThanOrEqual(0);
    expect(result.longest).toBeLessThanOrEqual(3);
    expect(result.unlocked).toBeGreaterThanOrEqual(24);
  });
});
