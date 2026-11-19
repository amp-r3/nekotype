import type { ReportRequest } from '@nekotype/shared/types';

/** One report; `userId` is `null` for a guest. */
export async function insertReport(
  db: D1Database,
  id: string,
  userId: string | null,
  report: ReportRequest,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO content_reports (id, user_id, item_id, content_version, reason, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      report.itemId,
      report.contentVersion,
      report.reason,
      report.comment ?? null,
      now,
    )
    .run();
}
