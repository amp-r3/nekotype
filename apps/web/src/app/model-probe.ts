import { foldLog, forecastRow, habitsOf, nextRow } from '@nekotype/model';
import type { LogEvent, Rng } from '@nekotype/shared/types';

// The test build's probe of the model's cost (docs/spec/quality.md, "Budgets"; ADR 100, point 10).
// `main.tsx` loads it by a dynamic import only when `__LATENCY_PROBE__` is true, so the production
// build never has it. `e2e/model-cost.spec.ts` calls `window.__nekotypeModelCost` under CPU
// throttling; the model itself is never in the initial chunk.

type Cost = { readonly fold: readonly number[]; readonly forecast: readonly number[] };

function isLogEvent(value: unknown): value is LogEvent {
  if (value === null || typeof value !== 'object') return false;
  const t: unknown = Reflect.get(value, 't');
  const numbers = ['at', 'n'].every((key) => typeof Reflect.get(value, key) === 'number');
  if (!numbers || typeof Reflect.get(value, 'dev') !== 'string') return false;
  return t === 'start' || t === 'end' || t === 'intro' || t === 'answer';
}

function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** One warm-up, then `runs` timed runs of the fold and of the forecast of the next katakana row. */
function measure(events: readonly LogEvent[], runs: number): Cost {
  const fold: number[] = [];
  const forecast: number[] = [];
  const now = (events.at(-1)?.at ?? 0) + 3_600_000;
  for (let run = 0; run <= runs; run += 1) {
    const t0 = performance.now();
    const folded = foldLog(events, { targetMs: 1500, stats: true });
    const t1 = performance.now();
    const row = nextRow(folded.state, 'katakana');
    if (row === null) throw new Error('every katakana row is introduced: nothing to forecast');
    forecastRow(folded.state, row, {
      now,
      track: 'hiragana',
      rng: seeded(run + 1),
      habits: habitsOf(folded.state),
      history: [],
    });
    const t2 = performance.now();
    if (run > 0) {
      fold.push(t1 - t0);
      forecast.push(t2 - t1);
    }
  }
  return { fold, forecast };
}

export function installModelProbe(): void {
  Reflect.set(window, '__nekotypeModelCost', (events: unknown, runs: unknown): Cost => {
    if (!Array.isArray(events) || !events.every(isLogEvent) || typeof runs !== 'number') {
      throw new Error('the model probe wants a log and a number of runs');
    }
    return measure(events, runs);
  });
}
