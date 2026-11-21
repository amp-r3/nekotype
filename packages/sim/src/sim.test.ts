import { describe, expect, it } from 'vitest';
import { basicIds, bothTracks, hiraganaItems } from './items';
import { createLearner, DAY_MS, REFERENCE } from './learner';
import { createCurrentPolicy } from './policies/current';
import {
  createFsrsPlanner,
  FSRS6_MODEL,
  freshCore,
  HALF_LIFE_MODEL,
  PLANNER_A2,
  PLANNER_A4,
} from './policies/fsrs-planner';
import { createRng } from './rng';
import { simulate } from './run';
import type { Answer } from './policy';
import { simulateDevices } from './devices';

const items = hiraganaItems();

describe('items', () => {
  it('has the 104 hiragana of the track, 46 of them basic', () => {
    expect(items).toHaveLength(104);
    expect(basicIds(items)).toHaveLength(46);
  });

  it('derives dependencies by the rule of learning.md', () => {
    const id = (kana: string): number => items.findIndex((item) => item.kana === kana);
    expect(items[id('が')]?.parts).toEqual([id('か')]);
    expect(items[id('きゃ')]?.parts).toEqual([id('き'), id('や')]);
    expect(items[id('あ')]?.parts).toEqual([]);
  });
});

describe('reference learner', () => {
  it('forgets with time and never recalls a kana it has not seen', () => {
    const learner = createLearner(items, 'beginner', 0, createRng(1));
    expect(learner.recallProbability(7, 0)).toBe(0);
    learner.study(7, 0);
    const soon = learner.recallProbability(7, 60_000);
    const later = learner.recallProbability(7, DAY_MS);
    expect(soon).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);
  });

  it('starts a knower with the basic kana remembered', () => {
    const learner = createLearner(items, 'knower', 0, createRng(3));
    for (const id of basicIds(items)) expect(learner.recallProbability(id, 0)).toBeGreaterThan(0.9);
  });
});

describe('simulate', () => {
  it('gives the same result for the same seed', () => {
    const a = simulate(createCurrentPolicy, 'beginner', 5, 5);
    const b = simulate(createCurrentPolicy, 'beginner', 5, 5);
    expect(a).toEqual(b);
  });

  it('stays within the sittings of the routine', () => {
    const result = simulate(createCurrentPolicy, 'beginner', 6, 5);
    expect(result.minutesPerDay).toBeLessThanOrEqual(12);
    expect(result.unlocked).toBeGreaterThan(5);
  });
});

