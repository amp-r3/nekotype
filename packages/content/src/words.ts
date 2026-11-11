import { compiles } from './compile';
import type { JmdictEntry, JmdictReading, JmdictSense } from './jmdict/parse';
import type { ContentItem, SelectionReport } from './types';

/** A (JMdict entry, reading) pair chosen for the word list, in selection order. */
export interface WordRow {
  seq: number;
  kana: string;
}

export const MEANING_SENSES = 3;
export const MEANING_LIMIT = 60;
export const FALLBACK_CAP = 2000;
const FALLBACK_TAGS = new Set(['news1', 'ichi1', 'spec1', 'spec2', 'gai1']);

type WordScript = 'hiragana' | 'katakana';

/** Hiragana-only or katakana-only (`ー` counts as either); anything else is `null`. */
export function scriptOf(reading: string): WordScript | null {
  if (/^[ぁ-ゖゝゞー]+$/u.test(reading) && /[ぁ-ゖゝゞ]/u.test(reading)) return 'hiragana';
  if (/^[ァ-ヺヽヾー]+$/u.test(reading) && /[ァ-ヺヽヾ]/u.test(reading)) return 'katakana';
  return null;
}

/** The reading must be a `reb` of the entry that is not search-only. */
function findReading(entry: JmdictEntry, kana: string): JmdictReading | null {
  return entry.readings.find((r) => r.text === kana && !r.searchOnly) ?? null;
}

/** Senses with an English gloss that apply to the reading (`stagr` absent or listing it). */
function sensesFor(entry: JmdictEntry, kana: string): JmdictSense[] {
  return entry.senses.filter(
    (s) => s.glossEn.length > 0 && (s.stagr === undefined || s.stagr.includes(kana)),
  );
}

/** Joins the parts with `; `, dropping parts from the end while too long; the first one stays. */
function joinMeaning(parts: readonly string[]): string {
  const kept = [...parts];
  while (kept.length > 1 && kept.join('; ').length > MEANING_LIMIT) kept.pop();
  return kept.join('; ');
}

/** C5: the first gloss of each of the first three senses. */
function entryMeaning(entry: JmdictEntry, kana: string): string {
  const glosses = sensesFor(entry, kana)
    .slice(0, MEANING_SENSES)
    .flatMap((s) => s.glossEn.slice(0, 1));
  return joinMeaning(glosses);
}

/** C6: the first sense's first gloss of up to three homonym entries. */
function homonymMeaning(group: readonly { entry: JmdictEntry; kana: string }[]): string {
  const glosses = group
    .slice(0, MEANING_SENSES)
    .flatMap(({ entry, kana }) => sensesFor(entry, kana).slice(0, 1))
    .flatMap((s) => s.glossEn.slice(0, 1));
  return joinMeaning(glosses);
}

export interface WordsResult {
  items: Record<WordScript, ContentItem[]>;
  report: SelectionReport;
  /** Per kept item: does any of its entries have a Russian gloss. */
  russian: Record<string, boolean>;
}

/**
 * Builds the word items for the rows (C5, C6) and runs the compile check. `entries` must hold
 * every `seq` of the rows that exist in JMdict.
 */
export function buildWords(
  rows: readonly WordRow[],
  entries: ReadonlyMap<number, JmdictEntry>,
  source: SelectionReport['source'],
): WordsResult {
  const excluded: Record<string, number> = {};
  const exclude = (reason: string): void => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
  };
  const groups = new Map<
    string,
    { script: WordScript; kana: string; members: { entry: JmdictEntry; kana: string }[] }
  >();
  const seen = new Set<string>();
  for (const { seq, kana } of rows) {
    const entry = entries.get(seq);
    if (entry === undefined || findReading(entry, kana) === null) {
      exclude('readingNotInEntry');
      continue;
    }
    if (sensesFor(entry, kana).length === 0) {
      exclude('noEnglishSense');
      continue;
    }
    const script = scriptOf(kana);
    if (script === null) {
      exclude('mixedScript');
      continue;
    }
    // The same (entry, reading) in two level lists is one word.
    if (seen.has(`${seq}:${kana}`)) {
      exclude('duplicate');
      continue;
    }
    seen.add(`${seq}:${kana}`);
    const id = `w:${script}:${kana}`;
    const group = groups.get(id) ?? { script, kana, members: [] };
    group.members.push({ entry, kana });
    groups.set(id, group);
  }

  const items: Record<WordScript, ContentItem[]> = { hiragana: [], katakana: [] };
  const russian: Record<string, boolean> = {};
  const compileFailed: SelectionReport['compileFailed'] = [];
  let selected = 0;
  for (const [id, { script, kana, members }] of groups) {
    selected += 1;
    if (!compiles(kana, script)) {
      compileFailed.push({ id, text: kana });
      continue;
    }
    const first = members[0];
    if (first === undefined) continue;
    const en = members.length === 1 ? entryMeaning(first.entry, kana) : homonymMeaning(members);
    items[script].push({ id, text: kana, script, meaning: { en } });
    russian[id] = members.some(({ entry }) => entry.senses.some((s) => s.glossRu.length > 0));
  }
  return { items, report: { source, selected, excluded, compileFailed }, russian };
}

/** Counts of the Russian coverage report. */
export function russianCoverage(russian: Readonly<Record<string, boolean>>): {
  total: number;
  withRussian: number;
  percent: number;
  items: Record<string, boolean>;
} {
  const values = Object.values(russian);
  const withRussian = values.filter(Boolean).length;
  const total = values.length;
  const percent = total === 0 ? 0 : Math.round((withRussian / total) * 1000) / 10;
  return { total, withRussian, percent, items: { ...russian } };
}

function nfRank(tags: readonly string[]): number | null {
  for (const tag of tags) {
    const match = /^nf(\d\d)$/.exec(tag);
    if (match?.[1] !== undefined) return Number(match[1]);
  }
  return null;
}

/**
 * The fallback selection (content.md, "Words" step 2), used only when `sources.json` has no JLPT
 * mapping: entries whose first non-search-only reading carries one of the common priority tags.
 * Entries with an `nfXX` rank come first by ascending rank; the rest by the number of priority tags
 * (descending), then by sequence number. Capped at 2,000 rows.
 */
export function selectFallback(entries: Iterable<JmdictEntry>, cap = FALLBACK_CAP): WordRow[] {
  const candidates: { seq: number; kana: string; rank: number | null; tags: number }[] = [];
  for (const entry of entries) {
    const reading = entry.readings.find(
      (r) => !r.searchOnly && r.pri.some((tag) => FALLBACK_TAGS.has(tag)),
    );
    if (reading === undefined) continue;
    candidates.push({
      seq: entry.seq,
      kana: reading.text,
      rank: nfRank(reading.pri),
      tags: reading.pri.length,
    });
  }
  candidates.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank || a.seq - b.seq;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return b.tags - a.tags || a.seq - b.seq;
  });
  return candidates.slice(0, cap).map(({ seq, kana }) => ({ seq, kana }));
}
