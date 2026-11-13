import type { JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

export type ResultChartProps = {
  // `null` is a gap: a day without answers.
  readonly values: readonly (number | null)[];
  // One label per value; the first, the middle and the last are drawn on the x axis.
  readonly xLabels: readonly string[];
  readonly height?: number;
  readonly domain: readonly [number, number];
  readonly ticks: readonly number[];
  // A dashed hair line: the target answer time.
  readonly reference?: { readonly value: number; readonly label: string };
  // The text of the tooltip of point `index`.
  readonly tip: (index: number, value: number | null) => string;
  readonly label: string;
  // Marks every point; without it only an isolated point (no neighbour) gets a dot.
  readonly dots?: boolean;
  readonly testId?: string;
};

const PAD_LEFT = 44;
const PAD_RIGHT = 4;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;
// Before the first measurement, and where there is no ResizeObserver.
const FALLBACK_WIDTH = 320;

/**
 * One line on `/stats` (design ResultChart): drawn at the width it has, so the axis text never
 * scales; a gap for a day without answers, a dot for an isolated point (every point with `dots`), a dashed target line; the cursor
 * follows the pointer or ← → and its tooltip names the day.
 */
export function ResultChart({
  values,
  xLabels,
  height = 180,
  domain,
  ticks,
  reference,
  tip,
  label,
  dots = false,
  testId,
}: ResultChartProps): JSX.Element {
  const figure = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [cursor, setCursor] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = figure.current;
    if (element === null || typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const [lo, hi] = domain;
  const count = Math.max(values.length, 2);
  const x = (index: number): number =>
    PAD_LEFT + (index / (count - 1)) * (width - PAD_LEFT - PAD_RIGHT);
  const y = (value: number): number =>
    PAD_TOP + (1 - (value - lo) / (hi - lo)) * (height - PAD_TOP - PAD_BOTTOM);

  // Runs of consecutive days with answers; a gap ends a run.
  const runs: { index: number; value: number }[][] = [];
  let run: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length > 0) runs.push(run);
      run = [];
    } else {
      run.push({ index, value });
    }
  });
  if (run.length > 0) runs.push(run);

  const last = values.length - 1;
  const labelled = values.length > 2 ? [0, Math.floor(last / 2), last] : values.map((_, i) => i);

  // The point nearest to the pointer; the drawing is `width` wide, the element may be scaled.
  function indexAt(clientX: number, box: DOMRect): number {
    const at =
      ((clientX - box.left) * (width / box.width) - PAD_LEFT) / (width - PAD_LEFT - PAD_RIGHT);
    return Math.max(0, Math.min(last, Math.round(at * (count - 1))));
  }

  function onKeyDown(event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setCursor(Math.max(0, Math.min(last, (cursor ?? -1) + step)));
  }

  const tipValue = cursor === null ? null : (values[cursor] ?? null);

  return (
    <figure
      ref={figure}
      className="relative m-0 w-full min-w-0"
      style={{ minHeight: height }}
      data-testid={testId}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        tabIndex={0}
        aria-label={label}
        className="block overflow-visible"
        onMouseMove={(event) => {
          setCursor(indexAt(event.clientX, event.currentTarget.getBoundingClientRect()));
        }}
        onMouseLeave={() => {
          setCursor(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setCursor(null);
        }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="stroke-chart-grid"
              stroke-width="1"
              x1={PAD_LEFT}
              x2={width}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="fill-fur-dim text-mono-small font-mono"
              x={PAD_LEFT - 8}
              y={y(tick) + 4}
              text-anchor="end"
              data-testid="axis-tick"
            >
              {tick}
            </text>
          </g>
        ))}
        {reference !== undefined && (
          <g data-testid="chart-reference">
            <line
              className="stroke-line-strong"
              stroke-width="1"
              stroke-dasharray="4 4"
              x1={PAD_LEFT}
              x2={width}
              y1={y(reference.value)}
              y2={y(reference.value)}
            />
            <text
              className="fill-fur-dim text-mono-small font-mono"
              x={width - PAD_RIGHT}
              y={y(reference.value) - 6}
              text-anchor="end"
            >
              {reference.label}
            </text>
          </g>
        )}
        {labelled.map((index) => (
          <text
            key={index}
            className="fill-fur-dim text-mono-small font-mono"
            x={x(index)}
            y={height - 4}
            text-anchor={index === 0 ? 'start' : index === last ? 'end' : 'middle'}
          >
            {xLabels[index]}
          </text>
        ))}
        {runs.map((points) =>
          points.length > 1 ? (
            <polyline
              key={points[0]?.index}
              className="nk-rchart__line stroke-chart-kpm fill-none"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
              pathLength="1"
              points={points
                .map((point) => `${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`)
                .join(' ')}
            />
          ) : null,
        )}
        {runs.flatMap((points) =>
          dots || points.length === 1
            ? points.map((point) => (
                <circle
                  key={point.index}
                  className="fill-chart-kpm"
                  cx={x(point.index)}
                  cy={y(point.value)}
                  r="2.5"
                  data-testid="chart-dot"
                />
              ))
            : [],
        )}
        {cursor !== null && (
          <line
            className="stroke-chart-cursor"
            stroke-width="1"
            x1={x(cursor)}
            x2={x(cursor)}
            y1={PAD_TOP}
            y2={height - PAD_BOTTOM}
          />
        )}
      </svg>
      {cursor !== null && (
        <figcaption
          className="bg-fur text-on-fur text-ui-caption pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-sm px-2 py-1 whitespace-nowrap"
          style={{ left: x(cursor), top: (tipValue === null ? height / 2 : y(tipValue)) - 8 }}
          data-testid="chart-tip"
        >
          {tip(cursor, tipValue)}
        </figcaption>
      )}
    </figure>
  );
}