describe('candidates', () => {
  it('the half-life model halves recall after one half-life and grows on a later-day recall', () => {
    const m = HALF_LIFE_MODEL.first(1);
    expect(HALF_LIFE_MODEL.recall(m, m.stability)).toBeCloseTo(0.5, 9);
    const later = HALF_LIFE_MODEL.next(m, 3, 1, false);
    expect(later.stability).toBeCloseTo(m.stability * 2.5, 9);
    const longer = HALF_LIFE_MODEL.next(later, 3, 1, false);
    expect(HALF_LIFE_MODEL.next(longer, 1, 1, false).stability).toBeCloseTo(
      longer.stability * 0.3,
      9,
    );
    // An error never takes the half-life below the first one.
    expect(HALF_LIFE_MODEL.next(m, 1, 1, false).stability).toBe(m.stability);
  });

  it('every candidate is deterministic and unlocks the basic kana of a knower within 3 days', () => {
    for (const factory of [
      createFsrsPlanner(PLANNER_A2),
      createFsrsPlanner(PLANNER_A2, HALF_LIFE_MODEL),
      createFsrsPlanner(PLANNER_A4),
    ]) {
      const a = simulate(factory, 'knower', 9, 3);
      expect(simulate(factory, 'knower', 9, 3)).toEqual(a);
      expect(a.unlockedBasicDay).toBeLessThanOrEqual(3);
    }
  });

  it('a fit whose only model is the default one changes nothing', () => {
    const plain = simulate(createFsrsPlanner(PLANNER_A2), 'beginner', 4, 6);
    const fitted = simulate(
      createFsrsPlanner({ ...PLANNER_A2, fit: [FSRS6_MODEL], fitAfter: 20 }),
      'beginner',
      4,
      6,
    );
    expect(fitted.fits.length).toBeGreaterThan(0);
    expect({ ...fitted, fits: [] }).toEqual(plain);
  });

  it('records forecasts in sessions that the run settles', () => {
    const result = simulate(createFsrsPlanner(PLANNER_A2), 'beginner', 2, 10);
    const rows = result.forecasts['all sessions'].row;
    expect(rows.length).toBeGreaterThan(10);
    for (const { forecast, actual } of rows) {
      expect(forecast).toBeGreaterThanOrEqual(1);
      expect(actual).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('part 4', () => {
  it('pairs each katakana with its hiragana', () => {
    const both = bothTracks();
    const id = (kana: string): number => both.findIndex((item) => item.kana === kana);
    expect(both[id('カ')]?.pair).toBe(id('か'));
    expect(both[id('か')]?.pair).toBe(id('カ'));
    expect(both[id('ファ')]?.pair).toBeUndefined();
    expect(basicIds(both, 'katakana')).toHaveLength(46);
  });

  it('gives a katakana a head start when its hiragana is recalled, with transfer', () => {
    const both = bothTracks();
    const kata = both.find((item) => item.kana === 'カ');
    const hira = kata?.pair;
    if (kata === undefined || hira === undefined) throw new Error('no pair');
    const plain = createLearner(both, 'beginner', 0, createRng(4), REFERENCE);
    const linked = createLearner(both, 'beginner', 0, createRng(4), { ...REFERENCE, transfer: 1 });
    for (const learner of [plain, linked]) {
      learner.study(hira, 0);
      learner.study(kata.id, 1000);
    }
    const later = DAY_MS / 4;
    expect(linked.recallProbability(kata.id, later)).toBeGreaterThan(
      plain.recallProbability(kata.id, later),
    );
  });

  it('rebuilds the planner state from its answers alone', () => {
    const answers: Answer[] = [];
    let live: ReturnType<ReturnType<typeof createFsrsPlanner>> | undefined;
    simulate(
      (its, rng) => {
        const planner = createFsrsPlanner(PLANNER_A4)(its, rng);
        live = planner;
        return {
          ...planner,
          session(now, first) {
            const session = planner.session(now, first);
            return {
              ...session,
              record(answer: Answer) {
                answers.push(answer);
                session.record(answer);
              },
            };
          },
        };
      },
      'beginner',
      3,
      5,
    );
    const rebuilt = createFsrsPlanner(PLANNER_A4)(items, createRng(99));
    rebuilt.adopt(freshCore(items, PLANNER_A4.goal));
    for (const answer of answers) rebuilt.apply(answer);
    expect(answers.length).toBeGreaterThan(100);
    expect(rebuilt.snapshot()).toEqual(live?.snapshot());
  });

  it('a clone plays forward without touching the original', () => {
    const planner = createFsrsPlanner(PLANNER_A4)(items, createRng(5));
    const before = planner.snapshot();
    const copy = planner.clone(createRng(6));
    const session = copy.session(0, true);
    const task = session.next(0);
    if (task === undefined) throw new Error('no task');
    session.record({ task, ok: true, ms: 1000, at: 0, wrong: undefined });
    expect(copy.unlocked()).toBe(1);
    expect(planner.snapshot()).toEqual(before);
  });

  it('merging by the answer log matches one device exactly', () => {
    const result = simulateDevices('answer log', 2, 6, 0.5);
    expect(result.stabilityError90).toBe(0);
    expect(result.phaseErrors).toBe(0);
  });
});
