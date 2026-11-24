import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import type { RowCategory } from '@nekotype/engine';
import type { ChartCell, ChartLegend, ChartRow } from '@/shared/ui/kana-chart';
import { locale, t } from '@/shared/i18n';
import { chartRows, keyOf } from '@/entities/learn';
import type { KanaCellInfo } from '@/entities/learn';
import { displayRomaji } from '@/entities/learn';

const SEPARATOR = ' · ';

function percent(value: number): number {
  return Math.round(value * 100);
}

function dateOf(timestamp: number): string {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(
    timestamp,
  );
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
      info.opensNext ? [state, t('stats.chart.opensNext')].join(SEPARATOR) : state,
    ];
  }
  const heading = [info.kana, displayRomaji(info.key)]
    .filter((part) => part !== '')
    .join(SEPARATOR);
  const state = [t(`learn.chart.state.${info.state}`)];
  if (info.state === 'learned' || info.state === 'mastered') {
    if (info.due) state.push(t('stats.chart.due'));
    else if (info.dueAt !== null)
      state.push(t('stats.chart.nextReview', { date: dateOf(info.dueAt) }));
  }
  const lines = [heading, state.join(SEPARATOR)];
  // An introduced kana with no recall answer yet has no median to show.
  if (info.answers === 0) return lines;
  const stats = [
    t('stats.chart.stats', {
      ms: Math.round(info.medianMs),
      accuracy: percent(info.accuracy),
    }),
  ];
  if (info.answers < 10) stats.push(t('stats.chart.answers', { n: info.answers }));
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
    label: row.id === 'vowels' ? t('stats.chart.vowels') : row.name,
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

/** The captions of the chart's blocks, by row category. */
export function chartBlockLabels(): Readonly<Record<RowCategory, string>> {
  return {
    basic: t('learn.chart.block.basic'),
    dakuten: t('learn.chart.block.voiced'),
    yoon: t('learn.chart.block.combinations'),
    extended: t('learn.chart.block.extended'),
  };
}

/** The legend under the chart: the four states and the due mark. */
export function chartLegend(track: Track): ChartLegend {
  return {
    sample: track === 'hiragana' ? 'あ' : 'ア',
    labels: {
      locked: t('learn.chart.state.locked'),
      learning: t('learn.chart.state.learning'),
      learned: t('learn.chart.state.learned'),
      mastered: t('learn.chart.state.mastered'),
      due: t('stats.chart.due'),
    },
  };
}
