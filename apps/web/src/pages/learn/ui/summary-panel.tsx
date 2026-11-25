import type { ComponentChildren, JSX } from 'preact';
import type { Track } from '@nekotype/shared/types';
import { t } from '@/shared/i18n';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { isEmptySummary } from '../lib/summary';
import type { ForecastChange, MedianChange, SessionSummary } from '../lib/summary';
import { KanaCell, KanaText } from './kana-buttons';
import { SummaryForecast } from './summary-forecast';

export type SummaryPanelProps = {
  readonly summary: SessionSummary;
  readonly change: ForecastChange;
  readonly track: Track;
  /** Opens the details of a kana. */
  readonly onOpen: (key: LearnKanaKey) => void;
};

function Section({
  title,
  testId,
  children,
}: {
  readonly title: string;
  readonly testId: string;
  readonly children: ComponentChildren;
}): JSX.Element {
  return (
    <section data-testid={testId} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-fur-dim text-ui-caption">{title}</h2>
      {children}
    </section>
  );
}

// The kana of `new` and `learned`: table cells with the state each has now, as on the home.
function Cells({
  keys,
  summary,
  onOpen,
}: {
  readonly keys: readonly LearnKanaKey[];
  readonly summary: SessionSummary;
  readonly onOpen: (key: LearnKanaKey) => void;
}): JSX.Element {
  return (
    <ul className="flex flex-wrap gap-1">
      {keys.map((key) => (
        <li key={key}>
          <KanaCell
            kanaKey={key}
            state={summary.states.get(key) ?? 'learning'}
            testId="summary-cell"
            onOpen={onOpen}
          />
        </li>
      ))}
    </ul>
  );
}

// Median times in a table: the kana, `1720 → 1380 ms` and the difference at the right edge.
function Changes({
  changes,
  onOpen,
}: {
  readonly changes: readonly MedianChange[];
  readonly onOpen: (key: LearnKanaKey) => void;
}): JSX.Element {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {changes.map(({ key, from, to }) => {
          const diff = to - from;
          return (
            <tr key={key}>
              <td className="py-1 pr-4 align-baseline">
                <KanaText kanaKey={key} onOpen={onOpen} />
              </td>
              <td className="py-1 pr-4 align-baseline">
                <span className="text-mono-romaji text-fur font-mono">
                  {`${String(Math.round(from))} → ${String(Math.round(to))}`}
                </span>
                <span className="text-mono-small text-fur-dim font-mono">{` ${t('learn.summary.ms')}`}</span>
              </td>
              <td className="text-fur-dim text-mono-romaji py-1 text-right align-baseline font-mono tabular-nums">
                {`${diff < 0 ? '−' : '+'}${String(Math.abs(Math.round(diff)))}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** What a learning session changed (docs/spec/learning.md, "Session summary"); empty sections are not shown. */
export function SummaryPanel({ summary, change, track, onOpen }: SummaryPanelProps): JSX.Element {
  const confused = summary.mixups.length > 0 || summary.errors.length > 0;
  return (
    <div className="flex w-full max-w-[880px] flex-col gap-8" data-testid="summary">
      <SummaryForecast change={change} track={track} />
      {isEmptySummary(summary) && (
        <p className="text-fur-dim text-ui-body">{t('learn.summary.empty')}</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-12 gap-y-8 max-sm:grid-cols-1 max-sm:gap-6">
        {summary.introduced.length > 0 && (
          <Section title={t('learn.summary.introduced')} testId="summary-introduced">
            <Cells keys={summary.introduced} summary={summary} onOpen={onOpen} />
          </Section>
        )}
        {summary.learned.length > 0 && (
          <Section title={t('learn.summary.learned')} testId="summary-learned">
            <Cells keys={summary.learned} summary={summary} onOpen={onOpen} />
          </Section>
        )}
        {summary.faster.length > 0 && (
          <Section title={t('learn.summary.faster')} testId="summary-faster">
            <Changes changes={summary.faster} onOpen={onOpen} />
          </Section>
        )}
        {summary.slower.length > 0 && (
          <Section title={t('learn.summary.slower')} testId="summary-slower">
            <Changes changes={summary.slower} onOpen={onOpen} />
          </Section>
        )}
        {confused && (
          <Section title={t('learn.summary.confused')} testId="summary-confused">
            {summary.mixups.length > 0 && (
              <ul className="flex flex-col gap-1">
                {summary.mixups.map(({ key, chosen }) => (
                  <li key={`${key}>${chosen}`} className="flex items-baseline gap-2">
                    <KanaText kanaKey={key} onOpen={onOpen} />
                    <span className="text-fur-dim text-mono-romaji font-mono" aria-hidden="true">
                      →
                    </span>
                    <KanaText kanaKey={chosen} onOpen={onOpen} />
                    <span className="text-fur-dim text-ui-caption">
                      {t('learn.summary.pickedInstead')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {summary.errors.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="flex flex-wrap gap-1">
                  {summary.errors.map((key) => (
                    <KanaText key={key} kanaKey={key} onOpen={onOpen} />
                  ))}
                </p>
                <p className="text-fur-dim text-ui-caption">{t('learn.summary.typedWithErrors')}</p>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
