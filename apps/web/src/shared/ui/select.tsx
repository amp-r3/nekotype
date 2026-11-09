import type { JSX } from 'preact';
import { cx } from '../lib';

export type SelectOption = {
  readonly value: string;
  readonly label: string;
};

export type SelectProps = {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  // The name of the field for assistive technology.
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly testId?: string;
};

/**
 * A native `<select>` styled as an input (design Select): it fits any width, is keyboard-ready and
 * opens the system picker on a phone. The arrow is two hair lines in `fur-dim`, not an icon.
 */
export function Select({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  testId,
}: SelectProps): JSX.Element {
  return (
    <span className="relative block">
      <select
        aria-label={ariaLabel}
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
}
