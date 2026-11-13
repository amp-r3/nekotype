import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { TestResult } from '@nekotype/shared/types';
import { t } from '@/shared/i18n';
import { Notice } from '@/shared/ui';
import { Pagination } from '@/shared/ui/pagination';
import {
  countResults,
  modeLine,
  readResults,
  typingCounters,
  typingRecords,
} from '@/entities/stats';
import {
  HISTORY_PAGE_SIZE,
  bestRows,
  historyPages,
  historyRow,
  kpmAxis,
  kpmSeries,
} from '../lib/typing-data';
import { HistoryTable } from './history-table';
import { ResultChart } from './result-chart';

const MONO = 'text-mono-romaji text-fur font-mono';
const HEADING = 'text-ui-label text-fur';

type History = {
  readonly results: readonly TestResult[];
  readonly count: number;
};

/** Typing on `/stats`: personal bests, KPM per test and the history of saved tests. */
export function TypingSection(): JSX.Element {
  const [page, setPage] = useState(1);
  const [series, setSeries] = useState<readonly number[]>([]);
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // A test saved in another tab changes the counter: the chart and the page are read again.
  const finished = typingCounters.value.finished.typing;
  const records = typingRecords.value;

  useEffect(() => {
    if (finished === 0) return undefined;
    let current = true;
    void kpmSeries(readResults).then(
      (values) => {
        if (current) setSeries(values);
      },
      () => {
        // The history below reports the failed read.
      },
    );
    return () => {
      current = false;
    };
  }, [finished]);

  useEffect(() => {
    if (finished === 0) return undefined;
    let current = true;
    setLoading(true);
    void Promise.all([
      readResults((page - 1) * HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE),
      countResults(),
    ])
      .then(
        ([results, count]) => {
          if (!current) return;
          setHistory({ results, count });
          setFailed(false);
        },
        () => {
          if (current) setFailed(true);
        },
      )
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [finished, page]);

  const bests = bestRows(records, modeLine);
  const axis = kpmAxis(series);
  const pages = historyPages(history?.count ?? 0);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="stats-typing">
      <h2 id="stats-typing" className="text-ui-heading text-fur">
        {t('stats.typing.title')}
      </h2>

      {finished === 0 ? (
        <p className="text-fur-dim text-ui-body" data-testid="stats-typing-empty">
          {t('stats.typing.noData')}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex max-w-[760px] flex-col gap-4">
            <h3 className={HEADING}>{t('stats.typing.bests')}</h3>
            {bests.length === 0 ? (
              <p className="text-fur-dim text-ui-body">{t('stats.typing.noBests')}</p>
            ) : (
              <table className="w-full border-collapse" data-testid="stats-bests">
                <tbody>
                  {bests.map((row) => (
                    <tr key={row.key}>
                      <td className="text-ui-label text-fur border-line border-t py-2 pr-3">
                        {row.label}
                      </td>
                      <td className="border-line border-t py-2 text-right whitespace-nowrap">
                        <span className={`${MONO} tabular-nums`}>{row.kpm}</span>
                        <span className="text-fur-dim text-mono-small font-mono">
                          {` ${t('stats.history.kpm')}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {series.length > 0 && (
            <div className="flex max-w-[760px] flex-col gap-4">
              <h3 className={HEADING}>{t('stats.typing.chart')}</h3>
              <ResultChart
                key={series.length}
                testId="stats-kpm-chart"
                height={170}
                values={series}
                xLabels={series.map((_, index) => String(index + 1))}
                domain={axis.domain}
                ticks={axis.ticks}
                label={t('stats.typing.chart')}
                tip={(index, value) =>
                  t('stats.typing.tip', { n: index + 1, kpm: Math.round(value ?? 0) })
                }
              />
            </div>
          )}

          <div className="flex max-w-[760px] flex-col gap-4">
            <h3 className={HEADING}>{t('stats.typing.history')}</h3>
            {failed && <Notice tone="miss">{t('stats.history.error')}</Notice>}
            {history !== null && (
              <>
                <HistoryTable
                  rows={history.results.map((result) => historyRow(result, records))}
                  loading={loading}
                />
                {pages > 1 && (
                  <Pagination
                    page={page}
                    pages={pages}
                    onPage={setPage}
                    labels={{
                      prev: t('stats.history.newer'),
                      next: t('stats.history.older'),
                      label: t('stats.history.pages'),
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
