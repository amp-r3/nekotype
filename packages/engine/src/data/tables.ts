import type { EngineTable, KanaRow } from '../types';
import { basicRows } from './basic';
import { dakutenRows } from './dakuten';
import { yoonRows } from './yoon';
import { extendedRows } from './extended';
import { standaloneRows } from './standalone';

export const allKanaRows: readonly KanaRow[] = [
  ...basicRows,
  ...dakutenRows,
  ...yoonRows,
  ...extendedRows,
];

// The table the engine is created with: selectable rows plus the standalone kana.
export const engineTable: EngineTable = [...allKanaRows, ...standaloneRows];
