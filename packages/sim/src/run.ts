import { basicIds, hiraganaItems } from './items';
import type { Item } from './items';
import { createLearner, DAY_MS } from './learner';
import type { Learner, Profile } from './learner';
import type { Answer, Policy, Task } from './policy';
import { createRng } from './rng';
import type { Rng } from './rng';

/** The learner's routine: two sittings a day of about 5 minutes, sometimes one is skipped. */
export const SITTING_HOURS = [8, 20] as const;
export const SITTING_MS = 5 * 60_000;
export const SKIP_CHANCE = 0.15;
/** The goal of learning.md: the 46 basic hiragana; "reads" = expected recall ≥ 90% of them. */
export const READS_SHARE = 0.9;

export interface RunResult {
  readonly profile: Profile;
  /** First day (1-based) whose morning, before practice, the learner reads 90% of the 46 basic. */
  readonly readsBasicDay: number | undefined;
  /** The same for 90% of the whole track (104 kana). */
  readonly readsTrackDay: number | undefined;
  /** First day the policy has unlocked all 46 basic kana. */
  readonly unlockedBasicDay: number | undefined;
  /** Kana unlocked at the end of day 7. */
  readonly unlockedWeek: number;
  /** Kana unlocked at the end. */
  readonly unlocked: number;
  /** Correct share of answers on a kana last seen on an earlier day (reviews in the broad sense). */
  readonly retention: number;
  readonly retentionAnswers: number;
  /** Minutes of practice per practised day over the first 14 days. */
  readonly minutesPerDay: number;
  readonly sessions: number;
  readonly tasks: number;
}

export type PolicyFactory = (items: readonly Item[], rng: Rng) => Policy;

function perform(learner: Learner, items: readonly Item[], task: Task, now: number): Answer {
  switch (task.kind) {
    case 'introduction': {
      learner.study(task.item, now);
      const ms = 1500 + 120 * (items[task.item]?.keys ?? 2);
      return { task, ok: true, ms, at: now, wrong: undefined };
    }
    case 'recall': {
      const r = learner.recall(task.item, now);
      return { task, ok: r.ok, ms: r.ms, at: now, wrong: r.confusedWith };
    }
    case 'recognition': {
      const r = learner.recognize(task.item, task.options, now);
      return { task, ok: r.ok, ms: r.ms, at: now, wrong: r.ok ? undefined : r.chosen };
    }
  }
}

/**
 * Time a task takes on screen: reading the prompt, the answer, the 400 ms pause, reading the right
 * answer after an error, and an introduction's reading.
 */
function durationOf(answer: Answer): number {
  const reading = answer.task.kind === 'introduction' ? 3000 : 0;
  const error = answer.ok ? 0 : 1500;
  return 1000 + answer.ms + 400 + reading + error;
}

export function simulate(
  factory: PolicyFactory,
  profile: Profile,
  seed: number,
  days: number,
): RunResult {
  const items = hiraganaItems();
  const basic = basicIds(items);
  const rng = createRng(seed);
  const routine = createRng(seed ^ 0x5bd1e995);
  const start = 0;
  const learner = createLearner(items, profile, start, rng);
  const policy = factory(items, createRng(seed ^ 0x27d4eb2f));
  const lastSeen = new Map<number, number>();

  let readsBasicDay: number | undefined;
  let readsTrackDay: number | undefined;
  let unlockedBasicDay: number | undefined;
  let unlockedWeek = 0;
  let retained = 0;
  let retentionAnswers = 0;
  let practisedMs = 0;
  let practisedDays = 0;
  let sessions = 0;
  let tasks = 0;

  for (let day = 0; day < days; day += 1) {
    const morning = start + day * DAY_MS + (SITTING_HOURS[0] - 1) * 3_600_000;
    const expected = basic.reduce((sum, id) => sum + learner.recallProbability(id, morning), 0);
    if (readsBasicDay === undefined && expected >= READS_SHARE * basic.length)
      readsBasicDay = day + 1;
    const all = items.reduce((sum, item) => sum + learner.recallProbability(item.id, morning), 0);
    if (readsTrackDay === undefined && all >= READS_SHARE * items.length) readsTrackDay = day + 1;

    let dayMs = 0;
    for (const hour of SITTING_HOURS) {
      if (routine.next() < SKIP_CHANCE) continue;
      let now = start + day * DAY_MS + hour * 3_600_000;
      const end = now + SITTING_MS;
      let first = true;
      while (now < end) {
        const session = policy.session(now, first);
        first = false;
        let count = 0;
        for (let task = session.next(now); task !== undefined; task = session.next(now)) {
          const answer = perform(learner, items, task, now);
          const seenAt = lastSeen.get(task.item);
          if (
            task.kind !== 'introduction' &&
            seenAt !== undefined &&
            Math.floor(seenAt / DAY_MS) < day
          ) {
            retentionAnswers += 1;
            if (answer.ok) retained += 1;
          }
          lastSeen.set(task.item, now);
          const ms = durationOf(answer);
          now += ms;
          dayMs += ms;
          count += 1;
          session.record(answer);
        }
        tasks += count;
        if (count > 0) sessions += 1;
        else if (session.kind === 'learning') break;
      }
    }
    if (dayMs > 0 && day < 14) {
      practisedMs += dayMs;
      practisedDays += 1;
    }
    if (unlockedBasicDay === undefined && policy.unlocked() >= basic.length)
      unlockedBasicDay = day + 1;
    if (day === 6) unlockedWeek = policy.unlocked();
  }

  return {
    profile,
    readsBasicDay,
    readsTrackDay,
    unlockedBasicDay,
    unlockedWeek,
    unlocked: policy.unlocked(),
    retention: retentionAnswers === 0 ? 1 : retained / retentionAnswers,
    retentionAnswers,
    minutesPerDay: practisedDays === 0 ? 0 : practisedMs / practisedDays / 60_000,
    sessions,
    tasks,
  };
}
