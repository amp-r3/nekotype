import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { readJlpt } from './jlpt';
import { parseJmdict } from './jmdict/parse';
import { createTokenizer } from './kuromoji';
import {
  buildManifest,
  checkChunkSizes,
  checkCompileFailures,
  chunkCounts,
  chunkSizes,
  serialize,
  serializeChunks,
  sha256,
} from './output';
import { auditSample, buildPhrases, buildVocabulary, splitPhrases } from './phrases';
import { loadPhraseSources } from './tatoeba/load';
import { loadSources } from './sources';
import { buildWords, russianCoverage } from './words';
import type { WordRow } from './words';

// The full build: pinned sources (verified by `fetch`) -> words and phrases -> chunks, credits,
// manifest and reports. Run by hand, never in CI (it needs .cache/).
const CACHE = new URL('../.cache/', import.meta.url);
const PACKAGE = new URL('../', import.meta.url);
const CONTENT = new URL('../../../apps/web/src/entities/prompt/content/', import.meta.url);

const LEVELS = ['jlpt-n5', 'jlpt-n4'] as const;

async function main(): Promise<void> {
  const sources = loadSources();
  const jlpt = sources.sources.filter((s) => s.id.startsWith('jlpt-'));
  if (jlpt.length === 0) throw new Error('sources.json has no JLPT lists');
  const files = new Map(jlpt.map((s) => [s.id, s.file]));
  // N5 first, then N4, file order.
  const jlptRows = LEVELS.flatMap((id) => {
    const file = files.get(id);
    if (file === undefined) throw new Error(`sources.json has no ${id}`);
    return readJlpt(new URL(file, CACHE).pathname);
  });

  const rows: WordRow[] = jlptRows.map(({ seq, kana }) => ({ seq, kana }));
  const entries = await parseJmdict(
    new URL('JMdict.gz', CACHE).pathname,
    new Set(rows.map((r) => r.seq)),
  );
  const words = buildWords(rows, entries, 'jlpt');
  const coverage = russianCoverage(words.russian);

  const [tokenize, phraseSources] = await Promise.all([
    createTokenizer(),
    loadPhraseSources(CACHE),
  ]);
  const built = buildPhrases(phraseSources, buildVocabulary(jlptRows), tokenize);
  const { items: phraseItems, credits } = splitPhrases(built.phrases);

  checkCompileFailures('words', words.report.compileFailed.length, words.report.selected);
  checkCompileFailures('phrases', built.report.compileFailed.length, built.report.passedFilters);

  const input = { words: words.items, phrases: phraseItems, credits };
  const chunks = serializeChunks(input);
  // Determinism: a second serialisation of the same data must hash to the same bytes.
  const again = serializeChunks(input);
  for (const [name, text] of chunks) {
    if (sha256(text) !== sha256(again.get(name) ?? '')) {
      throw new Error(`${name} is not deterministic`);
    }
  }
  const sizes = chunkSizes(chunks);
  checkChunkSizes(sizes);

  const counts = chunkCounts(input);
  const manifest = buildManifest(
    readFileSync(new URL('sources.json', PACKAGE), 'utf8'),
    chunks,
    counts,
  );

  await mkdir(CONTENT, { recursive: true });
  for (const [name, text] of chunks) await writeFile(new URL(name, CONTENT), text);
  await writeFile(new URL('manifest.json', CONTENT), serialize(manifest));
  await writeFile(
    new URL('build-report.json', PACKAGE),
    serialize({
      contentVersion: manifest.contentVersion,
      counts,
      sizes,
      words: words.report,
      phrases: built.report,
    }),
  );
  await writeFile(new URL('ru-coverage.json', PACKAGE), serialize(coverage));
  await writeFile(new URL('audit-sample.md', PACKAGE), auditSample(built.phrases));

  console.log(`contentVersion:   ${manifest.contentVersion}`);
  for (const [name, size] of Object.entries(sizes)) {
    const n = counts[name.replace(/\.json$/, '')] ?? 0;
    console.log(
      `${name.padEnd(24)} ${String(n).padStart(4)} items  ${size.raw} B  ${size.gzip} B gzip`,
    );
  }
  console.log(`words excluded:   ${JSON.stringify(words.report.excluded)}`);
  console.log(`phrases excluded: ${JSON.stringify(built.report.excluded)}`);
  console.log(
    `compile failures: words ${words.report.compileFailed.length}, phrases ${built.report.compileFailed.length}`,
  );
  console.log(`Russian coverage: ${coverage.withRussian}/${coverage.total} (${coverage.percent}%)`);
}

await main();
