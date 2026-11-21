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
 */

export interface PlannerParams {
  readonly retention: number;
  readonly learnMax: number;
  readonly gap: number;
  readonly graduate: number;
  readonly sessionTasks: number;
  readonly recognitionShare: number;
  readonly targetMs: number;
}

export const PLANNER: PlannerParams = {
  retention: 0.9,
  learnMax: 4,
  gap: 3,
  graduate: 3,
  sessionTasks: 30,
  recognitionShare: 0.25,
  targetMs: 1500,
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

export function createFsrsPlanner(params: PlannerParams = PLANNER) {
  return (items: readonly Item[], rng: Rng): Policy => {
    const states: State[] = items.map(() => ({
      phase: 'new',
      memory: undefined,
      lastAt: 0,
      streak: 0,
      lastTask: -Infinity,
    }));
    let taskIndex = 0;

    const state = (id: number): State => {
      const s = states[id];
      if (s === undefined) throw new Error(`no item ${id}`);
      return s;
    };

    const recallAt = (id: number, now: number): number => {
      const { memory, lastAt } = state(id);
      return memory === undefined ? 0 : retrievability(memory.stability, (now - lastAt) / DAY_MS);
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
      const ready = learning.filter(
        (id) => taskIndex - state(id).lastTask >= params.gap * 2 ** state(id).streak,
      );
      const fresh = nextNew();
      const id = due[0] ?? ready[0] ?? fresh ?? learning[0];
      if (id === undefined) return undefined;
      if (id === fresh) return { item: id, kind: 'introduction', options: [] };
      const recognition = state(id).phase === 'learning' && rng.next() < params.recognitionShare;
      return recognition
        ? { item: id, kind: 'recognition', options: options(id) }
        : { item: id, kind: 'recall', options: [] };
    }

    function record(answer: Answer): void {
      const { item, kind } = answer.task;
      const s = state(item);
      s.lastTask = taskIndex;
      taskIndex += 1;
      if (kind === 'introduction') {
        s.phase = 'learning';
        s.memory = firstMemory(1);
        s.lastAt = answer.at;
        s.streak = 0;
        return;
      }
      const grade = gradeOf(answer, params.targetMs);
      const memory = s.memory ?? firstMemory(grade);
      const elapsed = (answer.at - s.lastAt) / DAY_MS;
      const sameDay = Math.floor(answer.at / DAY_MS) === Math.floor(s.lastAt / DAY_MS);
      s.memory = s.memory === undefined ? memory : nextMemory(memory, grade, elapsed, sameDay);
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
      name: 'FSRS-6 + planner',
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
