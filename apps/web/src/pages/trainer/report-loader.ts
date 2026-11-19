import type { ReportDialog } from './ui/report-dialog';

/** The report dialog is a chunk of its own: it loads when someone asks to report (D21). */
export function loadReportDialog(): Promise<typeof ReportDialog | null> {
  return import('./ui/report-dialog').then(
    (module) => module.ReportDialog,
    () => null,
  );
}
