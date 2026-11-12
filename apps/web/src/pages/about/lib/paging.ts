import type { PhraseCredit } from '@/entities/prompt';

/** Rows of the phrase credits list on one page, at every width (ADR 066). */
export const PAGE_SIZE = 25;

/** The list in ascending sentence id, the order a reader looks an id up in. */
export function sortCredits(credits: readonly PhraseCredit[]): readonly PhraseCredit[] {
  return [...credits].sort((a, b) => a.sentence.id - b.sentence.id);
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** A page number held inside `1..pages`. */
export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, Math.trunc(page)), pageCount(total));
}

export type PageSlice<T> = {
  readonly page: number;
  readonly rows: readonly T[];
  // 1-based, inclusive; both 0 for an empty list.
  readonly from: number;
  readonly to: number;
};

export function slicePage<T>(rows: readonly T[], page: number): PageSlice<T> {
  const current = clampPage(page, rows.length);
  const start = (current - 1) * PAGE_SIZE;
  const part = rows.slice(start, start + PAGE_SIZE);
  return {
    page: current,
    rows: part,
    from: part.length === 0 ? 0 : start + 1,
    to: start + part.length,
  };
}
