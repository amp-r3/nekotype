import type { JSX } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from '@/shared/lib';
import type { ChartPoint, ChartRange, TrendPoint } from '../lib/trend';

export type StatsChartProps = {
  readonly points: readonly ChartPoint[];
  /** The rolling median; `null` breaks it. */
  readonly line?: readonly (TrendPoint | null)[];
  /** The middle half of the same window (`lo`–`hi`); `null` breaks it. */
  readonly band?: readonly (TrendPoint | null)[];
  /** Bars from `lo` to `hi` with a tick at `mid` (the answer time of a day or a week). */
  readonly ranges?: readonly ChartRange[];
  /** How many bar slots the x axis holds; sets the bar width. */
  readonly slots?: number;
  /** A dashed line with its label, under the bars. */
  readonly reference?: { readonly value: number; readonly label: string };
  /** The value over each mark (a few tests). */
  readonly pointLabels?: boolean;
  readonly xDomain: readonly [number, number];
  readonly xTicks: readonly { readonly x: number; readonly label: string }[];
  readonly yDomain: readonly [number, number];
  readonly yTicks: readonly number[];
  readonly yFormat?: (value: number) => string;
  readonly height?: number;
  readonly label: string;
  readonly testId?: string;
};

const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;
const EDGE = 150;
const RADIUS = 3;
const RADIUS_BEST = 4;
const RADIUS_RING = 7;
const LABEL_LIFT = 10;
const LABEL_EDGE = 28;
const BAR_SHARE = 0.5;
const BAR_MIN = 2;
const BAR_MAX = 8;
const MID_OVERHANG = 2;
const MID_HEIGHT = 2;
const REF_LIFT = 6;

