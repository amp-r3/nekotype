import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import type { ChartPoint } from '../lib/trend';

/** The marks that are on the chart, one caption line. */
export function ChartLegend({
  points,
  trend = false,
  lowerIsBetter = false,
}: {
  readonly points: readonly ChartPoint[];
  readonly trend?: boolean;
  readonly lowerIsBetter?: boolean;
}): JSX.Element {
  const items = [
    t('stats.legend.test'),
    ...(points.some((point) => point.mark === 'best') ? [t('stats.legend.best')] : []),
    ...(points.some((point) => point.mark === 'hollow') ? [t('stats.legend.repeat')] : []),
    ...(trend ? [t('stats.legend.median'), t('stats.legend.band')] : []),
    ...(lowerIsBetter ? [t('stats.legend.lower')] : []),
  ];
  return (
    <ul className="text-ui-caption text-fur-dim m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
