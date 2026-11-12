import type { ComponentChildren, JSX } from 'preact';

export type StatProps = {
  readonly label: string;
  readonly value: string | number;
  // The unit after the number: `days`, `ms`.
  readonly unit?: string;
  // `hero` is the one large number of a screen (KPM on the typing results).
  readonly size?: 'hero';
  // Next to the label: the personal best badge.
  readonly badge?: ComponentChildren;
  // Lines under the number: the comparisons of KPM.
  readonly comparisons?: ComponentChildren;
};

/** A metric: a caption, the number in the mono face and its unit (design Stat). */
export function Stat({ label, value, unit, size, badge, comparisons }: StatProps): JSX.Element {
  const hero = size === 'hero';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="text-ui-caption text-fur-dim">{label}</div>
        {badge}
      </div>
      <div className="text-fur flex items-baseline gap-1 tabular-nums">
        <span
          className={`font-mono ${hero ? 'text-mono-hero-sm sm:text-mono-hero' : 'text-mono-stat'}`}
        >
          {value}
        </span>
        {unit !== undefined && ' '}
        {unit !== undefined && (
          <span className="text-mono-romaji text-fur-dim font-mono">{unit}</span>
        )}
      </div>
      {comparisons !== undefined && (
        <div className="text-ui-label text-fur-dim flex flex-col">{comparisons}</div>
      )}
    </div>
  );
}
