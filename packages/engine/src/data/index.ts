import type { EngineTable, KanaRow } from '../types';
import { basicRows } from './basic';
import { dakutenRows } from './dakuten';
import { yoonRows } from './yoon';
import { extendedRows } from './extended';
import { standaloneRows } from './standalone';

export { basicRows } from './basic';
export { dakutenRows } from './dakuten';
export { yoonRows } from './yoon';
export { extendedRows } from './extended';
export { standaloneRows } from './standalone';
export { kanaOf, kanaRows } from './tracks';
export type { TrackRow } from './tracks';
export { similarKana, similarPairs } from './similar';
export { SKIP_CHARACTERS, SOKUON_PREFIXES } from './tokens';

export const allKanaRows: readonly KanaRow[] = [
  ...basicRows,
  ...dakutenRows,
  ...yoonRows,
  ...extendedRows,
];

// The table the engine is created with: selectable rows plus the standalone kana.
export const engineTable: EngineTable = [...allKanaRows, ...standaloneRows];
