import { basicIds, hiraganaItems } from './items';
import { createLearner, DAY_MS, REFERENCE } from './learner';
import type { ReferenceParams } from './learner';
import { createFsrsPlanner, freshCore, PLANNER_A4 } from './policies/fsrs-planner';
import type { Planner, PlannerCore, PlannerParams, State } from './policies/fsrs-planner';
import type { Answer } from './policy';
import { createRng } from './rng';
import { durationOf, perform, READS_SHARE, SITTING_HOURS, SITTING_MS, SKIP_CHANCE } from './run';

/**
 * Part 4: one learner on two devices, the morning sitting on one and the evening sitting on the
 * other. A device syncs at the start and the end of a sitting, unless it is offline then. How the
 * state of the two devices is merged:
 *
 * - `one device`: the baseline, a single planner that sees every answer at once;
 * - `answer log`: the server keeps every answer; a device sends its new answers and rebuilds its
 *   state by applying the whole log in time order to a fresh planner;
 * - `last state`: the server keeps one state per kana; a merge keeps, for each kana, the state
 *   whose last answer is later, and the learner-wide values of the side answered last.
 */

export type Strategy = 'one device' | 'answer log' | 'last state';

export interface DevicesResult {
  readonly readsBasicDay: number | undefined;
  readonly reviewRetention: number;
  readonly minutesPerDay: number;
  /** Median |ln(S / S of the full log)| over the introduced kana, after the final sync. */
  readonly stabilityError: number;
  /** The 90th percentile of the same. */
  readonly stabilityError90: number;
  /** Kana whose phase differs from the full log's after the final sync. */
  readonly phaseErrors: number;
  /** Answers in the log at the end. */
  readonly answers: number;
}

function mergeCores(a: PlannerCore, b: PlannerCore): PlannerCore {
  const later = (a.lastAnswerAt ?? 0) >= (b.lastAnswerAt ?? 0) ? a : b;
  const states: State[] = a.states.map((s, id) => {
    const other = b.states[id];
    if (other === undefined) return s;
    if (s.phase === 'new') return other;
    if (other.phase === 'new') return s;
    return other.lastAt > s.lastAt ? other : s;
  });
  return structuredClone({ ...later, states });
}

export function simulateDevices(
  strategy: Strategy,
  seed: number,
  days: number,
  offline: number,
  params: PlannerParams = PLANNER_A4,
  reference: ReferenceParams = REFERENCE,
): DevicesResult {
  const items = hiraganaItems();
  const basic = basicIds(items);
  const learner = createLearner(items, 'beginner', 0, createRng(seed), reference);
  const routine = createRng(seed ^ 0x5bd1e995);
  const network = createRng(seed ^ 0x68e31da4);
  const factory = createFsrsPlanner(params);
  const devices: Planner[] = [
    factory(items, createRng(seed ^ 0x27d4eb2f)),
    factory(items, createRng(seed ^ 0x165667b1)),
  ];
  const log: Answer[] = [];
  const unsent: Answer[][] = [[], []];
  let server: PlannerCore = freshCore(items, params.goal);

  function sync(index: number): void {
    const device = devices[index];
    const local = unsent[index];
    if (device === undefined || local === undefined) return;
    if (network.next() < offline) return;
    if (strategy === 'answer log') {
      log.push(...local);
      log.sort((x, y) => x.at - y.at);
      device.adopt(freshCore(items, params.goal));
      for (const answer of log) device.apply(answer);
    } else if (strategy === 'last state') {
      server = mergeCores(server, device.snapshot());
      device.adopt(server);
    }
    local.length = 0;
  }

  let readsBasicDay: number | undefined;
  let reviews = 0;
  let reviewsOk = 0;
  let practisedMs = 0;
  let practisedDays = 0;
  const all: Answer[] = [];

  for (let day = 0; day < days; day += 1) {
    const morning = day * DAY_MS + (SITTING_HOURS[0] - 1) * 3_600_000;
    const expected = basic.reduce((sum, id) => sum + learner.recallProbability(id, morning), 0);
    if (readsBasicDay === undefined && expected >= READS_SHARE * basic.length)
      readsBasicDay = day + 1;
    let dayMs = 0;
    for (const [sitting, hour] of SITTING_HOURS.entries()) {
      if (routine.next() < SKIP_CHANCE) continue;
      const index = strategy === 'one device' ? 0 : sitting;
      const device = devices[index];
      if (device === undefined) continue;
      sync(index);
      let now = day * DAY_MS + hour * 3_600_000;
      const end = now + SITTING_MS;
      let first = true;
      while (now < end) {
        const session = device.session(now, first);
        first = false;
        let count = 0;
        for (let task = session.next(now); task !== undefined; task = session.next(now)) {
          const answer = perform(learner, items, task, now);
          if (task.review) {
            reviews += 1;
            if (answer.ok) reviewsOk += 1;
          }
          session.record(answer);
          unsent[index]?.push(answer);
          all.push(answer);
          const ms = durationOf(answer);
          now += ms;
          dayMs += ms;
          count += 1;
        }
        if (count === 0) break;
      }
      sync(index);
    }
    if (dayMs > 0 && day < 14) {
      practisedMs += dayMs;
      practisedDays += 1;
    }
  }

  // The final state: every answer synced, on device 0.
  const final = devices[0];
  if (final === undefined) throw new Error('no device');
  if (strategy === 'answer log') {
    log.push(...(unsent[0] ?? []), ...(unsent[1] ?? []));
    log.sort((x, y) => x.at - y.at);
    final.adopt(freshCore(items, params.goal));
    for (const answer of log) final.apply(answer);
  } else if (strategy === 'last state') {
    const other = devices[1];
    if (other !== undefined) {
      server = mergeCores(mergeCores(server, final.snapshot()), other.snapshot());
      final.adopt(server);
    }
  }
  const truth = factory(items, createRng(1));
  for (const answer of all) truth.apply(answer);
  const got = final.snapshot().states;
  const want = truth.snapshot().states;
  const errors: number[] = [];
  let phaseErrors = 0;
  for (const [id, w] of want.entries()) {
    const g = got[id];
    if (g === undefined || w.phase === 'new') continue;
    if (g.phase !== w.phase) phaseErrors += 1;
    const sg = g.memory?.stability ?? 1e-3;
    const sw = w.memory?.stability ?? 1e-3;
    errors.push(Math.abs(Math.log(sg / sw)));
  }
  errors.sort((x, y) => x - y);
  return {
    readsBasicDay,
    reviewRetention: reviews === 0 ? 1 : reviewsOk / reviews,
    minutesPerDay: practisedDays === 0 ? 0 : practisedMs / practisedDays / 60_000,
    stabilityError: errors[Math.floor(errors.length / 2)] ?? 0,
    stabilityError90: errors[Math.floor(errors.length * 0.9)] ?? 0,
    phaseErrors,
    answers: all.length,
  };
}
