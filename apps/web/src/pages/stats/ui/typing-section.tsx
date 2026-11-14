import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { TestResult } from '@nekotype/shared/types';
import { locale, t, tParts } from '@/shared/i18n';
import { Button, Notice, Parts } from '@/shared/ui';
import { defaultClock, navigate } from '@/shared/lib';
import { Pagination } from '@/shared/ui/pagination';
import { Stat } from '@/shared/ui/stat';
import { localDay } from '@/entities/learn';
import { modeLabel, modeLine, readResults, typingCounters, typingRecords } from '@/entities/stats';
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
  parseBestKey,
} from '../lib/typing-data';
import { kpmAxis, timeAxis, trendPoints } from '../lib/trend';
import { FilterRow } from './filter-row';
import { HistoryTable } from './history-table';
import { ChartLegend } from './chart-legend';
import { SectionEmpty } from './section-empty';
import { StatsChart } from './stats-chart';

const MONO = 'text-mono-romaji text-fur font-mono';
const HEADING = 'text-ui-heading text-fur';

const NARROW = '(max-width: 639px)';

function useNarrow(): boolean {
  const query = (): boolean => typeof matchMedia === 'function' && matchMedia(NARROW).matches;
  const [narrow, setNarrow] = useState(query);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const list = matchMedia(NARROW);
    const update = (): void => {
      setNarrow(list.matches);
    };
    list.addEventListener('change', update);
    return () => {
      list.removeEventListener('change', update);
    };
  }, []);
  return narrow;
}

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
  const narrow = useNarrow();
  const dateFormat = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' });
  const timeFormat = new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' });
  const points = trendPoints(selection, records, (result, mark) => {
    const rejected =
      result.keystrokes === 0
        ? 0
        : Math.round((100 * result.rejectedKeystrokes) / result.keystrokes);
    return [
      t('stats.tip.test', {
        date: dateFormat.format(result.endedAt),
        time: timeFormat.format(result.endedAt),
        mode: t('stats.history.modeValue', {
          content: t(`mode.content.${result.content}`),
          mode: modeLabel(result.config),
        }),
      }),
      t('stats.tip.values', {
        kpm: Math.round(result.kpm),
        accuracy: Math.round(result.kanaAccuracy * 100),
      }),
      t('stats.tip.keys', { rejected, hints: result.assisted }),
      ...(mark === 'best'
        ? [t('stats.tip.best')]
        : mark === 'hollow'
          ? [t('stats.tip.repeat')]
          : []),
    ];
  });
  const yAxis = kpmAxis(points.map((point) => point.y));
  const firstAt = selection[0]?.endedAt ?? defaultClock.now();
  const xAxis = timeAxis(active.period, firstAt, today, narrow, (ms) => dateFormat.format(ms));

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
                <ChartLegend points={points} />
                <StatsChart
                  testId="stats-kpm-chart"
                  height={narrow ? 200 : 240}
                  points={points}
                  xDomain={xAxis.domain}
                  xTicks={xAxis.ticks}
                  yDomain={yAxis.domain}
                  yTicks={yAxis.ticks}
                  label={t('stats.typing.chartLabel')}
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
