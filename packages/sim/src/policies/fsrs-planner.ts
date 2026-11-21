import { createFsrs, FSRS6_WEIGHTS, firstMemory, nextMemory, retrievability } from '../fsrs';
import type { Grade, Memory } from '../fsrs';
import type { Item } from '../items';
import { DAY_MS } from '../learner';
import type { Answer, Policy, Session, Task } from '../policy';
import type { Rng } from '../rng';

/**
 * Candidate A: FSRS-6 with default parameters per kana, and a planner.
 *
 * - A kana is new, learning or graduated. A new kana is introduced when fewer than `learnMax` kana
 *   are learning and its parts (dakuten base, yōon halves) have graduated.
 * - A learning kana comes back after `gap` tasks, doubled after each correct recall, and graduates
 *   after `graduate` correct recalls in a row; reviews take it from there. A failed review sends a
 *   kana back to learning.
 * - Each task: a due review (recall probability below `retention`, lowest first), else a learning
 *   kana whose gap has passed, else an introduction, else a learning kana anyway; the session ends
 *   when none of these exists or after `sessionTasks`.
 * - Grades: a wrong answer is 1; a recall within the target time 3, slower 2; a correct recognition
 *   2, as weaker evidence.
 * - Calibration (when `calibration` > 0): one factor for the learner scales elapsed time in the
 *   predicted recall. After each recall on a later day than the last exposure it moves by
 *   `calibration × (predicted − outcome)` in log space, so a learner who forgets faster than FSRS
 *   predicts gets earlier reviews. It changes when a kana is due, not the FSRS state.
 * - Adaptation (when `adapt` > 0, part 3): a moving average of the outcomes of scheduled reviews,
 *   with rate `adapt`. While it is below `goal`, a pressure from 0 to 1 (a full 10 points below the
 *   goal) raises the requested retention towards 0.98, lowers the number of kana learning at once
 *   to 1 and adds up to 2 correct recalls before a kana graduates.
 * - Look-ahead (when `horizon` is set, part 3): a graduated kana is due when its recall would fall
 *   below the retention by the expected start of the next session, so a kana is not left to fade
 *   overnight between two sittings.
 * - Fitting (when `fit` is not empty, part 3): at the first session of each day, once `fitAfter`
 *   counted answers are logged (`fitOn`: recalls more than 2 hours after the previous exposure, or
 *   scheduled reviews only), the planner replays every kana's answers under each model of `fit`,
 *   keeps the one with the highest likelihood of the counted answers and takes its memory states.
 *   It changes the memory model, not the phases.
 * - Part 4: the state is a fold of the answers (`apply`), so a log of answers rebuilds it; the
 *   gaps between sessions come from the answers too. `clone` copies the state for a forecast that
 *   plays the planner forward. `grading` changes how an answer becomes a grade. With both tracks,
 *   `katakana` says when katakana are introduced and `link` lets a katakana whose hiragana is learned
 *   start further on. `creditParts` lets a correct composite count as a weak review of its parts.
 */

