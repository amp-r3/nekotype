import type { Item } from '../items';
import type { Answer, Policy, Session, Task } from '../policy';
import { DAY_MS } from '../learner';
import { weighted } from '../rng';
import type { Rng } from '../rng';

/**
 * The current rule of learning.md (P3, ADR 063): kana unlock one at a time when every unlocked kana
 * is confident; confidence is 10 recall answers, a median of at most the target and 90% correct;
 * Leitner boxes schedule reviews in their own session.
 */

const RECENT = 10;
const TARGET_MS = 1500;
const ACCURACY = 0.9;
const SESSION_TASKS = 25;
const REVIEW_TASKS = 20;
const FOCUS_SHARE = 0.5;
const RECOGNITION_SHARE = 1 / 3;
const BOX_DAYS = [0, 1, 3, 7, 14, 30];
const FIRST_UNLOCKED = 5;

interface State {
  unlocked: boolean;
  introduced: boolean;
  answers: { ok: boolean; ms: number }[];
  box: number;
  dueAt: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? 0) + hi) / 2;
}

function dayStart(now: number, plus: number): number {
  return (Math.floor(now / DAY_MS) + plus) * DAY_MS;
}

export function createCurrentPolicy(items: readonly Item[], rng: Rng): Policy {
  const states: State[] = items.map((_, id) => ({
    unlocked: id < FIRST_UNLOCKED,
    introduced: false,
    answers: [],
    box: 0,
    dueAt: 0,
  }));

  const state = (id: number): State => {
    const s = states[id];
    if (s === undefined) throw new Error(`no item ${id}`);
    return s;
  };

  const isConfident = (id: number): boolean => {
    const { answers } = state(id);
    if (answers.length < RECENT) return false;
    const accuracy = answers.filter((a) => a.ok).length / answers.length;
    return median(answers.map((a) => a.ms)) <= TARGET_MS && accuracy >= ACCURACY;
  };
  const confidence = items.map(() => false);
  const confident = (id: number): boolean => confidence[id] === true;

  function settle(now: number): void {
    for (const [id, s] of states.entries()) {
      if (s.unlocked && s.box === 0 && confident(id)) {
        s.box = 1;
        s.dueAt = dayStart(now, 1);
      }
    }
    const unlocked = states.flatMap((s, id) => (s.unlocked ? [id] : []));
    if (!unlocked.every(confident)) return;
    const next = items.find(
      (item) => !state(item.id).unlocked && item.parts.every((part) => confident(part)),
    );
    if (next !== undefined) state(next.id).unlocked = true;
  }

  function options(id: number): number[] {
    const chosen = new Set([id]);
    const similar = items[id]?.similar.find((o) => state(o).unlocked);
    if (similar !== undefined) chosen.add(similar);
    const pool = states.flatMap((s, other) => (s.unlocked && !chosen.has(other) ? [other] : []));
    while (chosen.size < 4 && pool.length > 0) {
      const [pick] = pool.splice(Math.floor(rng.next() * pool.length), 1);
      if (pick !== undefined) chosen.add(pick);
    }
    for (let other = 0; chosen.size < 4 && other < items.length; other += 1) chosen.add(other);
    return [...chosen];
  }

  function weight(id: number): number {
    const { answers } = state(id);
    const recent = answers.length;
    const m = recent === 0 ? 0 : median(answers.map((a) => a.ms));
    const a = recent === 0 ? 1 : answers.filter((x) => x.ok).length / recent;
    const slow = Math.min(1, Math.max(0, (m - TARGET_MS) / TARGET_MS));
    const err = Math.min(1, Math.max(0, (1 - a) / 0.5));
    return 1 + 4 * Math.min(1, slow + err);
  }

  function recordRecall(id: number, answer: Answer): void {
    const s = state(id);
    s.answers.push({ ok: answer.ok, ms: answer.ms });
    if (s.answers.length > RECENT) s.answers.shift();
    confidence[id] = isConfident(id);
  }

  function learningSession(): Session {
    let count = 0;
    let previous = -1;
    return {
      kind: 'learning',
      next() {
        if (count >= SESSION_TASKS) return undefined;
        count += 1;
        const intro = states.findIndex((s) => s.unlocked && !s.introduced);
        if (intro >= 0) return { item: intro, kind: 'introduction', options: [] };
        let candidates = states.flatMap((s, id) => (s.unlocked && s.introduced ? [id] : []));
        if (candidates.length > 1) candidates = candidates.filter((id) => id !== previous);
        const inFocus = candidates.filter(
          (id) => state(id).answers.length < RECENT || !confident(id),
        );
        const outFocus = candidates.filter((id) => !inFocus.includes(id));
        const useFocus = inFocus.length > 0 && (outFocus.length === 0 || rng.next() < FOCUS_SHARE);
        const group = useFocus ? inFocus : outFocus;
        const id = group[weighted(rng, group.map(weight))] ?? group[0] ?? 0;
        previous = id;
        const task: Task =
          rng.next() < RECOGNITION_SHARE
            ? { item: id, kind: 'recognition', options: options(id) }
            : { item: id, kind: 'recall', options: [] };
        return task;
      },
      record(answer) {
        const { item, kind } = answer.task;
        if (kind === 'introduction') state(item).introduced = true;
        if (kind === 'recall') recordRecall(item, answer);
        settle(answer.at);
      },
    };
  }

  function reviewSession(now: number): Session {
    const due = states
      .flatMap((s, id) => (s.box >= 1 && s.dueAt <= now && confident(id) ? [id] : []))
      .sort((a, b) => state(a).dueAt - state(b).dueAt)
      .slice(0, REVIEW_TASKS);
    let index = 0;
    return {
      kind: 'review',
      next() {
        const id = due[index];
        index += 1;
        return id === undefined ? undefined : { item: id, kind: 'recall', options: [] };
      },
      record(answer) {
        const s = state(answer.task.item);
        recordRecall(answer.task.item, answer);
        s.box = answer.ok ? Math.min(5, s.box + 1) : 1;
        s.dueAt = dayStart(answer.at, BOX_DAYS[s.box] ?? 1);
        settle(answer.at);
      },
    };
  }

  return {
    name: 'current rule',
    session(now, first) {
      settle(now);
      return first ? reviewSession(now) : learningSession();
    },
    unlocked: () => states.filter((s) => s.unlocked).length,
  };
}
