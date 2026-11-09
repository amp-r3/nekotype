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

export type CatProps = {
  readonly size?: number;
  readonly className?: string;
};

/** The sleeping cat; decorative, so it is hidden from assistive technology. */
export function Cat({ size = 96, className = '' }: CatProps): JSX.Element {
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