export interface PlannerParams {
  readonly retention: number;
  readonly learnMax: number;
  readonly gap: number;
  readonly graduate: number;
  readonly sessionTasks: number;
  readonly recognitionShare: number;
  readonly targetMs: number;
  /** When above 0, the gap of a learning kana is this many ms (doubled per correct recall) instead of tasks. */
  readonly gapMs: number;
  /** Learning rate of the calibration factor; 0 turns it off. */
  readonly calibration: number;
  /** The review retention adaptation holds. */
  readonly goal: number;
  /** Rate of the moving average of review outcomes; 0 turns adaptation off. */
  readonly adapt: number;
  /** Models the planner chooses among by likelihood; empty turns fitting off. */
  readonly fit: readonly MemoryModel[];
  /** Recall answers needed before the first fit. */
  readonly fitAfter: number;
  /** Which answers the likelihood counts: every recall after 2 hours, or scheduled reviews only. */
  readonly fitOn: 'recalls' | 'reviews';
  /**
   * Look-ahead: a kana is due when its recall would fall below the retention before the next
   * session, expected this many ms from now; 0 turns it off; `observed` uses the median of the
   * last 10 gaps of over an hour between the learner's sessions instead (12 hours until known).
   */
  readonly horizon: number | 'observed';
  /**
   * How an answer becomes a grade: `time` (a slow recall is hard, a recognition hard), `binary`
   * (every correct answer good), `recognition good`, or `recognition none` (a recognition changes
   * no memory, only the phase).
   */
  readonly grading: 'time' | 'binary' | 'recognition good' | 'recognition none';
  /**
   * When katakana are introduced with both tracks: after every hiragana is introduced, once the 46
   * basic hiragana are learned, or each one once its hiragana is learned. The last two alternate
   * the tracks.
   */
  readonly katakana: 'after hiragana' | 'after basic' | 'paired';
  /** A katakana whose hiragana is learned starts as a recalled kana and graduates 2 recalls sooner. */
  readonly link: boolean;
  /** A correct recall of a composite counts as a hard review of each learned part. */
  readonly creditParts: boolean;
}

export const PLANNER: PlannerParams = {
  retention: 0.9,
  learnMax: 4,
  gap: 3,
  graduate: 3,
  sessionTasks: 30,
  recognitionShare: 0.25,
  targetMs: 1500,
  gapMs: 0,
  calibration: 0,
  goal: 0.9,
  adapt: 0,
  fit: [],
  fitAfter: 100,
  fitOn: 'recalls',
  horizon: 0,
  grading: 'time',
  katakana: 'after hiragana',
  link: false,
  creditParts: false,
};

/** A2: learning steps in time (30 s, doubled per correct recall), 5 to graduate, retention 0.95. */
export const PLANNER_A2: PlannerParams = {
  ...PLANNER,
  gapMs: 30_000,
  graduate: 5,
  retention: 0.95,
};

/**
 * A4 (part 3): A2 with the look-ahead to the next session (from the learner's observed gaps),
 * which lets the requested retention go back to 0.90, and adaptation to the observed review
 * retention.
 */
export const PLANNER_A4: PlannerParams = {
  ...PLANNER_A2,
  retention: 0.9,
  horizon: 'observed',
  adapt: 0.05,
};

/** The memory model the planner schedules with; `stability` is in days. */
export interface MemoryModel {
  readonly name: string;
  first(g: Grade): Memory;
  next(m: Memory, g: Grade, elapsed: number, sameDay: boolean): Memory;
  recall(m: Memory, elapsed: number): number;
}

export const FSRS6_MODEL: MemoryModel = {
  name: 'FSRS-6',
  first: firstMemory,
  next: nextMemory,
  recall: (m, elapsed) => retrievability(m.stability, elapsed),
};

/** FSRS-6 with three changes to its default weights: the fitted part of candidate A3. */
export interface FsrsTweak {
  /** Factor on the first stabilities (w0–w3). */
  readonly first: number;
  /** Factor on the growth of stability after a later-day recall (e^w8). */
  readonly growth: number;
  /** The decay of the forgetting curve (w20); higher is closer to exponential. */
  readonly decay: number;
}

export function fsrsModel(tweak: FsrsTweak): MemoryModel {
  const weights = FSRS6_WEIGHTS.map((v, i) => {
    if (i <= 3) return v * tweak.first;
    if (i === 8) return v + Math.log(tweak.growth);
    if (i === 20) return tweak.decay;
    return v;
  });
  const fsrs = createFsrs(weights);
  return {
    name: `FSRS-6 (first ×${tweak.first}, growth ×${tweak.growth}, decay ${tweak.decay})`,
    first: fsrs.firstMemory,
    next: fsrs.nextMemory,
    recall: (m, elapsed) => fsrs.retrievability(m.stability, elapsed),
  };
}

