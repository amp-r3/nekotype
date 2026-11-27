import { hiraganaItems } from './items';
import { REFERENCE } from './learner';
import type { ReferenceParams } from './learner';
import { createProductionPolicy } from './policies/production';
import type { WordMode } from './policies/production';
import { simulate } from './run';
import type { RunResult } from './run';
import { load, wordKana } from './words';

/**
 * Part 2 of the P9 research (docs/research/2026-11-27-p9-task-types.md): how the model should hear
 * of a word task. `PART=modes|truth|share|introduced` picks one table; without it all are printed. `SEEDS`
 * (50). `WORDS`: a pool of `scripts/p9-jmdict.py` (hiragana-kana.json); the committed
 * `words-hiragana` chunk without it.
 */

const PART = process.env['PART'];
const want = (part: string): boolean => PART === undefined || PART === part;
const SEEDS = Number(process.env['SEEDS'] ?? 50);
const DAYS = 60;

const ITEMS = hiraganaItems();
const POOL = process.env['WORDS'];
const WORDS = load(POOL === undefined ? 'words-hiragana' : new URL(`file://${POOL}`)).flatMap(
  (text) => {
    const ids = wordKana(text.text, ITEMS);
    // A word of one kana is a recall of that kana; the tasks read words of two kana or more.
    return ids === undefined || ids.length < 2 ? [] : [ids];
  },
);

interface Case {
  readonly name: string;
  readonly mode: WordMode | 'no words';
  readonly every: number;
  readonly reference: ReferenceParams;
  readonly of?: 'learned' | 'introduced';
}

function play(c: Case): RunResult[] {
  const words =
    c.mode === 'no words'
      ? undefined
      : { words: WORDS, every: c.every, mode: c.mode, of: c.of ?? 'learned' };
  const factory = createProductionPolicy('hiragana', { words });
  return Array.from({ length: SEEDS }, (_, seed) =>
    simulate(factory, 'beginner', seed + 1, DAYS, c.reference),
  );
}

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = sorted[Math.floor(pos)] ?? Number.NaN;
  const hi = sorted[Math.ceil(pos)] ?? lo;
  return lo + (hi - lo) * (pos - Math.floor(pos));
}

const median = (values: readonly number[]): number => quantile(values, 0.5);

function day(runs: readonly RunResult[], pick: (r: RunResult) => number | undefined): string {
  const reached = runs.flatMap((r) => {
    const v = pick(r);
    return v === undefined ? [] : [v];
  });
  if (reached.length === 0) return 'never';
  const share = Math.round((100 * reached.length) / runs.length);
  return `${median(reached).toFixed(0)}${share < 100 ? ` (${share}%)` : ''}`;
}

function lines(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${header.join(' | ')} |`,
    `|${' --- |'.repeat(header.length)}`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

const pct = (v: number): string => `${(100 * v).toFixed(1)}%`;

function row(c: Case, runs: readonly RunResult[]): string[] {
  const words = runs.map((r) => r.words);
  const ok = runs.map((r) => (r.words === 0 ? Number.NaN : r.wordsOk / r.words));
  return [
    c.name,
    day(runs, (r) => r.readsBasicDay),
    day(runs, (r) => r.readsTrackDay),
    day(runs, (r) => r.unlockedBasicDay),
    pct(median(runs.map((r) => r.reviewRetention))),
    median(runs.map((r) => r.reviews)).toFixed(0),
    median(runs.map((r) => r.tasks)).toFixed(0),
    c.mode === 'no words'
      ? '—'
      : `${median(words).toFixed(0)} (${pct(median(ok.filter((v) => !Number.isNaN(v))))})`,
    median(runs.map((r) => r.known[13] ?? 0)).toFixed(1),
    median(runs.map((r) => r.afterBreak[1])).toFixed(1),
  ];
}

const HEADER = [
  'case',
  'reads 46 basic, day',
  'reads 104, day',
  'basic unlocked, day',
  'review retention',
  'reviews',
  'tasks',
  'words (read right)',
  'known, day 14',
  'known 30 days after day 60',
];

const MODES: readonly (WordMode | 'no words')[] = [
  'no words',
  'none',
  'credit',
  'again',
  'recalls',
];

console.log(
  `\n${WORDS.length} words of two kana or more; ${SEEDS} beginners, ${DAYS} days, hiragana`,
);

if (want('modes')) {
  const rows = MODES.map((mode) => {
    const c: Case = { name: mode, mode, every: 5, reference: REFERENCE };
    return row(c, play(c));
  });
  console.log('\nHow the model hears of a word: a word after every 5 kana tasks, wordShare 0.6\n');
  console.log(lines(HEADER, rows));
}

if (want('truth')) {
  const rows: string[][] = [];
  for (const share of [0.3, 1]) {
    for (const mode of MODES.slice(1)) {
      const c: Case = {
        name: `${mode}, wordShare ${share}`,
        mode,
        every: 5,
        reference: { ...REFERENCE, wordShare: share },
      };
      rows.push(row(c, play(c)));
    }
  }
  console.log('\nThe same when a kana read in a word helps memory less or as much as a recall\n');
  console.log(lines(HEADER, rows));
}

if (want('share')) {
  const rows: string[][] = [];
  for (const every of [2, 3, 5, 10]) {
    for (const mode of ['again', 'recalls'] as const) {
      const c: Case = { name: `${mode}, every ${every}`, mode, every, reference: REFERENCE };
      rows.push(row(c, play(c)));
    }
  }
  console.log('\nHow many words a session can hold (wordShare 0.6); part 3 settles the mix\n');
  console.log(lines(HEADER, rows));
}

if (want('introduced')) {
  const rows: string[][] = [];
  for (const share of [0.3, 0.6, 1]) {
    for (const mode of MODES.slice(1)) {
      const c: Case = {
        name: `${mode}, wordShare ${share}`,
        mode,
        every: 5,
        reference: { ...REFERENCE, wordShare: share },
        of: 'introduced',
      };
      rows.push(row(c, play(c)));
    }
  }
  console.log(
    '\nWords of every introduced kana, learning ones too (a word after every 5 kana tasks)\n',
  );
  console.log(lines(HEADER, rows));
}
