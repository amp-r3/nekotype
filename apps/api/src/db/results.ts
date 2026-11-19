import type { TestResult } from '@nekotype/shared/types';
import { isTestResult } from '@nekotype/shared/runtime';
import { corrupt, isRow, textOf } from './rows';

/** The position of a result in the history: the cursor of `GET /api/results` is `<endedAt>:<id>`. */
export type ResultsCursor = { readonly endedAt: number; readonly id: string };

export type ResultsPage = {
  readonly results: TestResult[];
  /** The results after the last one of the page exist. */
  readonly more: boolean;
};

/**
 * Up to `limit` results of the user older than `before` (newest first, ties by id, descending),
 * and whether any more follow. One statement reading at most `limit + 1` rows through
 * `results_user_time`. The range keeps the index usable: `ended_at <= ?` first, then the tie rule.
 */
export async function readResults(
  db: D1Database,
  userId: string,
  before: ResultsCursor | null,
  limit: number,
): Promise<ResultsPage> {
  const columns = 'SELECT id, ended_at, json FROM results WHERE user_id = ?1';
  const order = 'ORDER BY ended_at DESC, id DESC';
  const statement =
    before === null
      ? db.prepare(`${columns} ${order} LIMIT ?2`).bind(userId, limit + 1)
      : db
          .prepare(`${columns} AND ended_at <= ?2 AND (ended_at < ?2 OR id < ?3) ${order} LIMIT ?4`)
          .bind(userId, before.endedAt, before.id, limit + 1);
  const { results: rows } = await statement.all();

  const page: TestResult[] = [];
  for (const row of rows.slice(0, limit)) {
    const text = isRow(row) ? textOf(row, 'json') : null;
    if (text === null) throw corrupt('results', 'json');
    const value: unknown = JSON.parse(text);
    if (!isTestResult(value)) throw corrupt('results', 'json');
    page.push(value);
  }
  return { results: page, more: rows.length > limit };
}

/** The cursor of a result, as the client sends it back. */
export function cursorOf(result: Pick<TestResult, 'endedAt' | 'id'>): string {
  return `${result.endedAt}:${result.id}`;
}

/** `<endedAt>:<id>`; null for anything else. The id may itself contain colons. */
export function parseCursor(text: string): ResultsCursor | null {
  const match = /^(\d{1,16}(?:\.\d{1,6})?):(.+)$/.exec(text);
  const endedAt = Number(match?.[1]);
  const id = match?.[2];
  return id !== undefined && Number.isFinite(endedAt) ? { endedAt, id } : null;
}
