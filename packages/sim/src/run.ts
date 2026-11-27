import { basicIds, bothTracks, hiraganaItems } from './items';
import type { Item } from './items';
import { createLearner, DAY_MS, REFERENCE } from './learner';
import type { Learner, Profile, ReferenceParams } from './learner';
import type { Answer, Policy, Task } from './policy';
import type { Timing } from './timing';
import type { Planner } from './policies/fsrs-planner';
import { createRng } from './rng';
import type { Rng } from './rng';

/** The learner's routine: two sittings a day of about 5 minutes, sometimes one is skipped. */
export const SITTING_HOURS = [8, 20] as const;
export const SITTING_MS = 5 * 60_000;
export const SKIP_CHANCE = 0.15;
/** The goal of learning.md: the 46 basic hiragana; "reads" = expected recall ≥ 90% of them. */
export const READS_SHARE = 0.9;

/**
 * How a forecast in sessions is made: from the kana introduced per session so far, or (`forward`,
 * part 4) by playing the planner forward: the learner answers as the planner's memory model
 * predicts (`forward`), or with the learner's observed share of correct answers on learning tasks
 * and on reviews (`forward, observed`); `forward, corrected` multiplies the observed one by the
 * median ratio of actual to forecast sessions of its last 10 settled forecasts for the same target.
 */
export type Estimator =
  | 'last 6 sessions'
  | 'last 3 days'
  | 'all sessions'
  | 'forward'
  | 'forward, observed'
  | 'forward, corrected';
export type RateEstimator = Exclude<
  Estimator,
  'forward' | 'forward, observed' | 'forward, corrected'
>;
export const ESTIMATORS: readonly RateEstimator[] = [
  'last 6 sessions',
  'last 3 days',
  'all sessions',
];

/** A forecast in sessions made at the start of a session, and the number of sessions it took. */
export interface Outcome {
  readonly forecast: number;
  readonly actual: number;
  /** The forward forecast's 10th and 90th percentiles. */
  readonly low: number | undefined;
  readonly high: number | undefined;
}

/** Options of a run beyond the learner (part 4). */
export interface SimOptions {
  /** Runs of the forward forecast; 0 turns it off. It needs a planner with `clone`. */
  readonly forward?: number;
  /** Forecasts only at the first session of each day, instead of at every session. */
  readonly daily?: boolean;
  /** Both tracks instead of hiragana only. */
  readonly tracks?: 'hiragana' | 'both';
  /** The learner's answer-time model (adaptive answer-time research); P7's without it. */
  readonly timing?: Timing;
  /**
   * A placement test (P11) before the first day: this many timed recalls of the basic kana in
   * track order, given to `Policy.calibrate` only. The learner's memory takes them as recalls.
   */
  readonly placement?: number;
}

/** The longest forecast the forward estimator plays, in sessions. */
const FORWARD_MAX = 60;

function isPlanner(policy: Policy): policy is Planner {
  return 'clone' in policy && 'predict' in policy;
}

/** The learner's observed share of correct answers, on learning tasks and on reviews. */
interface Accuracy {
  readonly learning: number;
  readonly review: number;
}

/**
 * Sessions until every kana of `ids` is introduced, playing a copy of the planner forward: the
 * learner answers as the planner's own model predicts, or with the observed `accuracy`; the
 * current sitting runs to `sittingEnd`,
 * and the next sittings start every `gapMs` and last `sittingMs`. FORWARD_MAX + 1 when not reached.
 */
