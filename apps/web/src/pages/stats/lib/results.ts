import type { TestResult } from '@nekotype/shared/types';
import type { ReadResults } from './typing-data';

/** Every saved result, oldest first: the store is read newest first in pages until a short one (S2). */
export async function loadResults(read: ReadResults, pageSize = 500): Promise<TestResult[]> {
  const newestFirst: TestResult[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await read(offset, pageSize);
    newestFirst.push(...page);
    if (page.length < pageSize) break;
  }
  return newestFirst.reverse();
}
