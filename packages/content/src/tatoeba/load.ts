import { nullable, readTsv } from './tsv';
import type { PhraseSources, Sentence } from '../phrases';

/** Tatoeba writes unset dates as `\N` or zeros; only the id, text and username matter here. */
async function readSentences(path: string, lang: string): Promise<Map<number, Sentence>> {
  const sentences = new Map<number, Sentence>();
  for await (const [id, language, text, username] of readTsv(path)) {
    if (language !== lang || text === undefined) continue;
    sentences.set(Number(id), { text, author: nullable(username) });
  }
  return sentences;
}

/**
 * Streams the pinned Tatoeba exports from `dir` into the indexes the phrase step reads. Only the
 * English sentences linked from a Japanese one are kept, and a transcription by a contributor wins
 * over a machine one (content.md, "Phrases" step 2).
 */
export async function loadPhraseSources(dir: URL): Promise<PhraseSources> {
  const at = (file: string): string => new URL(file, dir).pathname;
  const japanese = await readSentences(at('jpn_sentences_detailed.tsv.bz2'), 'jpn');

  const links = new Map<number, number[]>();
  const wanted = new Set<number>();
  for await (const [jpn, eng] of readTsv(at('jpn-eng_links.tsv.bz2'))) {
    const jpnId = Number(jpn);
    const engId = Number(eng);
    if (!japanese.has(jpnId)) continue;
    const list = links.get(jpnId) ?? [];
    list.push(engId);
    links.set(jpnId, list);
    wanted.add(engId);
  }

  const english = new Map<number, Sentence>();
  for await (const [id, language, text, username] of readTsv(
    at('eng_sentences_detailed.tsv.bz2'),
  )) {
    const engId = Number(id);
    if (language === 'eng' && text !== undefined && wanted.has(engId)) {
      english.set(engId, { text, author: nullable(username) });
    }
  }

  const transcriptions = new Map<number, Sentence>();
  for await (const [id, lang, , username, text] of readTsv(at('jpn_transcriptions.tsv.bz2'))) {
    if (lang !== 'jpn' || text === undefined) continue;
    const jpnId = Number(id);
    const author = nullable(username);
    const current = transcriptions.get(jpnId);
    if (current === undefined || (current.author === null && author !== null)) {
      transcriptions.set(jpnId, { text, author });
    }
  }

  const negative = new Set<number>();
  for await (const [, id, rating] of readTsv(at('users_sentences.csv.gz'))) {
    if (rating === '-1') negative.add(Number(id));
  }
  return { japanese, english, links, transcriptions, negative };
}
