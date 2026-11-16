// The part of the D1 API the measurement uses; the application's own types come with PR 2.

export type D1Meta = {
  readonly duration: number;
  readonly rows_read: number;
  readonly rows_written: number;
  readonly changes: number;
};

export type D1Result<T> = {
  readonly results: readonly T[];
  readonly success: boolean;
  readonly meta: D1Meta;
};

export interface D1PreparedStatement {
  bind(...values: readonly (string | number | null)[]): D1PreparedStatement;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T>(statements: readonly D1PreparedStatement[]): Promise<readonly D1Result<T>[]>;
}

export type Env = { readonly DB: D1Database };
