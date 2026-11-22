import type { LearnKanaKey } from '@nekotype/shared/types';
import { ITEMS } from './items';
import type { ChartState, LearnView } from './view';

export type Stronger = {
  readonly key: LearnKanaKey;
  readonly from: ChartState;
  readonly to: ChartState;
};

const RANK: Readonly<Record<ChartState, number>> = {
  locked: 0,
  learning: 1,
  learned: 2,
  mastered: 3,
};

/** Kana whose chart state rose, or that stayed learned or mastered with stability at least doubled; track order. */
export function strongerSince(before: LearnView, after: LearnView): readonly Stronger[] {
  const result: Stronger[] = [];
  for (const key of ITEMS.keys()) {
    const was = before.kana.get(key);
    const now = after.kana.get(key);
    if (was === undefined || now === undefined) continue;
    if (RANK[now.state] > RANK[was.state]) {
      result.push({ key, from: was.state, to: now.state });
    } else if (
      now.state === was.state &&
      (now.state === 'learned' || now.state === 'mastered') &&
      was.stability !== null &&
      now.stability !== null &&
      now.stability >= 2 * was.stability
    ) {
      result.push({ key, from: was.state, to: now.state });
    }
  }
  return result;
}
