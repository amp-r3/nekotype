import type { AnswerEvent, LearnKanaKey, Track } from '@nekotype/shared/types';
import { RECENT_RECALLS } from './constants';

export type RecallStat = { readonly ms: number; readonly ok: boolean };
export type KanaLog = {
  /** The last 10 answers of task `recall`, oldest first. */
  readonly recall: readonly RecallStat[];
  /** Answers of task `recognition`, all of them; no decay. */
  readonly recognitions: number;
  readonly recognitionErrors: number;
};
export type DayLog = {
  /** Answers of any task on the day: a day with one is active (A41). */
  readonly answers: number;
  /** Answer times of task `recall` per track, in fold order. */
  readonly recall: Readonly<Record<Track, readonly number[]>>;
};
export type LogStats = {
  readonly kana: ReadonlyMap<LearnKanaKey, KanaLog>;
  /** Local day (the event's `dev` zone) → its log. No day is dropped. */
  readonly days: ReadonlyMap<number, DayLog>;
  /** Session starts and ends: the `learn` counters. */
  readonly started: number;
  readonly finished: number;
};

type MutableDay = { answers: number; recall: Record<Track, number[]> };

/**
 * What the fold keeps for `LogStats`. A `KanaLog` is replaced on change. A day is changed in place
 * only while `owned`; a snapshot or a clone shares every day and empties `owned`, and the next
 * change of a shared day copies it first. That keeps `snapshot()` at O(kana + days).
 */
export type StatsData = {
  readonly kana: Map<LearnKanaKey, KanaLog>;
  readonly days: Map<number, MutableDay>;
  readonly owned: Set<number>;
  started: number;
  finished: number;
};

export function emptyStats(): StatsData {
  return { kana: new Map(), days: new Map(), owned: new Set(), started: 0, finished: 0 };
}

/** An independent copy; the days are shared until either side changes one. */
export function copyStats(s: StatsData): StatsData {
  s.owned.clear();
  return {
    kana: new Map(s.kana),
    days: new Map(s.days),
    owned: new Set(),
    started: s.started,
    finished: s.finished,
  };
}

function ownedDay(s: StatsData, day: number): MutableDay {
  const have = s.days.get(day);
  if (have !== undefined && s.owned.has(day)) return have;
  const next: MutableDay =
    have === undefined
      ? { answers: 0, recall: { hiragana: [], katakana: [] } }
      : {
          answers: have.answers,
          recall: { hiragana: [...have.recall.hiragana], katakana: [...have.recall.katakana] },
        };
  s.days.set(day, next);
  s.owned.add(day);
  return next;
}

/**
 * An answer of the fold, on the local `day` of its device. `key` is the kana asked and `track` its
 * track (from `ITEMS`); both are null for a word.
 */
export function noteAnswer(
  s: StatsData,
  a: AnswerEvent,
  key: LearnKanaKey | null,
  track: Track | null,
  day: number,
): void {
  const entry = ownedDay(s, day);
  entry.answers += 1;
  if (key === null) return;
  if (a.task === 'recall') {
    if (track !== null) entry.recall[track].push(a.ms);
    const have = s.kana.get(key);
    // The old list and this answer in one new list (a `KanaLog` is never changed in place), cut
    // to the last RECENT_RECALLS.
    const before = have?.recall ?? [];
    const recall = before.slice(Math.max(0, before.length + 1 - RECENT_RECALLS));
    recall.push({ ms: a.ms, ok: a.ok });
    s.kana.set(key, {
      recall,
      recognitions: have?.recognitions ?? 0,
      recognitionErrors: have?.recognitionErrors ?? 0,
    });
  } else if (a.task === 'recognition') {
    const have = s.kana.get(key);
    s.kana.set(key, {
      recall: have?.recall ?? [],
      recognitions: (have?.recognitions ?? 0) + 1,
      recognitionErrors: (have?.recognitionErrors ?? 0) + (a.ok ? 0 : 1),
    });
  }
}

export function noteSession(s: StatsData, kind: 'start' | 'end'): void {
  if (kind === 'start') s.started += 1;
  else s.finished += 1;
}

/** The live statistics: valid until the next change. */
export function liveStats(s: StatsData): LogStats {
  return {
    kana: s.kana,
    days: s.days,
    get started() {
      return s.started;
    },
    get finished() {
      return s.finished;
    },
  };
}

/** Statistics that later changes do not touch. */
export function snapshotStats(s: StatsData): LogStats {
  s.owned.clear();
  return {
    kana: new Map(s.kana),
    days: new Map(s.days),
    started: s.started,
    finished: s.finished,
  };
}
