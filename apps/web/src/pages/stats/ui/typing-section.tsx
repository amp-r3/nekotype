import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { TestResult } from '@nekotype/shared/types';
import { t, tParts } from '@/shared/i18n';
import { Button, Notice, Parts } from '@/shared/ui';
import { defaultClock, navigate } from '@/shared/lib';
import { Pagination } from '@/shared/ui/pagination';
import { Stat } from '@/shared/ui/stat';
import { localDay } from '@/entities/learn';
import { modeLine, readResults, typingCounters, typingRecords } from '@/entities/stats';
import { loadResults } from '../lib/results';
import {
  defaultMode,
  figures,
  modesOf,
  select,
  type Filters,
  type ModeOption,
} from '../lib/selection';
import {
  HISTORY_PAGE_SIZE,
  bestRows,
  historyPages,
  historyRow,
  kpmAxis,
  parseBestKey,
} from '../lib/typing-data';
import { FilterRow } from './filter-row';
import { HistoryTable } from './history-table';
import { ResultChart } from './result-chart';
import { SectionEmpty } from './section-empty';

const MONO = 'text-mono-romaji text-fur font-mono';
const HEADING = 'text-ui-heading text-fur';

function keyLabel(key: string): string {
  const parts = parseBestKey(key);
  return parts === null ? key : modeLine(parts);
}

/** Typing on `/stats`: the filters and what they select, then everything that is not filtered. */
export function TypingSection(): JSX.Element {
  const [results, setResults] = useState<readonly TestResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [page, setPage] = useState(1);

  // A test saved in another tab changes the counter: the whole history is read again (S2).
  const finished = typingCounters.value.finished.typing;
  const records = typingRecords.value;

  useEffect(() => {
    if (finished === 0) return undefined;
    let current = true;
    void loadResults(readResults).then(
      (loaded) => {
        if (!current) return;
        setResults(loaded);
        setFailed(false);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [finished, attempt]);

  const today = localDay(defaultClock.now());
  const loaded = results ?? [];
  const active: Filters = filters ?? { mode: defaultMode(loaded), period: '30', repeats: false };
  const modes: ModeOption[] = useMemo(() => modesOf(loaded, keyLabel), [results]);
  const selection = useMemo(() => select(loaded, active, today), [results, active, today]);
  const shown = useMemo(() => selection.slice().reverse(), [selection]);
  const numbers = figures(selection, active.mode !== 'all');

  const change = (next: Filters): void => {
    setFilters(next);
    setPage(1);
  };

  const bests = bestRows(records, modeLine);
  const pages = historyPages(shown.length);
  const pageRows = shown.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
  const values = selection.map((result) => Math.round(result.kpm));
  const axis = kpmAxis(values);

  const started = typingCounters.value.started.typing;
  if (finished === 0 && started === 0) {
    return (
      <SectionEmpty
        title={t('stats.typing.empty.title')}
        text={t('stats.typing.empty.text')}
        action={t('stats.typing.empty.action')}
        onAction={() => {
          navigate('/type');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      {finished > 0 && (
        <>
          <div className="flex max-w-[760px] flex-col gap-4">
            <FilterRow filters={active} modes={modes} onChange={change} />
            {failed ? (
              <Notice
                tone="miss"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setAttempt(attempt + 1);
                    }}
                  >
                    {t('route.retry')}
                  </Button>
                }
              >
                {t('stats.history.error')}
              </Notice>
            ) : results === null ? (
              <Notice loading>{t('stats.history.loading')}</Notice>
            ) : selection.length === 0 ? (
              <Notice
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      change({ ...active, period: 'all' });
                    }}
                  >
                    {t('stats.showAll')}
                  </Button>
                }
              >
                {t('stats.typing.noSelection')}
              </Notice>
            ) : null}
          </div>

          {results !== null && selection.length > 0 && (
            <>
              <div
                className="grid max-w-[760px] grid-cols-2 gap-6 sm:grid-cols-4"
                data-testid="stats-figures"
              >
                <Stat label={t('stats.figure.tests')} value={numbers.tests} />
                <Stat label={t('stats.figure.medianKpm')} value={numbers.medianKpm ?? '–'} />
                <Stat label={t('stats.figure.bestKpm')} value={numbers.bestKpm ?? '–'} />
                <Stat label={t('stats.figure.accuracy')} value={numbers.accuracy} unit="%" />
              </div>

              <div className="flex max-w-[760px] flex-col gap-4">
                <h2 className={HEADING}>{t('stats.typing.trend')}</h2>
                <ResultChart
                  key={values.length}
                  testId="stats-kpm-chart"
                  height={170}
                  values={values}
                  xLabels={values.map((_, index) => String(index + 1))}
                  domain={axis.domain}
                  ticks={axis.ticks}
                  label={t('stats.typing.trend')}
                  tip={(index, value) =>
                    t('stats.typing.tip', { n: index + 1, kpm: Math.round(value ?? 0) })
                  }
                />
              </div>

              <div className="flex max-w-[760px] flex-col gap-4">
                <h2 className={HEADING}>{t('stats.typing.history')}</h2>
                <HistoryTable
                  rows={pageRows.map((result) => historyRow(result, records))}
                  loading={false}
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
              </div>
            </>
          )}

          <div className="flex max-w-[760px] flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-ui-title text-fur">{t('stats.all.title')}</h2>
              <p className="text-ui-label text-fur-dim">{t('stats.all.caption')}</p>
            </div>
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
        </>
      )}

      <p className="text-ui-label text-fur-dim" data-testid="stats-typing-tests">
        <Parts parts={tParts('stats.typing.tests', { started, finished })} valueClass={MONO} />
      </p>
    </div>
  );
}
