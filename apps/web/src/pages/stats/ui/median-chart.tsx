import type { JSX } from 'preact';
import { t } from '@/shared/i18n';

type Point = { readonly day: number; readonly ms: number };

const W = 320;
const H = 140;
const PAD = 8;

// Daily median answer time; lower is better, so lower points sit lower. A dashed line marks the target.
export function MedianChart({
  points,
  targetMs,
}: {
  points: readonly Point[];
  targetMs: number;
}): JSX.Element {
  const maxMs = Math.max(targetMs, ...points.map((p) => p.ms)) * 1.1;
  const first = points[0]?.day ?? 0;
  const span = Math.max(1, (points[points.length - 1]?.day ?? 0) - first);
  const x = (day: number): number => PAD + ((day - first) / span) * (W - 2 * PAD);
  const y = (ms: number): number => H - PAD - (ms / maxMs) * (H - 2 * PAD);
  const line = points.map((p) => `${x(p.day).toFixed(1)},${y(p.ms).toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('stats.learn.median')}
      className="text-fur w-full max-w-md"
      data-testid="stats-median-chart"
    >
      <line
        x1={PAD}
        x2={W - PAD}
        y1={y(targetMs)}
        y2={y(targetMs)}
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeDasharray="4 4"
      />
      <text x={W - PAD} y={y(targetMs) - 4} textAnchor="end" fontSize="10" fill="currentColor">
        {t('stats.learn.target', { ms: targetMs })}
      </text>
      {points.length > 1 ? (
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" />
      ) : null}
      {points.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p.ms)} r="3" fill="currentColor" />
      ))}
    </svg>
  );
}
