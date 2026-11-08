import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import type { ChartCell, ChartRow } from '@/shared/ui/kana-chart';
import { locale, t } from '@/shared/i18n';
import { chartRows, keyOf } from '@/entities/learn';
import type { KanaCellInfo } from '@/entities/learn';
import { spellingsFor } from '@/entities/prompt';

const SEPARATOR = ' · ';

function percent(value: number): number {
  return Math.round(value * 100);
}

function dateOf(timestamp: number): string {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(
    timestamp,
  );
}

function romajiOf(key: LearnKanaKey): string {
  return spellingsFor(key, 'ime')[0] ?? '';
}

/**
 * The lines of a cell's tooltip and `aria-label` (learning.md, "`/` screen"): the kana and its
 * romaji; the state with the review timing; the median answer time and accuracy of the last 10
 * recall answers. A locked kana has no romaji.
 */
export function kanaStateLines(info: KanaCellInfo): readonly string[] {
  if (info.state === 'locked') {
    const state = t('learn.chart.state.locked');
    return [
      info.kana,
      info.opensNext ? [state, t('learn.chart.opensNext')].join(SEPARATOR) : state,
    ];
  }
  const heading = [info.kana, romajiOf(info.key)].filter((part) => part !== '').join(SEPARATOR);
  const state = [t(`learn.chart.state.${info.state}`)];
  if (info.state === 'confident' || info.state === 'mastered') {
    if (info.due) state.push(t('learn.chart.due'));
    else if (info.dueAt !== null)
      state.push(t('learn.chart.nextReview', { date: dateOf(info.dueAt) }));
  }
  const lines = [heading, state.join(SEPARATOR)];
  if (!info.introduced) return [...lines, t('learn.chart.notIntroduced')];
  const stats = [
    t('learn.chart.stats', {
      ms: Math.round(info.medianMs),
      accuracy: percent(info.accuracy),
    }),
  ];
  if (info.answers < 10) stats.push(t('learn.chart.answers', { n: info.answers }));
  return [...lines, stats.join(SEPARATOR)];
}

/** The rows of the chart of a track, with every string made. */
export function chartModel(
  track: Track,
  infos: ReadonlyMap<LearnKanaKey, KanaCellInfo>,
): readonly ChartRow[] {
  return chartRows(track).map((row) => ({
    id: row.id,
    head: row.head,
    label: row.id === 'vowels' ? t('learn.chart.vowels') : row.name,
    block: row.category,
    cells: row.kana.map((kana): ChartCell | null => {
      const info = kana === null ? undefined : infos.get(keyOf(track, kana));
      if (info === undefined) return null;
      const lines = kanaStateLines(info);
      return {
        id: info.key,
        kana: info.kana,
        state: info.state,
        due: info.due,
        lines,
        label: lines.join(', '),
      };
    }),
  }));
}

/** The details of an activated cell: the mixups and the recognition accuracy. */
export function kanaDetails(info: KanaCellInfo): readonly string[] {
  const mixups =
    info.mixups.length === 0
      ? t('learn.chart.noMixups')
      : `${t('learn.chart.mixups')} ${info.mixups
          .map((mixup) => `${mixup.key.slice(mixup.key.indexOf(':') + 1)} ×${mixup.count}`)
          .join(', ')}`;
  const correct = info.recognitions - info.recognitionErrors;
  const recognition =
    info.recognitions === 0
      ? t('learn.chart.noRecognition')
      : t('learn.chart.recognition', {
          accuracy: percent(correct / info.recognitions),
          ok: correct,
          total: info.recognitions,
        });
  return [mixups, recognition];
}
