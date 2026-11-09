import type { JSX } from 'preact';

export type StatProps = {
  readonly label: string;
  readonly value: string | number;
  // The unit after the number: `days`, `ms`.
  readonly unit?: string;
};

/** A metric: a caption, the number in the mono face and its unit (design Stat). */
export function Stat({ label, value, unit }: StatProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-ui-caption text-fur-dim">{label}</div>
      <div className="text-fur flex items-baseline gap-1 tabular-nums">
        <span className="text-mono-stat font-mono">{value}</span>
        {unit !== undefined && ' '}
        {unit !== undefined && (
          <span className="text-mono-romaji text-fur-dim font-mono">{unit}</span>
        )}
      </div>
    </div>
  );
}
