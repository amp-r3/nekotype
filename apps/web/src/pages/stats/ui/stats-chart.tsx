import type { JSX } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ChartPoint } from '../lib/trend';

export type StatsChartProps = {
  readonly points: readonly ChartPoint[];
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

/**
 * The chart of `/stats` (design ResultChart). It only draws: the series and the axes come from
 * `lib/trend` (S15). One Tab stop; ← → step through the marks in time order, `Home` / `End`
 * jump, `Esc` and blur clear the cursor. Drawn at the width it has, so the axis text never scales.
 */
export function StatsChart({
  points,
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

  // The cursor walks the marks in time order.
  const order = points
    .map((_, index) => index)
    .sort((a, b) => (points[a]?.x ?? 0) - (points[b]?.x ?? 0));
  const shown = hover !== null && points[hover] !== undefined ? hover : null;
  const current = shown === null ? null : (points[shown] ?? null);
  const cursorX = current === null ? 0 : px(current.x);

  function onMove(box: DOMRect, clientX: number, clientY: number): void {
    const mx = clientX - box.left;
    const my = clientY - box.top;
    let nearest: number | null = null;
    let best = Infinity;
    points.forEach((point, index) => {
      const dx = px(point.x) - mx;
      const dy = (py(point.y) - my) / 3;
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
          {points.map((point, index) => (
            <circle
              key={index}
              className={`nk-rc__pt${point.mark === null ? '' : ` nk-rc__pt--${point.mark}`}`}
              cx={px(point.x)}
              cy={py(point.y)}
              r={point.mark === 'best' ? RADIUS_BEST : RADIUS}
              data-testid="chart-point"
            />
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
          className={`nk-rc__tip text-ui-caption${cursorX < EDGE ? 'is-start' : ''}${cursorX > width - EDGE ? 'is-end' : ''}`}
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
