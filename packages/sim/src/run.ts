import { basicIds, hiraganaItems } from './items';
import type { Item } from './items';
import { createLearner, DAY_MS, REFERENCE } from './learner';
import type { Learner, Profile, ReferenceParams } from './learner';
import type { Answer, Policy, Task } from './policy';
import { createRng } from './rng';
import type { Rng } from './rng';

/** The learner's routine: two sittings a day of about 5 minutes, sometimes one is skipped. */
export const SITTING_HOURS = [8, 20] as const;
export const SITTING_MS = 5 * 60_000;
export const SKIP_CHANCE = 0.15;
/** The goal of learning.md: the 46 basic hiragana; "reads" = expected recall ≥ 90% of them. */
export const READS_SHARE = 0.9;

/** How a forecast of introductions per session is made from the sessions so far. */
export type Estimator = 'last 6 sessions' | 'last 3 days' | 'all sessions';
export const ESTIMATORS: readonly Estimator[] = ['last 6 sessions', 'last 3 days', 'all sessions'];

/** A forecast in sessions made at the start of a session, and the number of sessions it took. */
export interface Outcome {
  readonly forecast: number;
  readonly actual: number;
}

/** The forecasts of one estimator over a run. */
export interface ForecastErrors {
  /** "The next row is fully unlocked in N sessions", made at every session. */
  readonly row: readonly Outcome[];
  /** "All 46 basic kana are unlocked in N sessions", made at every session until they are. */
  readonly basic: readonly Outcome[];
  /** Forecasts that could not be made (no introductions in the window). */
  readonly missing: number;
}

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
  /** Correct share of scheduled reviews of kana the policy holds as learned: the retention goal. */
  readonly reviewRetention: number;
  readonly reviews: number;
  /** Correct share of the first answer on a kana on a day after the day of its introduction. */
  readonly nextDay: number;
  /** Minutes of practice per practised day over the first 14 days. */
  readonly minutesPerDay: number;
  readonly sessions: number;
  readonly tasks: number;
  readonly forecasts: Readonly<Record<Estimator, ForecastErrors>>;
  readonly fits: readonly string[];
}

interface Pending {
  readonly estimator: Estimator;
  readonly target: 'row' | 'basic';
  readonly ids: readonly number[];
  readonly made: number;
  readonly forecast: number;
}

/** Introductions per session estimated from the sessions before `index`, or 0. */
function rate(
  estimator: Estimator,
  intros: readonly number[],
  days: readonly number[],
  day: number,
): number {
  let window: number[];
  switch (estimator) {
    case 'last 6 sessions':
      window = intros.slice(-6);
      break;
    case 'last 3 days':
      window = intros.filter((_, i) => (days[i] ?? 0) >= day - 3 && (days[i] ?? 0) < day);
      if (window.length === 0) window = intros.slice(-6);
      break;
    case 'all sessions':
      window = [...intros];
      break;
  }
  return window.length === 0 ? 0 : window.reduce((a, b) => a + b, 0) / window.length;
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
  reference: ReferenceParams = REFERENCE,
): RunResult {
  const items = hiraganaItems();
  const basic = basicIds(items);
  const rng = createRng(seed);
  const routine = createRng(seed ^ 0x5bd1e995);
  const start = 0;
  const learner = createLearner(items, profile, start, rng, reference);
  const policy = factory(items, createRng(seed ^ 0x27d4eb2f));
  const lastSeen = new Map<number, number>();

  let readsBasicDay: number | undefined;
  let readsTrackDay: number | undefined;
  let unlockedBasicDay: number | undefined;
  let unlockedWeek = 0;
  let retained = 0;
  let reviewsOk = 0;
  let reviews = 0;
  let nextDayOk = 0;
  let nextDayAnswers = 0;
  const introducedDay = new Map<number, number>();
  let retentionAnswers = 0;
  let practisedMs = 0;
  let practisedDays = 0;
  let sessions = 0;
  let tasks = 0;
  const introduced = new Set<number>();
  const intros: number[] = [];
  const sessionDays: number[] = [];
  const pending: Pending[] = [];
  const empty = (): { row: Outcome[]; basic: Outcome[]; missing: number } => ({
    row: [],
    basic: [],
    missing: 0,
  });
  const errors: Record<Estimator, ReturnType<typeof empty>> = {
    'last 6 sessions': empty(),
    'last 3 days': empty(),
    'all sessions': empty(),
  };
  const rows = [...new Set(items.map((item) => item.row))].map((row) =>
    items.filter((item) => item.row === row).map((item) => item.id),
  );

  function forecast(day: number): void {
    const row = rows.find((ids) => ids.some((id) => !introduced.has(id)));
    const targets = [
      ['row', row ?? []],
      ['basic', basic],
    ] as const;
    for (const [target, ids] of targets) {
      const remaining = ids.filter((id) => !introduced.has(id)).length;
      if (remaining === 0) continue;
      for (const estimator of ESTIMATORS) {
        const perSession = rate(estimator, intros, sessionDays, day);
        if (perSession <= 0) {
          errors[estimator].missing += 1;
          continue;
        }
        const n = Math.max(1, Math.ceil(remaining / perSession));
        pending.push({ estimator, target, ids, made: intros.length, forecast: n });
      }
    }
  }

  function settle(): void {
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const p = pending[i];
      if (p === undefined || !p.ids.every((id) => introduced.has(id))) continue;
      const actual = intros.length - p.made;
      errors[p.estimator][p.target].push({ forecast: p.forecast, actual });
      pending.splice(i, 1);
    }
  }

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
        let sessionIntros = 0;
        for (let task = session.next(now); task !== undefined; task = session.next(now)) {
          if (count === 0) forecast(day);
          if (task.kind === 'introduction') {
            introduced.add(task.item);
            sessionIntros += 1;
          }
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
          if (task.review) {
            reviews += 1;
            if (answer.ok) reviewsOk += 1;
          }
          const introDay = introducedDay.get(task.item);
          if (task.kind === 'introduction') introducedDay.set(task.item, day);
          else if (introDay !== undefined && introDay < day) {
            nextDayAnswers += 1;
            if (answer.ok) nextDayOk += 1;
            introducedDay.delete(task.item);
          }
          lastSeen.set(task.item, now);
          const ms = durationOf(answer);
          now += ms;
          dayMs += ms;
          count += 1;
          session.record(answer);
        }
        tasks += count;
        if (count > 0) {
          sessions += 1;
          intros.push(sessionIntros);
          sessionDays.push(day);
          settle();
        } else if (session.kind === 'learning') break;
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
    reviewRetention: reviews === 0 ? 1 : reviewsOk / reviews,
    reviews,
    nextDay: nextDayAnswers === 0 ? 1 : nextDayOk / nextDayAnswers,
    minutesPerDay: practisedDays === 0 ? 0 : practisedMs / practisedDays / 60_000,
    sessions,
    tasks,
    forecasts: errors,
    fits: policy.fits ?? [],
  };
}
