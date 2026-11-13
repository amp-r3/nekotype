import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import { cx } from '../lib';

export type SwitchProps = {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  // What the setting does, under the label.
  readonly description?: string;
  readonly disabled?: boolean;
};

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchProps): JSX.Element {
  const controlId = useId();
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-center justify-between gap-6 select-none max-sm:flex-col max-sm:items-start">
      <label
        htmlFor={controlId}
        className={cx(
          'text-ui-label flex flex-col gap-1',
          disabled ? 'text-fur-faint cursor-default' : 'text-fur cursor-pointer',
        )}
      >
        <span id={labelId}>{label}</span>
        {description !== undefined && (
          <span
            id={descriptionId}
            className={cx('text-ui-caption', disabled ? 'text-fur-faint' : 'text-fur-dim')}
          >
            {description}
          </span>
        )}
      </label>
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={cx(
          'bg-bg-raised hover:border-fur-dim pointer-coarse:min-h-touch-min disabled:hover:border-line relative h-5 w-[34px] shrink-0 cursor-pointer rounded-sm border transition-colors disabled:cursor-default',
          disabled ? 'border-line' : 'border-line-strong',
        )}
      >
        <span
          className={cx(
            'pointer-events-none absolute top-[3px] left-[3px] h-3 w-3 rounded-xs transition-transform',
            checked ? 'bg-eye translate-x-[14px]' : 'bg-fur-dim',
            disabled && 'bg-fur-faint',
          )}
        />
      </button>
    </div>
  );
}