/** The FSRS models the fitted candidate A3 chooses among: 80, the default weights among them. */
export const FSRS_GRID: readonly MemoryModel[] = [0.25, 0.5, 1, 2].flatMap((first) =>
  [0.25, 0.5, 1, 1.5].flatMap((growth) =>
    [0.1542, 0.3, 0.5, 0.8, 1.2].map((decay) => fsrsModel({ first, growth, decay })),
  ),
);

/**
 * Candidate B's memory: a half-life `h` in days, recall `2^(−t/h)`, and fixed multipliers in the
 * manner of SM-2: a recall on a later day multiplies `h` by 2.5 (good) or 1.8 (hard), a recall the
 * same day by 1.2, an error keeps 30% of it. It knows nothing of FSRS or of the reference learner.
 */
export interface HalfLife {
  readonly first: number;
  readonly good: number;
  readonly hard: number;
  readonly sameDay: number;
  readonly lapse: number;
}

export function halfLifeModel(p: HalfLife): MemoryModel {
  return {
    name: `half-life (first ${p.first}, good ×${p.good}, same day ×${p.sameDay})`,
    first: (g) => ({ difficulty: 1, stability: g === 1 ? p.first : 5 * p.first }),
    next(m, g, _elapsed, sameDay) {
      const h = m.stability;
      if (g === 1) return { difficulty: 1, stability: Math.max(p.first, h * p.lapse) };
      const gain = sameDay ? p.sameDay : g === 2 ? p.hard : p.good;
      return { difficulty: 1, stability: h * gain };
    },
    recall: (m, elapsed) => 2 ** (-elapsed / m.stability),
  };
}

export const HALF_LIFE_MODEL: MemoryModel = {
  ...halfLifeModel({ first: 0.02, good: 2.5, hard: 1.8, sameDay: 1.2, lapse: 0.3 }),
  name: 'half-life',
};

/** The half-life models the fitted candidate B2 chooses among: 60, B's own among them. */
export const HALF_LIFE_GRID: readonly MemoryModel[] = [0.01, 0.02, 0.04].flatMap((first) =>
  [1.5, 2, 2.5, 3.5, 5].flatMap((good) =>
    [1.1, 1.2, 1.5, 2].map((sameDay) =>
      halfLifeModel({ first, good, hard: 1 + 0.55 * (good - 1), sameDay, lapse: 0.3 }),
    ),
  ),
);

type Phase = 'new' | 'learning' | 'graduated';

export interface State {
  phase: Phase;
  memory: Memory | undefined;
  lastAt: number;
  streak: number;
  /** Task index (over the whole history) at which it was last shown. */
  lastTask: number;
  /** Its answers, for refitting: the introduction first. */
  log: { grade: Grade; at: number; counted: boolean }[];
}

/** Answers this soon after the previous exposure say little about forgetting; fits skip them. */
const FIT_MIN_GAP = 2 * 3_600_000;

/** Replays every kana's answers under `model`: the memories and the log-likelihood of the recalls. */
function replay(
  states: readonly State[],
  model: MemoryModel,
): { memories: (Memory | undefined)[]; likelihood: number } {
  let likelihood = 0;
  const memories = states.map(({ log }) => {
    const [intro, ...rest] = log;
    if (intro === undefined) return undefined;
    let memory = model.first(1);
    let lastAt = intro.at;
    for (const { grade, at, counted } of rest) {
      const elapsed = (at - lastAt) / DAY_MS;
      if (counted) {
        const p = Math.min(1 - 1e-4, Math.max(1e-4, model.recall(memory, elapsed)));
        likelihood += Math.log(grade === 1 ? 1 - p : p);
      }
      const sameDay = Math.floor(at / DAY_MS) === Math.floor(lastAt / DAY_MS);
      memory = model.next(memory, grade, elapsed, sameDay);
      lastAt = at;
    }
    return memory;
  });
  return { memories, likelihood };
}

