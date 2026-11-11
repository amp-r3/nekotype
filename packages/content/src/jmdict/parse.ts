import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import sax from 'sax';

export interface JmdictReading {
  text: string;
  /** `re_inf` is `sk`: the reading is used for searching only. */
  searchOnly: boolean;
  /** `re_restr`: the kanji spellings the reading applies to. */
  restr?: string[];
  pri: string[];
}

export interface JmdictKanji {
  text: string;
  pri: string[];
}

export interface JmdictSense {
  /** `stagr`: the readings the sense applies to. */
  stagr?: string[];
  glossEn: string[];
  glossRu: string[];
}

export interface JmdictEntry {
  seq: number;
  readings: JmdictReading[];
  kanji: JmdictKanji[];
  senses: JmdictSense[];
}

const ENTITY = /<!ENTITY\s+([^\s>]+)\s/g;

/**
 * Entity names declared in the internal DTD subset. JMdict writes tags as entities
 * (`<re_inf>&sk;</re_inf>`); each one is read as its own name (`sk`).
 */
export function entityNames(doctype: string): string[] {
  return Array.from(doctype.matchAll(ENTITY), (match) => match[1] ?? '').filter((n) => n !== '');
}

interface Draft {
  seq: number;
  readings: JmdictReading[];
  kanji: JmdictKanji[];
  senses: JmdictSense[];
}

/**
 * Streams the entries of a JMdict XML file (`.gz` or plain). `wanted` limits the entries kept in
 * memory to the given sequence numbers; `null` keeps all of them.
 */
export async function parseJmdict(
  path: string,
  wanted: ReadonlySet<number> | null,
): Promise<Map<number, JmdictEntry>> {
  const entries = new Map<number, JmdictEntry>();
  const parser = sax.createStream(true, { trim: false });
  const inner = parser._parser;
  let doctype = '';
  const names: string[] = [];
  let draft: Draft | null = null;
  let reading: JmdictReading | null = null;
  let kanji: JmdictKanji | null = null;
  let sense: JmdictSense | null = null;
  let glossLang = '';
  let text = '';

  inner.ondoctype = (value: string) => {
    doctype += value;
    for (const name of entityNames(value)) {
      names.push(name);
      inner.ENTITIES[name] = name;
    }
  };
  parser.on('opentag', (tag) => {
    text = '';
    switch (tag.name) {
      case 'entry':
        draft = { seq: 0, readings: [], kanji: [], senses: [] };
        break;
      case 'r_ele':
        reading = { text: '', searchOnly: false, pri: [] };
        break;
      case 'k_ele':
        kanji = { text: '', pri: [] };
        break;
      case 'sense':
        sense = { glossEn: [], glossRu: [] };
        break;
      case 'gloss': {
        const lang = tag.attributes['xml:lang'];
        glossLang = typeof lang === 'string' ? lang : 'eng';
        break;
      }
    }
  });
  parser.on('text', (value) => {
    text += value;
  });
  parser.on('closetag', (name) => {
    if (draft === null) return;
    switch (name) {
      case 'ent_seq':
        draft.seq = Number(text);
        break;
      case 'reb':
        if (reading !== null) reading.text = text;
        break;
      case 're_inf':
        if (reading !== null && text === 'sk') reading.searchOnly = true;
        break;
      case 're_restr':
        if (reading !== null) (reading.restr ??= []).push(text);
        break;
      case 're_pri':
        if (reading !== null) reading.pri.push(text);
        break;
      case 'keb':
        if (kanji !== null) kanji.text = text;
        break;
      case 'ke_pri':
        if (kanji !== null) kanji.pri.push(text);
        break;
      case 'stagr':
        if (sense !== null) (sense.stagr ??= []).push(text);
        break;
      case 'gloss':
        if (sense !== null) {
          if (glossLang === 'eng') sense.glossEn.push(text);
          else if (glossLang === 'rus') sense.glossRu.push(text);
        }
        break;
      case 'r_ele':
        if (reading !== null) draft.readings.push(reading);
        reading = null;
        break;
      case 'k_ele':
        if (kanji !== null) draft.kanji.push(kanji);
        kanji = null;
        break;
      case 'sense':
        if (sense !== null) draft.senses.push(sense);
        sense = null;
        break;
      case 'entry':
        if (wanted === null || wanted.has(draft.seq)) entries.set(draft.seq, draft);
        draft = null;
        break;
    }
    text = '';
  });
  const source = createReadStream(path);
  const input = path.endsWith('.gz') ? source.pipe(createGunzip()) : source;
  source.on('error', (error) => input.destroy(error));
  await new Promise<void>((resolve, reject) => {
    input.on('error', reject);
    parser.on('end', resolve);
    parser.on('error', reject);
    input.pipe(parser);
  });
  if (doctype === '' || names.length === 0) throw new Error(`${path}: no entity declarations`);
  return entries;
}
