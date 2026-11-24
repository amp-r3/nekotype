import { describe, it, expect, vi } from 'vitest';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { dependenciesOf } from '@/entities/learn';
import { canonicalFor } from '@/entities/learn';
import { createLearnSession } from './session';
import type { LearnSession, TaskPort } from './session';
import { Clock0, Timers, readyStore, seededRng } from '../lib/test-util';

const KEY_MS = 250;
const SESSIONS = 40;
/** Two sittings a day. */
const BETWEEN_SESSIONS_MS = 12 * 3_600_000;

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
 * every answer to 2 %, and every key takes 250 ms. Forty sessions of hiragana from zero, two a
 * day, show that the planner neither introduces a kana before its parts are learned nor stalls.
 */
async function simulate() {
  const clock = new Clock0();
  const timers = new Timers();
  const store = await readyStore(clock, timers);
  const rng = seededRng(1);
  const answered = new Map<LearnKanaKey, number>();
  const seen = new Set<LearnKanaKey>();
  const violations: string[] = [];
  const introducedAfter: number[] = [];

  const checkIntroductions = (): void => {
    const view = store.view.value;
    if (view === null) return;
    for (const [key, kana] of view.kana) {
      if (kana.state === 'locked' || seen.has(key)) continue;
      seen.add(key);
      for (const dep of dependenciesOf('hiragana', kanaOf(key))) {
        const state = view.kana.get(dep)?.state;
        if (state !== 'learned' && state !== 'mastered') {
          violations.push(`${key} introduced before ${dep} was learned`);
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
    });
    session.start();
    while (session.phase.value !== 'summary') {
      const task = session.task.value;
      if (task === null) throw new Error('no task');
      session.attach(noPort);
      const done = answered.get(task.key) ?? 0;
      const mistake = rng.next() < Math.max(0.02, 0.3 * 0.7 ** done);
      if (task.kind === 'introduction') {
        type(session, task.romaji);
      } else if (task.kind === 'recall') {
        if (mistake) type(session, 'q');
        type(session, canonicalFor(task.key));
        answered.set(task.key, done + 1);
      } else {
        const right = task.options.indexOf(task.key);
        const wrong = task.options.findIndex((key) => key !== task.key);
        session.choose(mistake ? wrong : right);
        answered.set(task.key, done + 1);
        if (session.phase.value === 'waiting') session.advance();
      }
      timers.flush();
      checkIntroductions();
    }
    clock.time += BETWEEN_SESSIONS_MS;
    introducedAfter.push(store.view.value?.introduced.hiragana ?? 0);
  }
  return { violations, introduced: introducedAfter, view: store.view.value };
}

describe('simulation: 40 learning sessions of hiragana from zero', () => {
  it('never introduces a kana before its parts are learned, and does not stall', async () => {
    const result = await simulate();
    // Measured with seededRng(1): 82 kana introduced after 40 sessions, none of them early, and
    // a session without a new kana is followed by one with.
    expect(result.violations).toEqual([]);
    expect(result.introduced.at(-1)).toBeGreaterThanOrEqual(70);
    // A stall: a run of sessions that introduce nothing.
    let stalled = 0;
    let longest = 0;
    for (let i = 1; i < result.introduced.length; i++) {
      const grew = (result.introduced[i] ?? 0) > (result.introduced[i - 1] ?? 0);
      stalled = grew ? 0 : stalled + 1;
      longest = Math.max(longest, stalled);
    }
    expect(longest).toBeLessThanOrEqual(2);
  });
});