function gradeOf(answer: Answer, params: PlannerParams): Grade | undefined {
  if (!answer.ok) return 1;
  const recognition = answer.task.kind === 'recognition';
  switch (params.grading) {
    case 'binary':
      return 3;
    case 'recognition good':
      return recognition || answer.ms <= params.targetMs ? 3 : 2;
    case 'recognition none':
      if (recognition) return undefined;
      return answer.ms <= params.targetMs ? 3 : 2;
    case 'time':
      if (recognition) return 2;
      return answer.ms <= params.targetMs ? 3 : 2;
  }
}

/** Everything the planner learns from answers: plain data, so it can be copied and merged. */
export interface PlannerCore {
  states: State[];
  taskIndex: number;
  logScale: number;
  observed: number;
  fitAnswers: number;
  fittedDay: number;
  gaps: number[];
  lastAnswerAt: number | undefined;
}

/** The planner with the hooks of part 4. */
export interface Planner extends Policy {
  /** Applies an answer outside a session: a replayed log rebuilds the state this way. */
  apply(answer: Answer): void;
  /** A planner with a copy of this one's state and its own random source. */
  clone(rng: Rng): Planner;
  /** The planner's predicted recall of a kana; 0 for a kana not introduced. */
  predict(item: number, now: number): number;
  /** A copy of the state. */
  snapshot(): PlannerCore;
  /** Replaces the state. */
  adopt(core: PlannerCore): void;
  /** Ids of the kana introduced so far. */
  introduced(): readonly number[];
}

export function freshCore(items: readonly Item[], goal: number): PlannerCore {
  return {
    states: items.map(() => ({
      phase: 'new',
      memory: undefined,
      lastAt: 0,
      streak: 0,
      lastTask: -Infinity,
      log: [],
    })),
    taskIndex: 0,
    logScale: 0,
    observed: goal,
    fitAnswers: 0,
    fittedDay: -1,
    gaps: [],
    lastAnswerAt: undefined,
  };
}

export function createFsrsPlanner(
  params: PlannerParams = PLANNER,
  model: MemoryModel = FSRS6_MODEL,
): (items: readonly Item[], rng: Rng) => Planner {
  return (items, rng) => build(params, items, freshCore(items, params.goal), model, rng, []);
}

