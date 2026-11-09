import type { JSX } from 'preact';
import { t } from '@/shared/i18n';

export type SpeedChartProps = {
  readonly series: readonly number[];
};

export function SpeedChart({ series }: SpeedChartProps): JSX.Element | null {
  if (series.length <= 1) {
    return null;
  }

  const svgWidth = 460;
  const svgHeight = 90;
  const paddingX = 15;
  const paddingY = 12;

  const maxVal = Math.max(10, ...series);
  const usableW = svgWidth - paddingX * 2;
  const usableH = svgHeight - paddingY * 2;

  const pts = series.map((val, idx) => {
    const x = paddingX + (idx / (series.length - 1)) * usableW;
    const y = svgHeight - paddingY - (val / maxVal) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polylinePoints = pts.join(' ');

  return (
    <div className="flex w-full flex-col gap-1">
      <span className="text-fur-dim text-ui-caption">{t('results.chartTitle')}</span>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="h-24 w-full overflow-visible"
        aria-label={t('results.chartLabel')}
      >
        <line
          x1={paddingX}
          y1={svgHeight - paddingY}
          x2={svgWidth - paddingX}
          y2={svgHeight - paddingY}
          stroke="var(--chart-grid)"
          stroke-width="1"
        />
        <polyline
          fill="none"
          stroke="var(--chart-kpm)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          points={polylinePoints}
        />
      </svg>
    </div>
  );
}
