import { hiraganaItems } from './items';
import { REFERENCE } from './learner';
import { createProductionPolicy } from './policies/production';
import type { WordOptions } from './policies/production';
import { simulate } from './run';
import type { RunResult } from './run';
import { load, wordKana } from './words';

/**
 * Part 3 of the P9 research (docs/research/2026-11-27-p9-planner.md): where words go in a
 * session, when they start, the re-check after an error, the closing word, slips and the round
 * after a session. `PART=place|start|recheck|closing|round` picks one table; without it all are printed. `SEEDS` (50). `WORDS`: a pool of
 * `scripts/p9-jmdict.py` (hiragana-kana.json); the committed `words-hiragana` chunk without it.
 * Every case grades a word as one recall per kana and takes words of introduced kana (ADR 117).
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
    return ids === undefined || ids.length < 2 ? [] : [ids];
  },
);

type Words = Omit<WordOptions, 'words' | 'mode' | 'of'>;

interface Case {
  readonly name: string;
  readonly words?: Words;
  readonly recheck?: number;
  readonly wordShare?: number;
  readonly slip?: number;
  readonly slips?: 'error' | 'hard';
  readonly endRound?: number;
}

function play(c: Case): RunResult[] {
  const words: WordOptions | undefined =
    c.words === undefined
      ? undefined
      : { ...c.words, words: WORDS, mode: 'recalls', of: 'introduced' };
  const factory = createProductionPolicy('hiragana', {
    words,
    recheck: c.recheck,
    slips: c.slips,
    endRound: c.endRound,
  });
  const reference = {
    ...REFERENCE,
    wordShare: c.wordShare ?? REFERENCE.wordShare,
    slip: c.slip ?? REFERENCE.slip,
  };
  return Array.from({ length: SEEDS }, (_, seed) =>
    simulate(factory, 'beginner', seed + 1, DAYS, reference),
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
const pct = (v: number): string => `${(100 * v).toFixed(1)}%`;

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

const HEADER = [
  'case',
  'reads 46 basic, day',
  'reads 104, day',
  'basic unlocked, day',
  'review retention',
  'reviews',
  'next-day recall',
  'min/day',
  'tasks a session',
  'words, share of tasks',
  'read right',
  'same-day repeats',
  'first word, session',
  'known, day 14',
  'known after the break',
];

function row(c: Case, runs: readonly RunResult[]): string[] {
  const share = runs.map((r) => (r.tasks === 0 ? 0 : r.words / r.tasks));
  const ok = runs.flatMap((r) => (r.words === 0 ? [] : [r.wordsOk / r.words]));
  const repeats = runs.flatMap((r) => (r.words === 0 ? [] : [r.wordRepeats / r.words]));
  return [
    c.name,
    day(runs, (r) => r.readsBasicDay),
    day(runs, (r) => r.readsTrackDay),
    day(runs, (r) => r.unlockedBasicDay),
    pct(median(runs.map((r) => r.reviewRetention))),
    median(runs.map((r) => r.reviews)).toFixed(0),
    pct(median(runs.map((r) => r.nextDay))),
    median(runs.map((r) => r.minutesPerDay)).toFixed(1),
    median(runs.map((r) => (r.sessions === 0 ? 0 : r.tasks / r.sessions))).toFixed(1),
    c.words === undefined
      ? '—'
      : `${median(runs.map((r) => r.words)).toFixed(0)}, ${pct(median(share))}`,
    ok.length === 0 ? '—' : pct(median(ok)),
    repeats.length === 0 ? '—' : pct(median(repeats)),
    c.words === undefined ? '—' : day(runs, (r) => r.firstWordSession),
    median(runs.map((r) => r.known[13] ?? 0)).toFixed(1),
    median(runs.map((r) => r.afterBreak[1])).toFixed(1),
  ];
}

function table(title: string, cases: readonly Case[]): void {
  console.log(`\n${title}\n`);
  console.log(
    lines(
      HEADER,
      cases.map((c) => row(c, play(c))),
    ),
  );
}

console.log(
  `\n${WORDS.length} words of two kana or more; ${SEEDS} beginners, ${DAYS} days, hiragana`,
);

if (want('place')) {
  const cases: Case[] = [{ name: 'no words' }, { name: 'every 5', words: { every: 5 } }];
  for (const carrier of [0.2, 0.35, 0.5, 0.75])
    cases.push({ name: `carrier ${carrier}`, words: { carrier } });
  cases.push({ name: 'every 5 + carrier 0.35', words: { every: 5, carrier: 0.35 } });
  for (const every of [4, 7]) cases.push({ name: `every ${every}`, words: { every } });
  for (const carrier of [0.2, 0.35, 0.5])
    cases.push({ name: `carrier ${carrier}, wordShare 0.3`, words: { carrier }, wordShare: 0.3 });
  for (const every of [4, 5, 7])
    cases.push({ name: `every ${every}, wordShare 0.3`, words: { every }, wordShare: 0.3 });
  table('Where words go: a word after every N kana tasks, or a word that carries a recall', cases);
}

if (want('start')) {
  const cases: Case[] = [];
  for (const minPool of [1, 10, 25, 50])
    for (const recent of [0, 30])
      cases.push({
        name: `every 5, start at ${minPool} words, recent ${recent}`,
        words: { every: 5, minPool, recent },
      });
  table('When words start, and words not given again within the last N words', cases);
}

if (want('recheck')) {
  const cases: Case[] = [];
  for (const recheck of [undefined, 1, 2, 3, 5]) {
    const at = recheck === undefined ? 'model step only' : `re-check after ${recheck}`;
    cases.push({ name: `no words, ${at}`, ...(recheck === undefined ? {} : { recheck }) });
    cases.push({
      name: `every 5, ${at}`,
      words: { every: 5, minPool: 10, recent: 30 },
      ...(recheck === undefined ? {} : { recheck }),
    });
  }
  table(
    'The re-check after an error: the model step alone (30 s), or a recall N tasks later',
    cases,
  );
}

if (want('closing')) {
  const base = { every: 5, minPool: 10, recent: 30 };
  table('A closing word: the last task of a session is a word of kana from the session', [
    { name: 'every 5', words: base },
    { name: 'every 5 + closing word', words: { ...base, closing: true } },
    {
      name: 'every 5 + closing word, wordShare 0.3',
      words: { ...base, closing: true },
      wordShare: 0.3,
    },
  ]);
}

if (want('round')) {
  const base = { every: 5, minPool: 25, recent: 30 };
  const cases: Case[] = [
    { name: 'no slips, no round', words: base },
    { name: 'no slips, round of 5', words: base, endRound: 5 },
    { name: 'no slips, round of all', words: base, endRound: 99 },
  ];
  for (const slip of [0.03, 0.06])
    for (const slips of ['error', 'hard'] as const)
      for (const endRound of [undefined, 5])
        cases.push({
          name: `slips ${slip}, slip = ${slips === 'error' ? 'error' : 'hard'}, ${endRound === undefined ? 'no round' : 'round of 5'}`,
          words: base,
          slip,
          slips,
          ...(endRound === undefined ? {} : { endRound }),
        });
  table(
    'Slips and the round after a session: a slip read as an error (today) or as hard, and each kana answered wrong once more after the last task',
    cases,
  );
}
