import { MASTERED_STABILITY_DAYS } from '@nekotype/model';
import type { KanaView } from '@nekotype/model';
import { locale, t, tPlural } from '@/shared/i18n';

/** A run of a value: a kana is drawn in `jp-body`, the rest as text. */
export type DetailsRun = { readonly text: string; readonly kana?: true };

export type DetailsRow = {
  readonly id: 'state' | 'memory' | 'recall' | 'mixups' | 'recognition';
  readonly caption: string;
  readonly value: readonly DetailsRun[];
  /** The memory row only: the stability against the 21 days of mastery, 0 to 1. */
  readonly fill?: number;
};

const SEPARATOR = ' · ';

const percent = (value: number): number => Math.round(value * 100);

function dateOf(timestamp: number): string {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(
    timestamp,
  );
}

const text = (value: string): readonly DetailsRun[] => [{ text: value }];

function stateRow(view: KanaView, now: number): DetailsRow {
  const parts = [t(`learn.chart.state.${view.state}`)];
  if (view.state === 'learned' || view.state === 'mastered') {
    if (view.dueFrom !== null && view.dueFrom <= now) parts.push(t('details.due'));
    else if (view.nextReviewAt !== null) {
      parts.push(t('details.nextReview', { date: dateOf(view.nextReviewAt) }));
    }
  }
  return { id: 'state', caption: t('details.row.state'), value: text(parts.join(SEPARATOR)) };
}

function memoryRow(view: KanaView): DetailsRow {
  const stability = view.stability ?? 0;
  const parts =
    stability < 1 ? [t('details.holdsLess')] : [tPlural('details.holds', Math.round(stability))];
  if (view.state !== 'mastered') {
    parts.push(t('details.masteredFrom', { days: MASTERED_STABILITY_DAYS }));
  }
  return {
    id: 'memory',
    caption: t('details.row.memory'),
    value: text(parts.join(SEPARATOR)),
    fill: Math.min(1, stability / MASTERED_STABILITY_DAYS),
  };
}

function recallRow(view: KanaView): DetailsRow {
  const caption = t('details.row.recall');
  if (view.recall.length === 0)
    return { id: 'recall', caption, value: text(t('details.noRecall')) };
  const parts = [
    t('details.stats', { ms: Math.round(view.medianMs), accuracy: percent(view.accuracy) }),
  ];
  if (view.recall.length < 10) parts.push(t('details.answers', { n: view.recall.length }));
  return { id: 'recall', caption, value: text(parts.join(SEPARATOR)) };
}

function mixupsRow(view: KanaView): DetailsRow {
  const caption = t('details.row.mixups');
  if (view.confusions.length === 0)
    return { id: 'mixups', caption, value: text(t('details.none')) };
  const value = view.confusions.flatMap((mixup, at): DetailsRun[] => [
    ...(at > 0 ? [{ text: ', ' }] : []),
    { text: mixup.key.slice(mixup.key.indexOf(':') + 1), kana: true },
    { text: ` ×${mixup.count}` },
  ]);
  return { id: 'mixups', caption, value };
}

function recognitionRow(view: KanaView): DetailsRow {
  const caption = t('details.row.recognition');
  if (view.recognitions === 0) {
    return { id: 'recognition', caption, value: text(t('details.noRecognition')) };
  }
  const ok = view.recognitions - view.recognitionErrors;
  return {
    id: 'recognition',
    caption,
    value: text(
      t('details.recognition', {
        accuracy: percent(ok / view.recognitions),
        ok,
        total: view.recognitions,
      }),
    ),
  };
}

/** The rows of the details of an introduced kana (design decision 147); `now` decides "due". */
export function detailsRows(view: KanaView, now: number): readonly DetailsRow[] {
  return [
    stateRow(view, now),
    memoryRow(view),
    recallRow(view),
    mixupsRow(view),
    recognitionRow(view),
  ];
}
