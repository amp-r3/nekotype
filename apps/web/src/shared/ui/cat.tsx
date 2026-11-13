// The cat's shapes below (the `path` and `circle` geometry) are a brand asset of amp-r3, all
// rights reserved, and not covered by the AGPL; the rest of this file is. See NOTICE.md and BRAND.md.
import type { JSX } from 'preact';

// The white cat of the design system, `geometry` variant, asleep: the one picture of an empty
// screen. Its colours are the `--cat-*` tokens, so a theme changes them without touching the shapes.
const FUR = { fill: 'var(--cat-fur)' } as const;
const GAP = { fill: 'none', stroke: 'var(--cat-ground)', strokeWidth: '2.5' } as const;
const CUT = {
  fill: 'none',
  stroke: 'var(--cat-ground)',
  strokeWidth: '2',
  strokeLinecap: 'round',
} as const;

const CUT_FILL = { fill: 'var(--cat-ground)' } as const;
const EYE_FILL = { fill: 'var(--cat-eye)' } as const;

const EYE_ARC = {
  fill: 'none',
  stroke: 'var(--cat-eye)',
  strokeWidth: '2.2',
  strokeLinecap: 'round',
} as const;

export type CatProps = {
  readonly mood?: 'sleep' | 'content' | 'neutral';
  readonly size?: number;
  readonly className?: string;
};

/**
 * The cat, asleep by default, `content` (typing results on a personal best) or `neutral` (the 404
 * screen). Decorative, so it is
 * hidden from assistive technology.
 */
export function Cat({ mood = 'sleep', size = 96, className = '' }: CatProps): JSX.Element {
  if (mood === 'content' || mood === 'neutral') {
    return (
      <svg
        viewBox="0 0 96 96"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className={`block flex-none ${className}`}
      >
        <path
          d="M26 84.5L26 72A22 22 0 0 1 69.79 68.95A4 4 0 0 0 72.92 72.31A14 14 0 0 1 83.96 84.92A1 1 0 0 1 82.96 86L78.94 86A1 1 0 0 1 77.95 85.11A8 8 0 0 0 71.85 78.22A1.5 1.5 0 0 0 70 79.68L70 84.5A1.5 1.5 0 0 1 68.5 86L27.5 86A1.5 1.5 0 0 1 26 84.5Z"
          style={FUR}
        />
        <circle cx="48" cy="36" r="18" style={GAP} />
        <path
          d="M32.33 28.47L29.66 14.47A1.6 1.6 0 0 1 32.04 12.79L42.82 19.13A2.2 2.2 0 0 0 44.4 19.38A17 17 0 0 1 51.6 19.38A2.2 2.2 0 0 0 53.18 19.13L63.96 12.79A1.6 1.6 0 0 1 66.34 14.47L63.67 28.47A2.2 2.2 0 0 0 63.79 29.7A17 17 0 1 1 32.21 29.7A2.2 2.2 0 0 0 32.33 28.47Z"
          style={FUR}
        />
        {mood === 'content' ? (
          <>
            <path d="M38 38.4Q41 34.2 44 38.4" style={EYE_ARC} />
            <path d="M52 38.4Q55 34.2 58 38.4" style={EYE_ARC} />
          </>
        ) : (
          <>
            <circle cx="41" cy="37" r="3.4" style={EYE_FILL} />
            <rect x="40.3" y="34.7" width="1.4" height="4.6" rx="0.7" style={CUT_FILL} />
            <circle cx="55" cy="37" r="3.4" style={EYE_FILL} />
            <rect x="54.3" y="34.7" width="1.4" height="4.6" rx="0.7" style={CUT_FILL} />
          </>
        )}
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`block flex-none ${className}`}
    >
      <path d="M14 84A34 30 0 0 1 82 84Z" style={FUR} />
      <circle cx="38" cy="56" r="15" style={GAP} />
      <path
        d="M25.16 49.64L23.02 38.42A1.31 1.31 0 0 1 24.97 37.05L33.62 42.14A1.8 1.8 0 0 0 34.93 42.34A14 14 0 0 1 41.07 42.34A1.8 1.8 0 0 0 42.38 42.14L51.03 37.05A1.31 1.31 0 0 1 52.98 38.42L50.84 49.64A1.8 1.8 0 0 0 50.94 50.66A14 14 0 1 1 25.06 50.66A1.8 1.8 0 0 0 25.16 49.64Z"
        style={FUR}
      />
      <path d="M29.8 57Q32.5 60 35.2 57" style={CUT} />
      <path d="M40.8 57Q43.5 60 46.2 57" style={CUT} />
    </svg>
  );
}
