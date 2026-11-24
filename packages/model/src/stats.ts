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
  /** Kana → `started` when the fold introduced it: the number of the session that introduced it. */
  readonly introducedIn: ReadonlyMap<LearnKanaKey, number>;
};

type MutableKana = { recall: RecallStat[]; recognitions: number; recognitionErrors: number };
type MutableDay = { answers: number; recall: Record<Track, number[]> };

/**
 * What the fold keeps for `LogStats`. A `KanaLog` is changed in place: it is small, so a snapshot
 * or a clone copies it. A day is changed in place only while `owned`; a snapshot or a clone shares
 * every day and empties `owned`, and the next change of a shared day copies it first. That keeps
 * `snapshot()` at O(kana + days).
 */
export type StatsData = {
  readonly kana: Map<LearnKanaKey, MutableKana>;
  readonly days: Map<number, MutableDay>;
  readonly owned: Set<number>;
  /** The owned day of the last answer, or null: most answers fall on the day of the one before. */
  last: { readonly day: number; readonly entry: MutableDay } | null;
  started: number;
  finished: number;
  readonly introducedIn: Map<LearnKanaKey, number>;
};

export function emptyStats(): StatsData {
  return {
    kana: new Map(),
    days: new Map(),
    owned: new Set(),
    last: null,
    started: 0,
    finished: 0,
    introducedIn: new Map(),
  };
}

function copyKana(from: ReadonlyMap<LearnKanaKey, KanaLog>): Map<LearnKanaKey, MutableKana> {
  const copy = new Map<LearnKanaKey, MutableKana>();
  for (const [key, log] of from) {
    copy.set(key, {
      recall: [...log.recall],
      recognitions: log.recognitions,
      recognitionErrors: log.recognitionErrors,
    });
  }
  return copy;
}

/** Shares every day: the next change of one copies it first. */
function share(s: StatsData): void {
  s.owned.clear();
  s.last = null;
}

/** An independent copy; the days are shared until either side changes one. */
export function copyStats(s: StatsData): StatsData {
  share(s);
  return {
    kana: copyKana(s.kana),
    days: new Map(s.days),
    owned: new Set(),
    last: null,
    started: s.started,
    finished: s.finished,
    introducedIn: new Map(s.introducedIn),
  };
}

function ownedDay(s: StatsData, day: number): MutableDay {
  if (s.last !== null && s.last.day === day) return s.last.entry;
  const have = s.days.get(day);
  if (have !== undefined && s.owned.has(day)) {
    s.last = { day, entry: have };
    return have;
  }
  const next: MutableDay =
    have === undefined
      ? { answers: 0, recall: { hiragana: [], katakana: [] } }
      : {
          answers: have.answers,
          recall: { hiragana: [...have.recall.hiragana], katakana: [...have.recall.katakana] },
        };
  s.days.set(day, next);
  s.owned.add(day);
  s.last = { day, entry: next };
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
    const log = kanaLog(s, key);
    log.recall.push({ ms: a.ms, ok: a.ok });
    // Cut to the last RECENT_RECALLS.
    if (log.recall.length > RECENT_RECALLS) log.recall.shift();
  } else if (a.task === 'recognition') {
    const log = kanaLog(s, key);
    log.recognitions += 1;
    if (!a.ok) log.recognitionErrors += 1;
  }
}

function kanaLog(s: StatsData, key: LearnKanaKey): MutableKana {
  const have = s.kana.get(key);
  if (have !== undefined) return have;
  const log: MutableKana = { recall: [], recognitions: 0, recognitionErrors: 0 };
  s.kana.set(key, log);
  return log;
}

/** The fold introduces `key` (an `intro` event or an answer on a new kana): once per kana. */
export function noteIntro(s: StatsData, key: LearnKanaKey): void {
  if (!s.introducedIn.has(key)) s.introducedIn.set(key, s.started);
}

export function noteSession(s: StatsData, kind: 'start' | 'end'): void {
  if (kind === 'start') s.started += 1;
  else s.finished += 1;
}

/** The live statistics: valid until the next change (a `KanaLog` changes in place). */
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
    introducedIn: s.introducedIn,
  };
}

/** Statistics that later changes do not touch. */
export function snapshotStats(s: StatsData): LogStats {
  share(s);
  return {
    kana: copyKana(s.kana),
    days: new Map(s.days),
    started: s.started,
    finished: s.finished,
    introducedIn: new Map(s.introducedIn),
  };
}