function build(
  params: PlannerParams,
  items: readonly Item[],
  initial: PlannerCore,
  model: MemoryModel,
  rng: Rng,
  fits: string[],
): Planner {
  let core = initial;
  let current = model;

  function horizonMs(): number {
    if (params.horizon !== 'observed') return params.horizon;
    const recent = core.gaps.slice(-10).sort((a, b) => a - b);
    return recent[Math.floor(recent.length / 2)] ?? 12 * 3_600_000;
  }

  /** 0 while review retention holds the goal, 1 when it is 10 points below. */
  const pressure = (): number =>
    params.adapt > 0 ? Math.min(1, Math.max(0, (params.goal - core.observed) / 0.1)) : 0;
  const retentionNow = (): number => params.retention + pressure() * (0.98 - params.retention);
  const learnMaxNow = (): number =>
    Math.max(1, Math.round(params.learnMax - pressure() * (params.learnMax - 1)));
  const graduateNow = (): number => params.graduate + Math.round(2 * pressure());

  function refit(now: number): void {
    const day = Math.floor(now / DAY_MS);
    if (params.fit.length === 0 || day === core.fittedDay || core.fitAnswers < params.fitAfter)
      return;
    core.fittedDay = day;
    let best: { model: MemoryModel; memories: (Memory | undefined)[]; likelihood: number } = {
      model: current,
      ...replay(core.states, current),
    };
    for (const candidate of params.fit) {
      const result = replay(core.states, candidate);
      if (result.likelihood > best.likelihood) best = { model: candidate, ...result };
    }
    current = best.model;
    for (const [id, memory] of best.memories.entries()) {
      const s = core.states[id];
      if (s !== undefined) s.memory = memory;
    }
    fits.push(`${day + 1}: ${current.name}`);
  }

  const state = (id: number): State => {
    const s = core.states[id];
    if (s === undefined) throw new Error(`no item ${id}`);
    return s;
  };

  const recallAt = (id: number, now: number): number => {
    const { memory, lastAt } = state(id);
    if (memory === undefined) return 0;
    return current.recall(memory, (Math.exp(core.logScale) * (now - lastAt)) / DAY_MS);
  };

  const linked = (id: number): boolean => {
    const item = items[id];
    return (
      params.link &&
      item?.track === 'katakana' &&
      item.pair !== undefined &&
      state(item.pair).phase === 'graduated'
    );
  };

  function options(id: number): number[] {
    const track = items[id]?.track;
    const chosen = new Set([id]);
    const similar = items[id]?.similar.find((o) => state(o).phase !== 'new');
    if (similar !== undefined) chosen.add(similar);
    const pool = core.states.flatMap((s, other) =>
      s.phase !== 'new' && !chosen.has(other) && items[other]?.track === track ? [other] : [],
    );
    while (chosen.size < 4 && pool.length > 0) {
      const [pick] = pool.splice(Math.floor(rng.next() * pool.length), 1);
      if (pick !== undefined) chosen.add(pick);
    }
    for (let other = 0; chosen.size < 4 && other < items.length; other += 1) chosen.add(other);
    return [...chosen];
  }

  function eligible(item: Item): boolean {
    if (state(item.id).phase !== 'new') return false;
    if (!item.parts.every((part) => state(part).phase === 'graduated')) return false;
    if (item.track === 'hiragana') return true;
    switch (params.katakana) {
      case 'after hiragana':
        return items.every(
          (other) => other.track !== 'hiragana' || state(other.id).phase !== 'new',
        );
      case 'after basic':
        return items.every(
          (other) =>
            other.track !== 'hiragana' ||
            other.category !== 'basic' ||
            state(other.id).phase === 'graduated',
        );
      case 'paired':
        return item.pair === undefined
          ? items.every((other) => other.track !== 'hiragana' || state(other.id).phase !== 'new')
          : state(item.pair).phase === 'graduated';
    }
  }

  function nextNew(): number | undefined {
    const learning = core.states.filter((s) => s.phase === 'learning').length;
    if (learning >= learnMaxNow()) return undefined;
    const hira = items.find((item) => item.track === 'hiragana' && eligible(item));
    const kata = items.find((item) => item.track === 'katakana' && eligible(item));
    if (hira === undefined || kata === undefined) return (hira ?? kata)?.id;
    const count = (track: string): number =>
      items.filter((item) => item.track === track && state(item.id).phase !== 'new').length;
    return count('katakana') < count('hiragana') - 10 ? kata.id : hira.id;
  }

  function pick(now: number, previous: number): Task | undefined {
    const ids = core.states.map((_, id) => id).filter((id) => id !== previous);
    const ahead = now + horizonMs();
    const due = ids
      .filter((id) => state(id).phase === 'graduated' && recallAt(id, ahead) < retentionNow())
      .sort((a, b) => recallAt(a, ahead) - recallAt(b, ahead));
    const learning = ids
      .filter((id) => state(id).phase === 'learning')
      .sort((a, b) => state(a).lastTask - state(b).lastTask);
    const ready = learning.filter((id) => {
      const { lastTask, lastAt, streak } = state(id);
      return params.gapMs > 0
        ? now - lastAt >= params.gapMs * 2 ** streak
        : core.taskIndex - lastTask >= params.gap * 2 ** streak;
    });
    const fresh = nextNew();
    const id = due[0] ?? ready[0] ?? fresh ?? learning[0];
    if (id === undefined) return undefined;
    if (id === fresh) return { item: id, kind: 'introduction', options: [], review: false };
    const review = state(id).phase === 'graduated';
    const recognition = !review && rng.next() < params.recognitionShare;
    return recognition
      ? { item: id, kind: 'recognition', options: options(id), review }
      : { item: id, kind: 'recall', options: [], review };
  }

  function update(s: State, grade: Grade, at: number): void {
    const sameDay = Math.floor(at / DAY_MS) === Math.floor(s.lastAt / DAY_MS);
    const memory = s.memory ?? current.first(grade);
    const elapsed = (at - s.lastAt) / DAY_MS;
    s.memory = s.memory === undefined ? memory : current.next(memory, grade, elapsed, sameDay);
    s.lastAt = at;
  }

  function record(answer: Answer): void {
    const { item, kind } = answer.task;
    const s = state(item);
    if (core.lastAnswerAt !== undefined && answer.at - core.lastAnswerAt > 3_600_000)
      core.gaps.push(answer.at - core.lastAnswerAt);
    core.lastAnswerAt = answer.at;
    s.lastTask = core.taskIndex;
    core.taskIndex += 1;
    const grade = gradeOf(answer, params);
    const counted =
      params.fitOn === 'reviews'
        ? answer.task.review
        : kind === 'recall' && answer.at - s.lastAt > FIT_MIN_GAP;
    if (counted) core.fitAnswers += 1;
    if (params.fit.length > 0 && grade !== undefined) s.log.push({ grade, at: answer.at, counted });
    if (answer.task.review && params.adapt > 0)
      core.observed += params.adapt * ((answer.ok ? 1 : 0) - core.observed);
    if (kind === 'introduction') {
      const link = linked(item);
      s.phase = 'learning';
      s.memory = current.first(link ? 3 : 1);
      s.lastAt = answer.at;
      s.streak = link ? 2 : 0;
      return;
    }
    const sameDay = Math.floor(answer.at / DAY_MS) === Math.floor(s.lastAt / DAY_MS);
    if (params.calibration > 0 && kind === 'recall' && !sameDay && s.memory !== undefined) {
      const predicted = recallAt(item, answer.at);
      const outcome = answer.ok ? 1 : 0;
      core.logScale = Math.min(
        3,
        Math.max(-3, core.logScale + params.calibration * (predicted - outcome)),
      );
    }
    if (grade !== undefined) update(s, grade, answer.at);
    if (params.creditParts && answer.ok && kind === 'recall') {
      for (const part of items[item]?.parts ?? []) {
        const p = state(part);
        if (p.phase === 'graduated') update(p, 2, answer.at);
      }
    }
    if (s.phase === 'graduated' && !answer.ok) {
      s.phase = 'learning';
      s.streak = 0;
    } else if (s.phase === 'learning') {
      s.streak = answer.ok && kind === 'recall' ? s.streak + 1 : answer.ok ? s.streak : 0;
      if (s.streak >= graduateNow()) s.phase = 'graduated';
    }
  }

  return {
    name: `${model.name} + planner`,
    fits,
    session(now) {
      refit(now);
      let count = 0;
      let previous = -1;
      return {
        kind: 'learning',
        next(now) {
          if (count >= params.sessionTasks) return undefined;
          const task = pick(now, previous);
          if (task === undefined) return undefined;
          count += 1;
          previous = task.item;
          return task;
        },
        record,
      } satisfies Session;
    },
    unlocked: () => core.states.filter((s) => s.phase !== 'new').length,
    apply: record,
    clone: (other) => build(params, items, structuredClone(core), current, other, []),
    predict: recallAt,
    snapshot: () => structuredClone(core),
    adopt(next) {
      core = structuredClone(next);
    },
    introduced: () => core.states.flatMap((s, id) => (s.phase === 'new' ? [] : [id])),
  };
}
