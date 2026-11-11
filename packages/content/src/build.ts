import { mkdir, writeFile } from 'node:fs/promises';
import { readJlpt } from './jlpt';
import { parseJmdict } from './jmdict/parse';
import { createTokenizer } from './kuromoji';
import { auditSample, buildPhrases, buildVocabulary, splitPhrases } from './phrases';
import { loadPhraseSources } from './tatoeba/load';
import { loadSources } from './sources';
import { buildWords, russianCoverage, selectFallback } from './words';
import type { WordRow } from './words';

// Temporary entry: PR 4 replaces it with the full build (words, phrases, chunks, manifest).
const CACHE = new URL('../.cache/', import.meta.url);
const OUT = new URL('build/', CACHE);
const PACKAGE = new URL('../', import.meta.url);

async function phraseStep(
  levels: readonly string[],
  files: ReadonlyMap<string, string>,
): Promise<void> {
  const rows = levels.flatMap((id) => {
    const file = files.get(id);
    if (file === undefined) throw new Error(`sources.json has no ${id}`);
    return readJlpt(new URL(file, CACHE).pathname);
  });
  const [tokenize, sources] = await Promise.all([createTokenizer(), loadPhraseSources(CACHE)]);
  const { phrases, report } = buildPhrases(sources, buildVocabulary(rows), tokenize);
  const { items, credits } = splitPhrases(phrases);
  await writeFile(new URL('phrases-report.json', OUT), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(new URL('phrases.json', OUT), `${JSON.stringify(items, null, 2)}\n`);
  await writeFile(new URL('credits.json', OUT), `${JSON.stringify(credits, null, 2)}\n`);
  await writeFile(new URL('audit-sample.md', PACKAGE), auditSample(phrases));
  console.log(`phrases read:     ${report.sentences}`);
  console.log(`excluded:         ${JSON.stringify(report.excluded)}`);
  console.log(`passed 1-8:       ${report.passedFilters}`);
  console.log(`qualifying:       ${report.qualifying}`);
  console.log(`selected:         ${report.selected}`);
  for (const script of ['hiragana', 'katakana', 'mixed'] as const) {
    console.log(`  ${script}: ${items[script].length}`);
  }
  console.log(`compile failures: ${report.compileFailed.length}`);
  for (const f of report.compileFailed) console.log(`  ${f.id} ${f.text}`);
  if (report.compileFailed.length > report.passedFilters * 0.05) {
    throw new Error(
      `phrase compile failures ${report.compileFailed.length} exceed 5% of ${report.passedFilters}`,
    );
  }
}

async function main(): Promise<void> {
  const sources = loadSources();
  const jlpt = sources.sources.filter((s) => s.id.startsWith('jlpt-'));
  const jmdict = new URL('JMdict.gz', CACHE).pathname;
  let rows: WordRow[];
  let entries;
  const levels = ['jlpt-n5', 'jlpt-n4'];
  let source: 'jlpt' | 'fallback';
  if (jlpt.length > 0) {
    source = 'jlpt';
    // N5 first, then N4, file order.
    rows = levels.flatMap((id) => {
      const file = jlpt.find((s) => s.id === id)?.file;
      if (file === undefined) throw new Error(`sources.json has no ${id}`);
      return readJlpt(new URL(file, CACHE).pathname).map(({ seq, kana }) => ({ seq, kana }));
    });
    entries = await parseJmdict(jmdict, new Set(rows.map((r) => r.seq)));
  } else {
    source = 'fallback';
    entries = await parseJmdict(jmdict, null);
    rows = selectFallback(entries.values());
  }
  const { items, report, russian } = buildWords(rows, entries, source);
  const coverage = russianCoverage(russian);
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('words-report.json', OUT), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(new URL('ru-coverage.json', OUT), `${JSON.stringify(coverage, null, 2)}\n`);
  await writeFile(new URL('words.json', OUT), `${JSON.stringify(items, null, 2)}\n`);

  const failed = report.compileFailed.length;
  console.log(`source:           ${source} (${rows.length} rows)`);
  console.log(`selected:         ${report.selected}`);
  console.log(`  hiragana:       ${items.hiragana.length}`);
  console.log(`  katakana:       ${items.katakana.length}`);
  console.log(`excluded:         ${JSON.stringify(report.excluded)}`);
  console.log(`compile failures: ${failed}`);
  for (const f of report.compileFailed) console.log(`  ${f.id}`);
  console.log(`Russian coverage: ${coverage.withRussian}/${coverage.total} (${coverage.percent}%)`);
  if (failed > report.selected * 0.05) {
    throw new Error(`compile failures ${failed} exceed 5% of ${report.selected} selected`);
  }
  if (source === 'jlpt') {
    await phraseStep(levels, new Map(jlpt.map((s) => [s.id, s.file])));
  }
}

await main();
