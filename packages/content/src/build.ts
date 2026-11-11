import { mkdir, writeFile } from 'node:fs/promises';
import { readJlpt } from './jlpt';
import { parseJmdict } from './jmdict/parse';
import { loadSources } from './sources';
import { buildWords, russianCoverage, selectFallback } from './words';
import type { WordRow } from './words';

// Temporary entry: PR 4 replaces it with the full build (words, phrases, chunks, manifest).
const CACHE = new URL('../.cache/', import.meta.url);
const OUT = new URL('build/', CACHE);

async function main(): Promise<void> {
  const sources = loadSources();
  const jlpt = sources.sources.filter((s) => s.id.startsWith('jlpt-'));
  const jmdict = new URL('JMdict.gz', CACHE).pathname;
  let rows: WordRow[];
  let entries;
  let source: 'jlpt' | 'fallback';
  if (jlpt.length > 0) {
    source = 'jlpt';
    // N5 first, then N4, file order.
    const levels = ['jlpt-n5', 'jlpt-n4'];
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
}

await main();
