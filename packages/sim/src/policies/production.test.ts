import { ITEMS } from '@nekotype/model';
import { describe, expect, it } from 'vitest';
import { bothTracks, hiraganaItems } from '../items';
import { REFERENCE } from '../learner';
import type { Policy, Task } from '../policy';
import { simulate } from '../run';
import { createProductionPolicy } from './production';
import { createRng } from '../rng';

describe('the production policy', () => {
  it('maps every sim item to the key of the model, by position', () => {
    const keys = [...ITEMS.values()];
    for (const items of [hiraganaItems(), bothTracks()]) {
      for (const item of items) {
        const entry = keys[item.id];
        expect(entry?.kana).toBe(item.kana);
        expect(entry?.track).toBe(item.track);
      }
    }
    expect(hiraganaItems()).toHaveLength(104);
    expect(bothTracks()).toHaveLength(keys.length);
    // Both factories build: the mapping is checked when the policy is created.
    createProductionPolicy()(hiraganaItems(), createRng(1));
    createProductionPolicy('katakana')(bothTracks(), createRng(1));
  });

  it('refuses items that are not the model’s', () => {
    const swapped = hiraganaItems().map((item) => ({ ...item, id: (item.id + 1) % 104 }));
    expect(() => createProductionPolicy()(swapped, createRng(1))).toThrow();
  });

  it('runs two seeds of seven days with the beginner, and again the same', () => {
    for (const seed of [1, 2]) {
      const a = simulate(createProductionPolicy(), 'beginner', seed, 7);
      const b = simulate(createProductionPolicy(), 'beginner', seed, 7);
      expect(a).toEqual(b);
      expect(a.minutesPerDay).toBeGreaterThan(0);
      expect(a.reviews).toBeGreaterThan(0);
      expect(a.unlockedWeek).toBeGreaterThan(10);
    }
  });

  it('runs with both tracks', () => {
    const result = simulate(createProductionPolicy(), 'beginner', 3, 7, REFERENCE, {
      tracks: 'both',
    });
    expect(result.unlockedWeek).toBeGreaterThan(10);
  });

  it('ends a session after 30 tasks, offers recognition with four options and starts afresh', () => {
    const items = hiraganaItems();
    const policy: Policy = createProductionPolicy()(items, createRng(5));
    let at = 0;
    const tasks: Task[] = [];
    const session = policy.session(at, true);
    for (let task = session.next(at); task !== undefined; task = session.next(at)) {
      tasks.push(task);
      session.record({ task, ok: true, ms: 800, at, wrong: undefined });
      at += 10_000;
    }
    expect(tasks.length).toBeLessThanOrEqual(30);
    expect(tasks[0]?.kind).toBe('introduction');
    expect(session.next(at)).toBeUndefined();
    for (const task of tasks.filter((t) => t.kind === 'recognition')) {
      expect(task.options).toHaveLength(4);
      expect(task.options).toContain(task.item);
    }
    expect(policy.unlocked()).toBe(tasks.filter((t) => t.kind === 'introduction').length);
    expect(policy.session(at, false).next(at)).toBeDefined();
  });

  it('records wrong answers with the kana they were confused with', () => {
    const items = hiraganaItems();
    const policy = createProductionPolicy()(items, createRng(9));
    const session = policy.session(0, true);
    const first = session.next(0);
    if (first === undefined) throw new Error('no first task');
    session.record({ task: first, ok: true, ms: 1000, at: 0, wrong: undefined });
    const second = session.next(60_000);
    if (second === undefined) throw new Error('no second task');
    session.record({ task: second, ok: false, ms: 20_000, at: 60_000, wrong: 3 });
    expect(session.next(120_000)).toBeDefined();
  });
});
