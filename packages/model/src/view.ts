import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import { DAY_MS, MASTERED_STABILITY_DAYS } from './constants';
import type { ModelState } from './fold';
import { ITEMS, trackItems } from './items';
import { dueFrom } from './learner';
import type { LogStats, RecallStat } from './stats';

export type ChartState = 'locked' | 'learning' | 'learned' | 'mastered';
export type KanaView = {
  readonly key: LearnKanaKey;
  readonly state: ChartState;
  /** Learned or mastered: from this moment it is due; else null. */
  readonly dueFrom: number | null;
  /** Learned or mastered: when its predicted recall reaches 0.90 (`lastAt + stability` days). */
  readonly nextReviewAt: number | null;
  /** Learned or mastered: the stability in days; else null. */
  readonly stability: number | null;
  readonly recall: readonly RecallStat[];
  /** Of `recall`; 0 when empty. The median of an even count is the mean of the two middle values. */
  readonly medianMs: number;
  /** The share of `recall` answered correctly; 0 when empty. */
  readonly accuracy: number;
  readonly recognitions: number;
  readonly recognitionErrors: number;
  /** Kana given instead of this one, highest count first, then track order. */
  readonly confusions: readonly { readonly key: LearnKanaKey; readonly count: number }[];
};
export type LearnView = {
  /** Every kana of both tracks. */
  readonly kana: ReadonlyMap<LearnKanaKey, KanaView>;
  /** The first new kana of the track whose parts are learned (the chart's "opens next"). */
  readonly opensNext: Readonly<Record<Track, LearnKanaKey | null>>;
  readonly mastered: Readonly<Record<Track, number>>;
  readonly introduced: Readonly<Record<Track, number>>;
  /** The 46 basic hiragana are learned (ADR 100, point 5); P8 shows it. */
  readonly suggestKatakana: boolean;
  readonly stats: LogStats;
};

/** The basic kana of a track: 46 in both. */
const BASIC_COUNT = trackItems('hiragana').filter((item) => item.category === 'basic').length;

const TRACKS: readonly Track[] = ['hiragana', 'katakana'];

/** Position in `ITEMS`: hiragana first, each track in its order. */
const RANK: ReadonlyMap<LearnKanaKey, number> = new Map(
  [...ITEMS.keys()].map((key, rank) => [key, rank]),
);

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const high = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? high : ((sorted[mid - 1] ?? 0) + high) / 2;
}

function confusionsOf(state: ModelState, key: LearnKanaKey): KanaView['confusions'] {
  const row = state.confusions.get(key);
  if (row === undefined) return [];
  return [...row]
    .map(([given, count]) => ({ key: given, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (RANK.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (RANK.get(b.key) ?? Number.MAX_SAFE_INTEGER),
    );
}

function viewOf(state: ModelState, stats: LogStats, key: LearnKanaKey): KanaView {
  const item = state.items.get(key);
  const log = stats.kana.get(key);
  const recall = log?.recall ?? [];
  const known = item?.phase === 'learned';
  const chart: ChartState =
    item === undefined
      ? 'locked'
      : !known
        ? 'learning'
        : item.memory.stability >= MASTERED_STABILITY_DAYS
          ? 'mastered'
          : 'learned';
  return {
    key,
    state: chart,
    dueFrom: dueFrom(state, key),
    nextReviewAt: known ? item.lastAt + item.memory.stability * DAY_MS : null,
    stability: known ? item.memory.stability : null,
    recall,
    medianMs: median(recall.map((r) => r.ms)),
    accuracy: recall.length === 0 ? 0 : recall.filter((r) => r.ok).length / recall.length,
    recognitions: log?.recognitions ?? 0,
    recognitionErrors: log?.recognitionErrors ?? 0,
    confusions: confusionsOf(state, key),
  };
}

/** What the screens read: plain data of a state and its statistics; the model is not loaded. */
export function describe(state: ModelState, stats: LogStats): LearnView {
  const kana = new Map<LearnKanaKey, KanaView>();
  for (const key of ITEMS.keys()) kana.set(key, viewOf(state, stats, key));

  const learnedKey = (key: LearnKanaKey): boolean => state.items.get(key)?.phase === 'learned';
  const opensNext: Record<Track, LearnKanaKey | null> = { hiragana: null, katakana: null };
  const mastered: Record<Track, number> = { hiragana: 0, katakana: 0 };
  const introduced: Record<Track, number> = { hiragana: 0, katakana: 0 };
  for (const track of TRACKS) {
    for (const item of trackItems(track)) {
      const view = kana.get(item.key);
      if (view?.state === 'mastered') mastered[track] += 1;
      if (view !== undefined && view.state !== 'locked') introduced[track] += 1;
      if (opensNext[track] === null && view?.state === 'locked' && item.parts.every(learnedKey)) {
        opensNext[track] = item.key;
      }
    }
  }
  const basicLearned = trackItems('hiragana').filter(
    (item) => item.category === 'basic' && learnedKey(item.key),
  ).length;
  return {
    kana,
    opensNext,
    mastered,
    introduced,
    suggestKatakana: basicLearned >= BASIC_COUNT,
    stats,
  };
}