function playForward(
  planner: Planner,
  ids: readonly number[],
  now: number,
  sittingEnd: number,
  gapMs: number,
  sittingMs: number,
  rng: Rng,
  accuracy: Accuracy | undefined,
): number {
  const copy = planner.clone(rng);
  const done = (): boolean => {
    const known = new Set(copy.introduced());
    return ids.every((id) => known.has(id));
  };
  let sessions = 0;
  let start = sittingEnd - sittingMs;
  let end = sittingEnd;
  let t = now;
  while (sessions <= FORWARD_MAX) {
    while (t < end) {
      const session = copy.session(t, false);
      let count = 0;
      for (let task = session.next(t); task !== undefined; task = session.next(t)) {
        const p = copy.predict(task.item, t);
        const modelled = task.kind === 'recognition' ? p + (1 - p) / 4 : p;
        const observed = task.review ? accuracy?.review : accuracy?.learning;
        const chance = observed ?? modelled;
        const ok = task.kind === 'introduction' || rng.next() < chance;
        const ms = task.kind === 'introduction' ? 1800 : ok ? 1200 : 2500;
        const answer: Answer = { task, ok, ms, at: t, wrong: undefined };
        session.record(answer);
        t += durationOf(answer);
        count += 1;
      }
      if (count === 0) break;
      sessions += 1;
      if (done()) return sessions;
      if (sessions > FORWARD_MAX) break;
    }
    start += gapMs;
    end = start + sittingMs;
    t = start;
  }
  return FORWARD_MAX + 1;
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
  /** The same for 90% of the whole track (104 kana; with both tracks, all 229). */
  readonly readsTrackDay: number | undefined;
  /** With both tracks: the same for the 46 basic katakana. */
  readonly readsKatakanaDay: number | undefined;
  /** With both tracks: first day the 46 basic katakana are unlocked. */
  readonly unlockedKatakanaDay: number | undefined;
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
  /** Expected kana of the track recalled, each morning before practice (index = day − 1). */
  readonly known: readonly number[];
  /** Expected kana of the track recalled 7 and 30 days after the last day, with no practice. */
  readonly afterBreak: readonly [number, number];
  /**
   * Per item id, the 1-based session and day (from 1) of its introduction and of the first time the
   * policy held it as learned at the end of a session (P9 research); learned only with `learned`.
   */
  readonly milestones: ReadonlyMap<number, Milestone>;
  /** Word tasks (P9 research, part 2) and those read without an error; they are in `tasks` too. */
  readonly words: number;
  readonly wordsOk: number;
  /** Part 3: words given again on a day they were already read, and the session of the first word. */
  readonly wordRepeats: number;
  readonly firstWordSession: number | undefined;
}

export interface Milestone {
  readonly introducedSession: number;
  readonly introducedDay: number;
  readonly learnedSession: number | undefined;
  readonly learnedDay: number | undefined;
}

interface Pending {
  readonly estimator: Estimator;
  readonly target: 'row' | 'basic';
  readonly ids: readonly number[];
  readonly made: number;
  readonly forecast: number;
  readonly low: number | undefined;
  readonly high: number | undefined;
}

