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
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-center justify-between gap-4 select-none max-sm:flex-col max-sm:items-start">
      <div className="flex flex-col">
        <span
          id={labelId}
          className={cx('text-ui-label', disabled ? 'text-fur-faint' : 'text-fur')}
        >
          {label}
        </span>
        {description !== undefined && (
          <span id={descriptionId} className="text-ui-caption text-fur-dim">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className="border-line-strong bg-bg-raised pointer-coarse:min-h-touch-min relative inline-flex h-5 w-[34px] shrink-0 cursor-pointer items-center rounded-sm border transition-colors disabled:cursor-not-allowed"
      >
        <span
          className={cx(
            'pointer-events-none inline-block h-3.5 w-3.5 rounded-xs transition-transform',
            checked ? 'bg-eye translate-x-[16px]' : 'bg-fur-dim translate-x-[2px]',
            disabled && 'bg-fur-faint',
          )}
        />
      </button>
    </div>
  );
}
