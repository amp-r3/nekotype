import type { ComponentChildren, JSX } from 'preact';
import { t } from '@/shared/i18n';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { isEmptySummary } from '../lib/summary';
import type { MedianChange, SessionSummary } from '../lib/summary';

export type SummaryPanelProps = {
  readonly summary: SessionSummary;
};

const kana = (key: LearnKanaKey): string => key.slice(key.indexOf(':') + 1);

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

function Kana({ keys }: { readonly keys: readonly LearnKanaKey[] }): JSX.Element {
  return (
    <p className="font-jp text-jp-cell text-fur flex flex-wrap gap-4" lang="ja">
      {keys.map((key) => (
        <span key={key}>{kana(key)}</span>
      ))}
    </p>
  );
}

// Median times in a table: the kana, `1720 → 1380 ms` and the difference at the right edge.
function Changes({ changes }: { readonly changes: readonly MedianChange[] }): JSX.Element {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {changes.map(({ key, from, to }) => {
          const diff = to - from;
          return (
            <tr key={key}>
              <td className="font-jp text-jp-body text-fur py-1 pr-4 align-baseline" lang="ja">
                {kana(key)}
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
export function SummaryPanel({ summary }: SummaryPanelProps): JSX.Element {
  const confused = summary.mixups.length > 0 || summary.errors.length > 0;
  return (
    <div className="flex w-full max-w-[880px] flex-col gap-8" data-testid="summary">
      <h1 className="text-ui-heading text-fur">{t('learn.summary.title')}</h1>
      {isEmptySummary(summary) && (
        <p className="text-fur-dim text-ui-body">{t('learn.summary.empty')}</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-12 max-sm:grid-cols-1">
        {summary.unlocked.length > 0 && (
          <Section title={t('learn.summary.unlocked')} testId="summary-unlocked">
            <Kana keys={summary.unlocked} />
          </Section>
        )}
        {summary.confident.length > 0 && (
          <Section title={t('learn.summary.confident')} testId="summary-confident">
            <Kana keys={summary.confident} />
          </Section>
        )}
        {summary.faster.length > 0 && (
          <Section title={t('learn.summary.faster')} testId="summary-faster">
            <Changes changes={summary.faster} />
          </Section>
        )}
        {summary.slower.length > 0 && (
          <Section title={t('learn.summary.slower')} testId="summary-slower">
            <Changes changes={summary.slower} />
          </Section>
        )}
        {confused && (
          <Section title={t('learn.summary.confused')} testId="summary-confused">
            {summary.mixups.length > 0 && (
              <ul className="flex flex-col gap-1">
                {summary.mixups.map(({ key, chosen }) => (
                  <li key={`${key}>${chosen}`} className="flex items-baseline gap-2">
                    <span className="font-jp text-jp-body text-fur" lang="ja">
                      {kana(key)}
                    </span>
                    <span className="text-fur-dim text-mono-romaji font-mono" aria-hidden="true">
                      →
                    </span>
                    <span className="font-jp text-jp-body text-fur" lang="ja">
                      {kana(chosen)}
                    </span>
                    <span className="text-fur-dim text-ui-caption">
                      {t('learn.summary.pickedInstead')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {summary.errors.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Kana keys={summary.errors} />
                <p className="text-fur-dim text-ui-caption">{t('learn.summary.typedWithErrors')}</p>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
