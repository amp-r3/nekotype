// The cat's shapes below (the `path`, `circle` and `rect` geometry) are a brand asset of amp-r3, all
// rights reserved, and not covered by the AGPL; the rest of this file is. See NOTICE.md and BRAND.md.
import type { JSX } from 'preact';

// A file of its own, not in `cat.tsx`: only the lazy account panel draws it, so it stays out of the
// initial chunk.
export type CatMarkProps = {
  readonly size?: number;
  readonly className?: string;
};

/**
 * The cat mark: the head of the logo (design `Cat` `mark`), beside the profile of the account
 * section (design decision 123). Decorative.
 */
export function CatMark({ size = 40, className = '' }: CatMarkProps): JSX.Element {
  return (
    <svg
      viewBox="24 6 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      data-testid="cat-mark"
    >
      <path
        d="M32 26.75L29.66 14.47A1.6 1.6 0 0 1 32.04 12.79L41.59 18.4A2.2 2.2 0 0 0 43.28 18.63A18 18 0 0 1 52.72 18.63A2.2 2.2 0 0 0 54.41 18.4L63.96 12.79A1.6 1.6 0 0 1 66.34 14.47L64 26.75A2.2 2.2 0 0 0 64.18 28.12A18 18 0 1 1 31.82 28.12A2.2 2.2 0 0 0 32 26.75Z"
        fill="var(--cat-fur)"
      />
      <circle cx="41" cy="37" r="3.6" fill="var(--cat-eye)" />
      <rect x="40.25" y="34.6" width="1.5" height="4.8" rx="0.75" fill="var(--cat-ground)" />
      <circle cx="55" cy="37" r="3.6" fill="var(--cat-eye)" />
      <rect x="54.25" y="34.6" width="1.5" height="4.8" rx="0.75" fill="var(--cat-ground)" />
    </svg>
  );
}