/** Introductions per session estimated from the sessions before `index`, or 0. */
function rate(
  estimator: RateEstimator,
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

export function perform(learner: Learner, items: readonly Item[], task: Task, now: number): Answer {
  switch (task.kind) {
    case 'introduction': {
      learner.study(task.item, now);
      const ms = 1500 + 120 * (items[task.item]?.keys ?? 2);
      return { task, ok: true, ms, at: now, wrong: undefined };
    }
    case 'recall': {
      const r = learner.recall(task.item, now);
      return { task, ok: r.ok, ms: r.ms, at: now, wrong: r.confusedWith, p: r.p };
    }
    case 'recognition': {
      const r = learner.recognize(task.item, task.options, now);
      return { task, ok: r.ok, ms: r.ms, at: now, wrong: r.ok ? undefined : r.chosen };
    }
    case 'word': {
      const reads = learner.read(task.word ?? [task.item], now);
      const miss = reads.find((r) => !r.ok);
      const ms = reads.reduce((sum, r) => sum + r.ms, 0);
      return { task, ok: miss === undefined, ms, at: now, wrong: miss?.confusedWith, reads };
    }
  }
}

/**
 * Time a task takes on screen: reading the prompt, the answer, the 400 ms pause, reading the right
 * answer after an error, and an introduction's reading.
 */
export function durationOf(answer: Answer): number {
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
  options: SimOptions = {},
): RunResult {
  const items = options.tracks === 'both' ? bothTracks() : hiraganaItems();
  const basic = basicIds(items);
  const kataBasic = options.tracks === 'both' ? basicIds(items, 'katakana') : [];
  let readsKatakanaDay: number | undefined;
  let unlockedKatakanaDay: number | undefined;
  const sittingStarts: number[] = [];
  let sittingEnd = 0;
  const forwardRng = createRng(seed ^ 0x1b873593);
  const outcomes: { learning: boolean[]; review: boolean[] } = { learning: [], review: [] };
  const share = (list: readonly boolean[]): number | undefined => {
    const recent = list.slice(-200);
    return recent.length < 20 ? undefined : recent.filter(Boolean).length / recent.length;
  };
  const rng = createRng(seed);
  const routine = createRng(seed ^ 0x5bd1e995);
  const start = 0;
  const learner = createLearner(items, profile, start, rng, reference, options.timing);
  const policy = factory(items, createRng(seed ^ 0x27d4eb2f));
  const lastSeen = new Map<number, number>();
  const known: number[] = [];
  const placement = Math.min(options.placement ?? 0, basic.length);
  if (placement > 0 && policy.calibrate !== undefined) {
    let now = start + (SITTING_HOURS[0] - 1) * 3_600_000;
    const answers: Answer[] = [];
    for (const id of basic.slice(0, placement)) {
      const task: Task = { item: id, kind: 'recall', options: [], review: true };
      const answer = perform(learner, items, task, now);
      answers.push(answer);
      now += durationOf(answer);
    }
    policy.calibrate(answers);
  }

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
  let words = 0;
  let wordsOk = 0;
  let wordRepeats = 0;
  let firstWordSession: number | undefined;
  const wordDay = new Map<string, number>();
  const introduced = new Set<number>();
  const milestones = new Map<number, Milestone>();
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
    forward: empty(),
    'forward, observed': empty(),
    'forward, corrected': empty(),
  };
  const rows = [...new Set(items.map((item) => item.row))].map((row) =>
    items.filter((item) => item.row === row).map((item) => item.id),
  );

  function forecast(day: number, now: number): void {
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
        pending.push({
          estimator,
          target,
          ids,
          made: intros.length,
          forecast: n,
          low: undefined,
          high: undefined,
        });
      }
      if (target === 'row' && options.forward !== undefined && policy.forecast !== undefined) {
        // The production model forecasts itself; `forward, observed` holds the raw median it keeps
        // as history and `forward, corrected` the corrected one with its range.
        const history = errors['forward, observed'].row.map((o) => ({
          forecast: o.forecast,
          actual: o.actual,
        }));
        const made = policy.forecast(ids, now, history);
        if (made !== undefined) {
          pending.push({
            estimator: 'forward, observed',
            target,
            ids,
            made: intros.length,
            forecast: made.raw,
            low: undefined,
            high: undefined,
          });
          pending.push({
            estimator: 'forward, corrected',
            target,
            ids,
            made: intros.length,
            forecast: made.median,
            low: made.low,
            high: made.high,
          });
        }
      }
      const runs = options.forward ?? 0;
      if (runs > 0 && isPlanner(policy)) {
        const gaps = sittingStarts
          .slice(-11)
          .flatMap((t, i, all) => (i === 0 ? [] : [t - (all[i - 1] ?? t)]))
          .sort((a, b) => a - b);
        const gapMs = gaps[Math.floor(gaps.length / 2)] ?? 12 * 3_600_000;
        const learning = share(outcomes.learning);
        const review = share(outcomes.review);
        const accuracy =
          learning === undefined ? undefined : { learning, review: review ?? learning };
        const play = (observed: boolean): number[] =>
          Array.from({ length: runs }, () =>
            playForward(
              policy,
              ids,
              now,
              sittingEnd,
              gapMs,
              SITTING_MS,
              forwardRng,
              observed ? accuracy : undefined,
            ),
          ).sort((a, b) => a - b);
        const quantiles = (played: readonly number[]): [number, number, number] => {
          const at = (q: number): number => played[Math.round(q * (played.length - 1))] ?? 0;
          return [at(0.5), at(0.1), at(0.9)];
        };
        const model = quantiles(play(false));
        const observed = quantiles(play(true));
        const ratios = errors['forward, observed'][target]
          .slice(-10)
          .map((o) => o.actual / o.forecast)
          .sort((a, b) => a - b);
        const ratio = ratios.length >= 3 ? (ratios[Math.floor(ratios.length / 2)] ?? 1) : 1;
        const corrected = observed.map((n) => Math.max(1, Math.round(n * ratio)));
        for (const [estimator, [forecast, low, high]] of [
          ['forward', model],
          ['forward, observed', observed],
          ['forward, corrected', corrected],
        ] as const) {
          pending.push({ estimator, target, ids, made: intros.length, forecast, low, high });
        }
      }
    }
  }

  function settle(): void {
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const p = pending[i];
      if (p === undefined || !p.ids.every((id) => introduced.has(id))) continue;
      const actual = intros.length - p.made;
      errors[p.estimator][p.target].push({
        forecast: p.forecast,
        actual,
        low: p.low,
        high: p.high,
      });
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
    known.push(all);
    if (kataBasic.length > 0 && readsKatakanaDay === undefined) {
      const kata = kataBasic.reduce((sum, id) => sum + learner.recallProbability(id, morning), 0);
      if (kata >= READS_SHARE * kataBasic.length) readsKatakanaDay = day + 1;
    }

    let dayMs = 0;
    for (const hour of SITTING_HOURS) {
      if (routine.next() < SKIP_CHANCE) continue;
      let now = start + day * DAY_MS + hour * 3_600_000;
      const end = now + SITTING_MS;
      sittingStarts.push(now);
      sittingEnd = end;
      let first = true;
      let firstOfDay = dayMs === 0;
      while (now < end) {
        const session = policy.session(now, first);
        first = false;
        let count = 0;
        let sessionIntros = 0;
        for (let task = session.next(now); task !== undefined; task = session.next(now)) {
          if (count === 0 && (options.daily !== true || firstOfDay)) forecast(day, now);
          firstOfDay = false;
          if (task.kind === 'introduction') {
            introduced.add(task.item);
            sessionIntros += 1;
            if (!milestones.has(task.item))
              milestones.set(task.item, {
                introducedSession: sessions + 1,
                introducedDay: day + 1,
                learnedSession: undefined,
                learnedDay: undefined,
              });
          }
          const answer = perform(learner, items, task, now);
          if (task.kind === 'word') {
            words += 1;
            if (answer.ok) wordsOk += 1;
            firstWordSession ??= sessions + 1;
            const wordKey = (task.word ?? []).join(',');
            if (wordDay.get(wordKey) === day) wordRepeats += 1;
            wordDay.set(wordKey, day);
            for (const id of task.word ?? []) lastSeen.set(id, now);
            const ms = durationOf(answer);
            now += ms;
            dayMs += ms;
            count += 1;
            session.record(answer);
            continue;
          }
          const seenAt = lastSeen.get(task.item);
          if (
            task.kind !== 'introduction' &&
            seenAt !== undefined &&
            Math.floor(seenAt / DAY_MS) < day
          ) {
            retentionAnswers += 1;
            if (answer.ok) retained += 1;
          }
          if (task.kind !== 'introduction')
            (task.review ? outcomes.review : outcomes.learning).push(answer.ok);
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
          if (policy.learned !== undefined) {
            for (const [id, m] of milestones) {
              if (m.learnedSession === undefined && policy.learned(id))
                milestones.set(id, { ...m, learnedSession: sessions, learnedDay: day + 1 });
            }
          }
        } else if (session.kind === 'learning') break;
      }
    }
    if (dayMs > 0 && day < 14) {
      practisedMs += dayMs;
      practisedDays += 1;
    }
    const basicDone =
      options.tracks === 'both'
        ? basic.every((id) => introduced.has(id))
        : policy.unlocked() >= basic.length;
    if (unlockedBasicDay === undefined && basicDone) unlockedBasicDay = day + 1;
    if (
      kataBasic.length > 0 &&
      unlockedKatakanaDay === undefined &&
      kataBasic.every((id) => introduced.has(id))
    )
      unlockedKatakanaDay = day + 1;
    if (day === 6) unlockedWeek = policy.unlocked();
  }

  const end = start + days * DAY_MS;
  const recalledAt = (t: number): number =>
    items.reduce((sum, item) => sum + learner.recallProbability(item.id, t), 0);
  return {
    profile,
    readsBasicDay,
    readsTrackDay,
    readsKatakanaDay,
    unlockedKatakanaDay,
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
    known,
    afterBreak: [recalledAt(end + 7 * DAY_MS), recalledAt(end + 30 * DAY_MS)],
    milestones,
    words,
    wordsOk,
    wordRepeats,
    firstWordSession,
  };
}
