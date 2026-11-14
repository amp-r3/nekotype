import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import { cx } from '../lib';

export type SelectOption = {
  readonly value: string;
  readonly label: string;
};

// The field needs a name: a visible `label`, or an `ariaLabel` for assistive technology only.
type SelectName =
  | { readonly label: string; readonly ariaLabel?: string }
  | { readonly label?: undefined; readonly ariaLabel: string };

export type SelectProps = {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly testId?: string;
} & SelectName;

/**
 * A native `<select>` styled as an input (design Select): it fits any width, is keyboard-ready and
 * opens the system picker on a phone. The arrow is two hair lines in `fur-dim`, not an icon.
 */
export function Select({
  options,
  value,
  onChange,
  ariaLabel,
  label,
  disabled = false,
  testId,
}: SelectProps): JSX.Element {
  const selectId = useId();
  const field = (
    <span className="relative block">
      <select
        id={label === undefined ? undefined : selectId}
        aria-label={label === undefined ? ariaLabel : undefined}
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        className={cx(
          'bg-bg-raised text-ui-body h-control pointer-coarse:min-h-touch-min w-full cursor-pointer appearance-none rounded-sm border-0 pr-8 pl-3',
          disabled ? 'text-fur-faint cursor-default' : 'text-fur',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="border-fur-dim pointer-events-none absolute top-1/2 right-3 -mt-[5px] h-[6px] w-[6px] rotate-45 border-r border-b"
      />
    </span>
  );
  if (label === undefined) return field;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-ui-caption text-fur-dim">
        {label}
      </label>
      {field}
    </div>
  );
}
