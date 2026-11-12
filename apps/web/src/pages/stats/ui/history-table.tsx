import type { JSX } from 'preact';
import { locale, t } from '@/shared/i18n';
import { Notice } from '@/shared/ui';
import { PersonalBestBadge } from '@/shared/ui/personal-best-badge';
import { modeLabel } from '@/entities/stats';
import type { HistoryRow } from '../lib/typing-data';

export type HistoryTableProps = {
  readonly rows: readonly HistoryRow[];
  // Another page is being read: a static line under the table, no skeleton.
  readonly loading: boolean;
};

const TH = 'pr-3 pb-2 text-left font-normal';
const TD = 'border-line border-t py-2 pr-3 align-baseline';
const NUM = 'text-right tabular-nums';

function modeText(row: HistoryRow): string {
  return t(row.repeated ? 'stats.history.modeRepeat' : 'stats.history.modeValue', {
    content: t(`mode.content.${row.content}`),
    mode: modeLabel(row.config),
  });
}

/** One page of the typing test history (design HistoryTable); the narrow layout is in `.nk-hist`. */
export function HistoryTable({ rows, loading }: HistoryTableProps): JSX.Element {
  const date = new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="nk-hist flex flex-col gap-4" data-testid="stats-history">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-ui-caption text-fur-dim">
            <th className={TH}>{t('stats.history.date')}</th>
            <th className={TH}>{t('stats.history.mode')}</th>
            <th className={`${TH} ${NUM}`}>{t('stats.history.kpm')}</th>
            <th className={`${TH} ${NUM}`}>{t('stats.history.accuracy')}</th>
            <th className={`${TH} ${NUM}`}>{t('stats.history.time')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="history-row">
              <td className={`${TD} text-mono-small text-fur-dim font-mono`}>
                {date.format(row.endedAt)}
              </td>
              <td className={`${TD} text-ui-label text-fur`}>
                {modeText(row)}
                {row.best && (
                  <span className="ml-2">
                    <PersonalBestBadge />
                  </span>
                )}
              </td>
              <td className={`${TD} ${NUM} text-mono-romaji text-fur font-mono`}>{row.kpm}</td>
              <td className={`${TD} ${NUM} text-mono-romaji text-fur font-mono`}>
                {row.accuracy}%
              </td>
              <td className={`${TD} ${NUM} text-mono-romaji text-fur-dim font-mono`}>
                {t('stats.history.seconds', { n: row.seconds })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <Notice loading>{t('stats.history.loading')}</Notice>}
    </div>
  );
}
