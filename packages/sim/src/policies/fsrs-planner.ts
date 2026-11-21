import { firstMemory, nextMemory, retrievability } from '../fsrs';
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
};

/** A2: learning steps in time (30 s, doubled per correct recall), 5 to graduate, retention 0.95. */
export const PLANNER_A2: PlannerParams = {
  ...PLANNER,
  gapMs: 30_000,
  graduate: 5,
  retention: 0.95,
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

/**
 * Candidate B's memory: a half-life `h` in days, recall `2^(−t/h)`, and fixed multipliers in the
 * manner of SM-2: a recall on a later day multiplies `h` by 2.5 (good) or 1.8 (hard), a recall the
 * same day by 1.2, an error keeps 30% of it. It knows nothing of FSRS or of the reference learner.
 */
export const HALF_LIFE_MODEL: MemoryModel = {
  name: 'half-life',
  first: (g) => ({ difficulty: 1, stability: g === 1 ? 0.02 : 0.1 }),
  next(m, g, _elapsed, sameDay) {
    const h = m.stability;
    if (g === 1) return { difficulty: 1, stability: Math.max(0.02, h * 0.3) };
    const gain = sameDay ? 1.2 : g === 2 ? 1.8 : 2.5;
    return { difficulty: 1, stability: h * gain };
  },
  recall: (m, elapsed) => 2 ** (-elapsed / m.stability),
};

type Phase = 'new' | 'learning' | 'graduated';

interface State {
  phase: Phase;
  memory: Memory | undefined;
  lastAt: number;
  streak: number;
  /** Task index (over the whole history) at which it was last shown. */
  lastTask: number;
}

function gradeOf(answer: Answer, targetMs: number): Grade {
  if (!answer.ok) return 1;
  if (answer.task.kind === 'recognition') return 2;
  return answer.ms <= targetMs ? 3 : 2;
}

export function createFsrsPlanner(
  params: PlannerParams = PLANNER,
  model: MemoryModel = FSRS6_MODEL,
) {
  return (items: readonly Item[], rng: Rng): Policy => {
    const states: State[] = items.map(() => ({
      phase: 'new',
      memory: undefined,
      lastAt: 0,
      streak: 0,
      lastTask: -Infinity,
    }));
    let taskIndex = 0;
    let logScale = 0;

    const state = (id: number): State => {
      const s = states[id];
      if (s === undefined) throw new Error(`no item ${id}`);
      return s;
    };

    const recallAt = (id: number, now: number): number => {
      const { memory, lastAt } = state(id);
      if (memory === undefined) return 0;
      return model.recall(memory, (Math.exp(logScale) * (now - lastAt)) / DAY_MS);
    };

    function options(id: number): number[] {
      const chosen = new Set([id]);
      const similar = items[id]?.similar.find((o) => state(o).phase !== 'new');
      if (similar !== undefined) chosen.add(similar);
      const pool = states.flatMap((s, other) =>
        s.phase !== 'new' && !chosen.has(other) ? [other] : [],
      );
      while (chosen.size < 4 && pool.length > 0) {
        const [pick] = pool.splice(Math.floor(rng.next() * pool.length), 1);
        if (pick !== undefined) chosen.add(pick);
      }
      for (let other = 0; chosen.size < 4 && other < items.length; other += 1) chosen.add(other);
      return [...chosen];
    }

    function nextNew(): number | undefined {
      const learning = states.filter((s) => s.phase === 'learning').length;
      if (learning >= params.learnMax) return undefined;
      return items.find(
        (item) =>
          state(item.id).phase === 'new' &&
          item.parts.every((part) => state(part).phase === 'graduated'),
      )?.id;
    }

    function pick(now: number, previous: number): Task | undefined {
      const ids = states.map((_, id) => id).filter((id) => id !== previous);
      const due = ids
        .filter((id) => state(id).phase === 'graduated' && recallAt(id, now) < params.retention)
        .sort((a, b) => recallAt(a, now) - recallAt(b, now));
      const learning = ids
        .filter((id) => state(id).phase === 'learning')
        .sort((a, b) => state(a).lastTask - state(b).lastTask);
      const ready = learning.filter((id) => {
        const { lastTask, lastAt, streak } = state(id);
        return params.gapMs > 0
          ? now - lastAt >= params.gapMs * 2 ** streak
          : taskIndex - lastTask >= params.gap * 2 ** streak;
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

    function record(answer: Answer): void {
      const { item, kind } = answer.task;
      const s = state(item);
      s.lastTask = taskIndex;
      taskIndex += 1;
      if (kind === 'introduction') {
        s.phase = 'learning';
        s.memory = model.first(1);
        s.lastAt = answer.at;
        s.streak = 0;
        return;
      }
      const sameDay = Math.floor(answer.at / DAY_MS) === Math.floor(s.lastAt / DAY_MS);
      if (params.calibration > 0 && kind === 'recall' && !sameDay && s.memory !== undefined) {
        const predicted = recallAt(item, answer.at);
        const outcome = answer.ok ? 1 : 0;
        logScale = Math.min(3, Math.max(-3, logScale + params.calibration * (predicted - outcome)));
      }
      const grade = gradeOf(answer, params.targetMs);
      const memory = s.memory ?? model.first(grade);
      const elapsed = (answer.at - s.lastAt) / DAY_MS;
      s.memory = s.memory === undefined ? memory : model.next(memory, grade, elapsed, sameDay);
      s.lastAt = answer.at;
      if (s.phase === 'graduated' && !answer.ok) {
        s.phase = 'learning';
        s.streak = 0;
      } else if (s.phase === 'learning') {
        s.streak = answer.ok && kind === 'recall' ? s.streak + 1 : answer.ok ? s.streak : 0;
        if (s.streak >= params.graduate) s.phase = 'graduated';
      }
    }

    return {
      name: `${model.name} + planner`,
      session() {
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
      unlocked: () => states.filter((s) => s.phase !== 'new').length,
    };
  };
}
