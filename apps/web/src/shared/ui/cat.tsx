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
      <path d="M82 84A12 12 0 0 0 70 72L70 78A6 6 0 0 1 76 84Z" style={FUR} />
      <circle cx="38" cy="56" r="15" style={FUR} />
      <circle cx="38" cy="56" r="15" style={GAP} />
      <path d="M25 52L22 35L36 43Z" style={FUR} />
      <path d="M51 52L54 35L40 43Z" style={FUR} />
      <circle cx="38" cy="56" r="14" style={FUR} />
      <path d="M29.8 57.0Q32.5 60.0 35.2 57.0" style={CUT} />
      <path d="M40.8 57.0Q43.5 60.0 46.2 57.0" style={CUT} />
    </svg>
  );
}