/** The unbroken runs of a series: `null` ends one. */
function runs(series: readonly (TrendPoint | null)[]): TrendPoint[][] {
  const out: TrendPoint[][] = [];
  let current: TrendPoint[] = [];
  for (const item of series) {
    if (item === null) {
      if (current.length > 0) out.push(current);
      current = [];
    } else current.push(item);
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * The chart of `/stats` (design ResultChart). It only draws: the series and the axes come from
 * `lib/trend` (S15). One Tab stop; ← → step through the marks in time order, `Home` / `End`
 * jump, `Esc` and blur clear the cursor. Drawn at the width it has, so the axis text never scales.
 */
export function StatsChart({
  points,
  line = [],
  band = [],
  ranges = [],
  slots = 1,
  reference,
  pointLabels = false,
  xDomain,
  xTicks,
  yDomain,
  yTicks,
  yFormat = String,
  height = 240,
  label,
  testId,
}: StatsChartProps): JSX.Element {
  const figure = useRef<HTMLElement>(null);
  const tipId = useId();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

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

  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const px = (value: number): number =>
    PAD_LEFT + ((value - x0) / (x1 - x0 || 1)) * (width - PAD_LEFT - PAD_RIGHT);
  const py = (value: number): number =>
    PAD_TOP + (1 - (value - y0) / (y1 - y0 || 1)) * (height - PAD_TOP - PAD_BOTTOM);

  // The cursor walks the marks, or the bars when there are no marks, in time order.
  const items: readonly { x: number; y: number; tip: readonly string[] }[] =
    points.length > 0 ? points : ranges.map((r) => ({ x: r.x, y: r.mid, tip: r.tip }));
  const order = items
    .map((_, index) => index)
    .sort((a, b) => (items[a]?.x ?? 0) - (items[b]?.x ?? 0));
  const shown = hover !== null && items[hover] !== undefined ? hover : null;
  const current = shown === null ? null : (items[shown] ?? null);
  const cursorX = current === null ? 0 : px(current.x);
  const slot = (width - PAD_LEFT - PAD_RIGHT) / Math.max(1, slots);
  const barWidth = Math.min(BAR_MAX, Math.max(BAR_MIN, Math.round(slot * BAR_SHARE)));

  function onMove(box: DOMRect, clientX: number, clientY: number): void {
    const mx = clientX - box.left;
    const my = clientY - box.top;
    let nearest: number | null = null;
    let best = Infinity;
    items.forEach((item, index) => {
      const dx = px(item.x) - mx;
      const dy = (py(item.y) - my) / 3;
      const distance = dx * dx + dy * dy;
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const count = order.length;
    if (count === 0) return;
    const at = shown === null ? -1 : order.indexOf(shown);
    let target: number;
    if (event.key === 'ArrowRight') target = Math.min(count - 1, at + 1);
    else if (event.key === 'ArrowLeft') target = at < 0 ? count - 1 : Math.max(0, at - 1);
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = count - 1;
    else if (event.key === 'Escape') {
      setHover(null);
      return;
    } else return;
    event.preventDefault();
    setHover(order[target] ?? null);
  }

  return (
    <figure ref={figure} className="nk-rc" style={{ minHeight: height }} data-testid={testId}>
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          tabIndex={0}
          aria-label={label}
          aria-describedby={current === null ? undefined : tipId}
          onMouseMove={(event) => {
            onMove(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
          }}
          onMouseLeave={() => {
            setHover(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setHover(null);
          }}
        >
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line className="nk-rc__grid" x1={PAD_LEFT} x2={width} y1={py(tick)} y2={py(tick)} />
              <text
                className="nk-rc__axis text-mono-small font-mono"
                x={PAD_LEFT - 8}
                y={py(tick) + 4}
                text-anchor="end"
                data-testid="axis-tick"
              >
                {yFormat(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => {
            const x = px(tick.x);
            return (
              <text
                key={`x${tick.x}`}
                className="nk-rc__axis text-mono-small font-mono"
                x={x}
                y={height - 4}
                text-anchor={x < PAD_LEFT + 24 ? 'start' : x > width - 24 ? 'end' : 'middle'}
              >
                {tick.label}
              </text>
            );
          })}
          {reference !== undefined && (
            <g data-testid="chart-reference">
              <line
                className="nk-rc__ref"
                x1={PAD_LEFT}
                x2={width - PAD_RIGHT}
                y1={py(reference.value)}
                y2={py(reference.value)}
              />
              <text
                className="nk-rc__ref-label text-mono-small font-mono"
                x={width - PAD_RIGHT}
                y={py(reference.value) - REF_LIFT}
                text-anchor="end"
              >
                {reference.label}
              </text>
            </g>
          )}
          {ranges.map((range, index) => (
            <g key={`r${index}`} data-testid="chart-range">
              <rect
                className="nk-rc__range"
                x={px(range.x) - barWidth / 2}
                y={py(range.hi)}
                width={barWidth}
                height={Math.max(MID_HEIGHT, py(range.lo) - py(range.hi))}
                rx={2}
              />
              <rect
                className="nk-rc__mid"
                x={px(range.x) - barWidth / 2 - MID_OVERHANG}
                y={py(range.mid) - MID_HEIGHT / 2}
                width={barWidth + 2 * MID_OVERHANG}
                height={MID_HEIGHT}
              />
            </g>
          ))}
          {runs(band).map((run, index) =>
            run.length < 2 ? null : (
              <polygon
                key={`b${index}`}
                className="nk-rc__band"
                data-testid="chart-band"
                points={[
                  ...run.map((d) => `${px(d.x).toFixed(1)},${py(d.hi).toFixed(1)}`),
                  ...run.map((d) => `${px(d.x).toFixed(1)},${py(d.lo).toFixed(1)}`).reverse(),
                ].join(' ')}
              />
            ),
          )}
          {runs(line).map((run, index) =>
            run.length < 2 ? null : (
              <polyline
                key={`l${index}`}
                className="nk-rc__line"
                data-testid="chart-line"
                pathLength={1}
                points={run.map((d) => `${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`).join(' ')}
              />
            ),
          )}
          {points.map((point, index) => (
            <circle
              key={index}
              className={`nk-rc__pt${point.mark === null ? '' : ` nk-rc__pt--${point.mark}`}`}
              cx={px(point.x)}
              cy={py(point.y)}
              r={(point.mark === 'best' ? RADIUS_BEST : RADIUS) + (pointLabels ? 1 : 0)}
              data-testid="chart-point"
            />
          ))}
          {pointLabels &&
            points.map((point, index) => (
              <text
                key={`v${index}`}
                className="nk-rc__val text-mono-small font-mono"
                x={px(point.x)}
                y={py(point.y) - LABEL_LIFT}
                text-anchor={px(point.x) > width - LABEL_EDGE ? 'end' : 'middle'}
                data-testid="chart-value"
              >
                {yFormat(point.y)}
              </text>
            ))}
          {current !== null && (
            <>
              <line
                className="nk-rc__cursor"
                x1={cursorX}
                x2={cursorX}
                y1={PAD_TOP}
                y2={height - PAD_BOTTOM}
              />
              <circle className="nk-rc__ring" cx={cursorX} cy={py(current.y)} r={RADIUS_RING} />
            </>
          )}
        </svg>
      )}
      {width > 0 && current !== null && (
        <div
          id={tipId}
          role="status"
          className={cx(
            'nk-rc__tip text-ui-caption',
            cursorX < EDGE && 'is-start',
            cursorX > width - EDGE && 'is-end',
          )}
          style={{ left: cursorX, top: Math.max(0, py(current.y) - 12) }}
          data-testid="chart-tip"
        >
          {current.tip.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </div>
      )}
    </figure>
  );
}
