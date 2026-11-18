import { isObject } from '@nekotype/shared/runtime';

// A D1 row is `unknown` until a guard has looked at it (D1: no `first<T>()`, which is an assertion).

export type Row = Record<string, unknown>;

export function isRow(value: unknown): value is Row {
  return isObject(value);
}

export function textOf(row: Row, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

export function numberOf(row: Row, column: string): number | null {
  const value = row[column];
  return typeof value === 'number' ? value : null;
}

/** A column the schema declares `NOT NULL` and that holds something else: the row is corrupt. */
export function corrupt(table: string, column: string): Error {
  return new Error(`${table}.${column} has an unexpected value`);
}
