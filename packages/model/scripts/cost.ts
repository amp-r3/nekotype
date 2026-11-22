import { performance } from 'node:perf_hooks';
import { foldLog, forecastRow, habitsOf, nextRow } from '../src/index';
import { syntheticLog } from '../src/testing/synthetic-log';

/** Prints the fold and the forecast timings in Node, for information (the gate is Chromium, 4x). */
const ANSWERS = Number(process.env['ANSWERS'] ?? 40_000);
const RUNS = 5;

function seeded(seed: number): { next(): number } {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

const events = syntheticLog({ answers: ANSWERS, seed: 1 });
const fold: number[] = [];
const forecast: number[] = [];
let last = foldLog(events, { targetMs: 1500, stats: true });
for (let run = 0; run <= RUNS; run += 1) {
  const t0 = performance.now();
  last = foldLog(events, { targetMs: 1500, stats: true });
  const t1 = performance.now();
  const row = nextRow(last.state, 'katakana');
  if (row === null) throw new Error('every katakana is introduced: the log has no row to come');
  forecastRow(last.state, row, {
    now: (events.at(-1)?.at ?? 0) + 3_600_000,
    track: 'hiragana',
    rng: seeded(run + 1),
    habits: habitsOf(last.state),
    history: [],
  });
  const t2 = performance.now();
  if (run > 0) {
    fold.push(t1 - t0);
    forecast.push(t2 - t1);
  }
}
const fixed = (list: readonly number[]): string => list.map((v) => v.toFixed(1)).join(', ');
console.log(`${events.length} events, ${ANSWERS} answers`);
console.log(`fold ms: ${fixed(fold)}`);
console.log(`forecast ms: ${fixed(forecast)}`);
