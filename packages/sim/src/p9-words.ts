import { readFileSync } from 'node:fs';
import { SKIP_CHARACTERS } from '@nekotype/engine';
import { trackItems } from '@nekotype/model';
import type { ModelState } from '@nekotype/model';
import { isObject } from '@nekotype/shared/runtime';
import { bothTracks } from './items';
import type { Item, Track } from './items';
import { REFERENCE } from './learner';
import { createProductionPolicy } from './policies/production';
import { simulate } from './run';
import type { PolicyFactory, RunResult } from './run';

/**
 * Part 1 of the P9 research (docs/research/2026-11-27-p9-words-content.md): how many words and
 * phrases of the generated content a learner can read as the track goes on. `PART=content|rows|
 * first|sessions|jmdict` picks one table; without it all but `jmdict` are printed. `SEEDS` (30) for
 * `sessions`.
 */

const PART = process.env['PART'];
const want = (part: string): boolean => PART === undefined || PART === part;

const SEEDS = Number(process.env['SEEDS'] ?? 30);
const DAYS = 60;

interface Text {
  readonly id: string;
  readonly text: string;
  readonly meaning: string;
  readonly script: string;
}

const CONTENT = new URL('../../../apps/web/src/entities/prompt/content/', import.meta.url);

function load(chunk: string | URL): readonly Text[] {
  const file = typeof chunk === 'string' ? new URL(`${chunk}.json`, CONTENT) : chunk;
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${String(chunk)} is not an array`);
  return data.flatMap((entry: unknown): Text[] => {
    if (!isObject(entry)) return [];
    const { id, text, script, meaning } = entry;
    const en = isObject(meaning) ? meaning['en'] : undefined;
    if (typeof id !== 'string' || typeof text !== 'string' || typeof script !== 'string') return [];
    return [{ id, text, script, meaning: typeof en === 'string' ? en : '' }];
  });
}

const ITEMS: readonly Item[] = bothTracks();
const ID_OF = new Map(ITEMS.map((item) => [item.kana, item.id]));

/** A token of a text: a learnable kana (its item id) or a character no row teaches. */
type Token = number | 'sokuon' | 'choon' | 'skip' | `other:${string}`;

/** Longest match first, as the engine and `kanaOfReading` of the model do. */
function tokens(text: string): readonly Token[] {
  const chars = Array.from(text);
  const out: Token[] = [];
  for (let at = 0; at < chars.length;) {
    const two = at + 1 < chars.length ? ID_OF.get(chars.slice(at, at + 2).join('')) : undefined;
    if (two !== undefined) {
      out.push(two);
      at += 2;
      continue;
    }
    const char = chars[at] ?? '';
    const one = ID_OF.get(char);
    if (one !== undefined) out.push(one);
    else if (char === 'っ' || char === 'ッ') out.push('sokuon');
    else if (char === 'ー') out.push('choon');
    else if (SKIP_CHARACTERS.has(char)) out.push('skip');
    else out.push(`other:${char}`);
    at += 1;
  }
  return out;
}

/** `plain`: no っ or ー; `rules`: っ and ー count as taught (idea 8 of the P9 discussion). */
type Variant = 'plain' | 'rules';

interface Parsed {
  readonly text: Text;
  readonly kana: readonly number[];
  readonly rules: boolean;
  readonly other: readonly string[];
}

function parse(text: Text): Parsed {
  const all = tokens(text.text);
  return {
    text,
    kana: [...new Set(all.filter((t): t is number => typeof t === 'number'))],
    rules: all.some((t) => t === 'sokuon' || t === 'choon'),
    other: all.flatMap((t) =>
      typeof t === 'string' && t.startsWith('other:') ? [t.slice(6)] : [],
    ),
  };
}

function readable(p: Parsed, known: (id: number) => boolean, variant: Variant): boolean {
  if (p.other.length > 0) return false;
  if (p.rules && variant === 'plain') return false;
  return p.kana.every(known);
}

/** `HIRAGANA_POOL` and `KATAKANA_POOL` (paths) replace a word chunk with a pool of `p9-jmdict.py`. */
function words(track: Track): readonly Parsed[] {
  const pool = process.env[track === 'hiragana' ? 'HIRAGANA_POOL' : 'KATAKANA_POOL'];
  return load(pool === undefined ? `words-${track}` : new URL(`file://${pool}`)).map(parse);
}

