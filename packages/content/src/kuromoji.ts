import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import kuromoji from 'kuromoji';
import type { IpadicFeatures } from 'kuromoji';

/** The fields of an IPADIC token the pipeline reads. */
export interface MorphToken {
  surface: string;
  /** `基本形`; `*` when the token has none. */
  basicForm: string;
  pos: string;
  posDetail1: string;
  /** Katakana reading (は = ハ), never the pronunciation; `null` when the dictionary has none. */
  reading: string | null;
}

export type Tokenizer = (text: string) => MorphToken[];

function narrow(token: IpadicFeatures): MorphToken {
  const reading = token.reading;
  return {
    surface: token.surface_form,
    basicForm: token.basic_form,
    pos: token.pos,
    posDetail1: token.pos_detail_1,
    reading: reading === undefined || reading === '*' ? null : reading,
  };
}

/** The IPADIC dictionary shipped in the kuromoji package. */
function dictionaryPath(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('kuromoji/package.json')), 'dict');
}

/** Loads the dictionary once (slow: build it once per process or test file). */
export function createTokenizer(): Promise<Tokenizer> {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: dictionaryPath() }).build((error, tokenizer) => {
      if (error instanceof Error) reject(error);
      else resolve((text) => tokenizer.tokenize(text).map(narrow));
    });
  });
}
