import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import type { RowCategory } from '@nekotype/engine';
import type { ChartCell, ChartLegend, ChartRow, KanaChartPanelLine } from '@/shared/ui/kana-chart';
import { locale, t } from '@/shared/i18n';
import { chartRows, keyOf } from '@/entities/learn';
import type { KanaCellInfo } from '@/entities/learn';
import { displayRomaji } from './romaji';

const SEPARATOR = ' · ';

function percent(value: number): number {
  return Math.round(value * 100);
}

function dateOf(timestamp: number): string {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(
    timestamp,
  );
}

/** The romaji of a kana as the chart shows it. */
export function romajiOf(key: LearnKanaKey): string {
  return displayRomaji(key);
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

/** The lines of the details panel of an activated cell (design 94): the state with the review
 * timing, the median and accuracy, the mixups and the recognition accuracy. */
export function kanaPanelLines(info: KanaCellInfo): readonly KanaChartPanelLine[] {
  const lines = kanaStateLines(info);
  const mixups: KanaChartPanelLine =
    info.mixups.length === 0
      ? { text: t('learn.chart.noMixups') }
      : {
          text: `${t('learn.chart.mixups')} ${info.mixups
            .map((mixup) => `${mixup.key.slice(mixup.key.indexOf(':') + 1)} ×${mixup.count}`)
            .join(', ')}`,
          segments: [
            { text: `${t('learn.chart.mixups')} ` },
            ...info.mixups.flatMap((mixup, at) => [
              ...(at > 0 ? [{ text: ', ' }] : []),
              { text: mixup.key.slice(mixup.key.indexOf(':') + 1), kana: true },
              { text: ` ×${mixup.count}` },
            ]),
          ],
        };
  const correct = info.recognitions - info.recognitionErrors;
  const recognition =
    info.recognitions === 0
      ? t('learn.chart.noRecognition')
      : t('learn.chart.recognition', {
          accuracy: percent(correct / info.recognitions),
          ok: correct,
          total: info.recognitions,
        });
  return [
    { text: lines[1] ?? '' },
    { text: lines[2] ?? '', dim: true },
    mixups,
    { text: recognition, dim: true },
  ];
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
      confident: t('learn.chart.state.confident'),
      mastered: t('learn.chart.state.mastered'),
      due: t('learn.chart.due'),
    },
  };
}