const WORDS: Readonly<Record<Track, readonly Parsed[]>> = {
  hiragana: words('hiragana'),
  katakana: words('katakana'),
};
const PHRASES: Readonly<Record<Track, readonly Parsed[]>> = {
  hiragana: load('phrases-hiragana').map(parse),
  katakana: load('phrases-katakana').map(parse),
};
const MIXED = load('phrases-mixed').map(parse);
const TRACKS: readonly Track[] = ['hiragana', 'katakana'];

function lines(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${header.join(' | ')} |`,
    `|${' --- |'.repeat(header.length)}`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = sorted[Math.floor(pos)] ?? Number.NaN;
  const hi = sorted[Math.ceil(pos)] ?? lo;
  return lo + (hi - lo) * (pos - Math.floor(pos));
}

function spread(values: readonly number[]): string {
  if (values.length === 0) return '—';
  const f = (v: number): string => v.toFixed(0);
  return `${f(quantile(values, 0.5))} (${f(quantile(values, 0.1))}–${f(quantile(values, 0.9))})`;
}

const count = (list: readonly Parsed[], known: (id: number) => boolean, v: Variant): number =>
  list.filter((p) => readable(p, known, v)).length;

if (want('content')) {
  const rows: string[][] = [];
  const chunks: [string, readonly Parsed[]][] = [
    ['words-hiragana', WORDS.hiragana],
    ['words-katakana', WORDS.katakana],
    ['phrases-hiragana', PHRASES.hiragana],
    ['phrases-katakana', PHRASES.katakana],
    ['phrases-mixed', MIXED],
  ];
  for (const [name, list] of chunks) {
    const lengths = list.map((p) => tokens(p.text.text).filter((t) => t !== 'skip').length);
    const other = new Set(list.flatMap((p) => p.other));
    rows.push([
      name,
      String(list.length),
      String(list.filter((p) => p.rules).length),
      list.length === 0 ? '—' : spread(lengths),
      other.size === 0 ? '—' : [...other].join(' '),
      String(list.filter((p) => p.other.length > 0).length),
    ]);
  }
  console.log(
    '\nContent: size, っ or ー, tokens per text (median, p10–p90), untaught characters\n',
  );
  console.log(
    lines(
      ['chunk', 'texts', 'with っ or ー', 'tokens', 'other characters', 'unreadable ever'],
      rows,
    ),
  );
}

/** The kana of a track in track order, introduced row by row (the planner's order, learning.md). */
function rowsOf(
  track: Track,
): readonly { readonly row: string; readonly ids: readonly number[] }[] {
  const byRow = new Map<string, number[]>();
  for (const item of ITEMS.filter((i) => i.track === track)) {
    const ids = byRow.get(item.row) ?? [];
    ids.push(item.id);
    byRow.set(item.row, ids);
  }
  return [...byRow].map(([row, ids]) => ({ row, ids }));
}

if (want('rows')) {
  for (const track of TRACKS) {
    const known = new Set<number>();
    const rows: string[][] = [];
    for (const { row, ids } of rowsOf(track)) {
      for (const id of ids) known.add(id);
      const has = (id: number): boolean => known.has(id);
      const words = WORDS[track];
      const phrases = PHRASES[track];
      rows.push([
        row.split(':')[1] ?? row,
        String(known.size),
        String(count(words, has, 'plain')),
        String(count(words, has, 'rules')),
        `${Math.round((100 * count(words, has, 'rules')) / words.length)}%`,
        String(count(phrases, has, 'plain')),
        String(count(phrases, has, 'rules')),
      ]);
    }
    console.log(`\nReadable ${track} texts once each row is fully introduced (track order)\n`);
    console.log(
      lines(
        [
          'row',
          'kana',
          'words, no っ/ー',
          'words, with っ/ー',
          'share',
          'phrases, no っ/ー',
          'phrases, with っ/ー',
        ],
        rows,
      ),
    );
  }
  const all = (): boolean => true;
  console.log(
    `\nMixed phrases readable with both tracks complete: ${count(MIXED, all, 'rules')} of ${MIXED.length}`,
  );
}

if (want('first')) {
  for (const track of TRACKS) {
    const known = new Set<number>();
    const seen = new Set<string>();
    const rows: string[][] = [];
    for (const { row, ids } of rowsOf(track)) {
      for (const id of ids) known.add(id);
      const fresh = WORDS[track].filter(
        (p) => !seen.has(p.text.id) && readable(p, (id) => known.has(id), 'rules'),
      );
      for (const p of fresh) seen.add(p.text.id);
      if (fresh.length === 0) continue;
      rows.push([
        row.split(':')[1] ?? row,
        String(fresh.length),
        fresh
          .slice(0, 8)
          .map((p) => `${p.text.text} (${p.text.meaning.split(';')[0] ?? ''})`)
          .join(', '),
      ]);
      if (rows.length >= 6) break;
    }
    console.log(`\nThe first ${track} words, by the row that opens them (with っ/ー)\n`);
    console.log(lines(['row', 'new words', 'examples'], rows));
  }
}

/**
 * `PART=jmdict` reads two files of the JMdict analysis the note describes (not in the repository):
 * `HIRA_KIND`, a JSON object from each hiragana word to how JMdict spells it (`kana-only`, `usually
 * kana`, `kana in some senses`, `kanji`), and `POOL`, `name=path` pairs of word lists in the chunk
 * format, each compared row by row with the chunk of its script.
 */
if (PART === 'jmdict') {
  const kindsFile = process.env['HIRA_KIND'];
  if (kindsFile !== undefined) {
    const kinds: unknown = JSON.parse(readFileSync(kindsFile, 'utf8'));
    const kindOf = (text: string): string => {
      const kind = isObject(kinds) ? kinds[text] : undefined;
      return typeof kind === 'string' ? kind : 'unknown';
    };
    const kana = (p: Parsed): boolean => kindOf(p.text.text) !== 'kanji';
    const known = new Set<number>();
    const rows: string[][] = [];
    for (const { row, ids } of rowsOf('hiragana')) {
      for (const id of ids) known.add(id);
      const words = WORDS.hiragana.filter((p) => readable(p, (id) => known.has(id), 'rules'));
      rows.push([
        row.split(':')[1] ?? row,
        String(words.length),
        String(words.filter(kana).length),
        words
          .filter(kana)
          .slice(0, 6)
          .map((p) => p.text.text)
          .join(' '),
      ]);
    }
    console.log('\nReadable hiragana words and those JMdict writes in kana (with っ/ー)\n');
    console.log(lines(['row', 'words', 'written in kana', 'examples in kana'], rows));
  }
  const pools = (process.env['POOL'] ?? '').split(',').flatMap((pair) => {
    const [name, path] = pair.split('=');
    if (name === undefined || path === undefined) return [];
    const list: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(list)) return [];
    const texts = list.flatMap((entry: unknown): Text[] => {
      if (!isObject(entry) || typeof entry['text'] !== 'string') return [];
      const script = entry['script'] === 'hiragana' ? 'hiragana' : 'katakana';
      return [{ id: entry['text'], text: entry['text'], script, meaning: '' }];
    });
    return [{ name, parsed: texts.map(parse), track: texts[0]?.script ?? 'katakana' }];
  });
  for (const track of TRACKS) {
    const mine = pools.filter((pool) => pool.track === track);
    if (mine.length === 0) continue;
    const all = [{ name: `words-${track}`, parsed: WORDS[track] }, ...mine];
    const known = new Set<number>();
    const rows: string[][] = [];
    for (const { row, ids } of rowsOf(track)) {
      for (const id of ids) known.add(id);
      const has = (id: number): boolean => known.has(id);
      rows.push([
        row.split(':')[1] ?? row,
        ...all.flatMap(({ parsed }) => [
          String(count(parsed, has, 'plain')),
          String(count(parsed, has, 'rules')),
        ]),
      ]);
    }
    console.log(`\nReadable ${track} words once each row is introduced: the chunk and the pools\n`);
    console.log(
      lines(
        [
          'row',
          ...all.flatMap(({ name, parsed }) => [
            `${name} (${parsed.length}), no っ/ー`,
            'with っ/ー',
          ]),
        ],
        rows,
      ),
    );
    for (const { name, parsed } of mine) {
      const unreadable = parsed.filter((p) => p.other.length > 0).length;
      const rules = parsed.filter((p) => p.rules).length;
      console.log(
        `\n${name}: ${rules} of ${parsed.length} with っ/ー; ${unreadable} never readable`,
      );
    }
  }
}

const BASIC_HIRAGANA = trackItems('hiragana')
  .filter((item) => item.category === 'basic')
  .map((item) => item.key);

/** The learner of the answer-time note who takes the katakana suggestion (answer-time.ts). */
const FOLLOWS_SUGGESTION: PolicyFactory = (items, rng) => {
  let katakana = false;
  const track = (state: ModelState): Track => {
    katakana ||= BASIC_HIRAGANA.every((key) => state.items.get(key)?.phase === 'learned');
    return katakana ? 'katakana' : 'hiragana';
  };
  return createProductionPolicy(track)(items, rng);
};

const CHECKPOINTS = [2, 4, 6, 10, 15, 20, 30, 40, 60, 80, 100];
const TARGETS = [1, 10, 50, 100];

if (want('sessions')) {
  const results: RunResult[] = Array.from({ length: SEEDS }, (_, seed) =>
    simulate(FOLLOWS_SUGGESTION, 'beginner', seed + 1, DAYS, REFERENCE, { tracks: 'both' }),
  );
  for (const track of TRACKS) {
    const learnedBy = (r: RunResult, s: number) => (id: number) => {
      const at = r.milestones.get(id)?.learnedSession;
      return at !== undefined && at <= s;
    };
    const rows = CHECKPOINTS.map((s) => [
      String(s),
      spread(results.map((r) => count(WORDS[track], learnedBy(r, s), 'plain'))),
      spread(results.map((r) => count(WORDS[track], learnedBy(r, s), 'rules'))),
      spread(results.map((r) => count(PHRASES[track], learnedBy(r, s), 'rules'))),
    ]);
    console.log(
      `\n${track}: readable texts from learned kana after N sessions (median, p10–p90; ${SEEDS} beginners, both tracks, katakana once the basic hiragana are learned)\n`,
    );
    console.log(lines(['session', 'words, no っ/ー', 'words, with っ/ー', 'phrases'], rows));
    const reach = TARGETS.map((target) => {
      const hits = results.flatMap((r) => {
        for (let s = 1; s <= r.sessions; s += 1) {
          if (count(WORDS[track], learnedBy(r, s), 'rules') >= target) {
            const day = [...r.milestones.values()]
              .filter((m) => m.learnedSession !== undefined && m.learnedSession <= s)
              .reduce((d, m) => Math.max(d, m.learnedDay ?? 0), 0);
            return [[s, day] as const];
          }
        }
        return [];
      });
      return [
        String(target),
        spread(hits.map(([s]) => s)),
        spread(hits.map(([, d]) => d)),
        `${Math.round((100 * hits.length) / results.length)}%`,
      ];
    });
    console.log(`\n${track}: when the learner can first read N words (with っ/ー)\n`);
    console.log(lines(['words', 'session', 'day', 'runs that reach it'], reach));
  }
  const sessions = results.map((r) => r.sessions);
  console.log(`\nSessions in ${DAYS} days: ${spread(sessions)}`);
}
