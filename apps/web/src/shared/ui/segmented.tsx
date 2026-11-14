import type { JSX } from 'preact';
import { cx } from '../lib';

export type SegmentedOption<T extends string | number> = {
  readonly value: T;
  readonly label: string;
};

export type SegmentedProps<T extends string | number> = {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  // Numbers and romaji are set in the mono face.
  readonly mono?: boolean;
};

const SELECTED_CLASS =
  'text-fur after:bg-eye hover:after:bg-eye-bright after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-xs';

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  size = 'sm',
  mono = false,
}: SegmentedProps<T>): JSX.Element {
  const sizeClass = size === 'sm' ? 'h-control-sm px-2' : 'h-control px-3';
  const textClass = mono
    ? 'text-mono-romaji font-mono'
    : size === 'lg'
      ? 'text-ui-heading'
      : 'text-ui-label';

  // ← → move the choice and the focus inside the group, wrapping at the ends; the group is one
  // Tab stop (the selected option).
  const handleKeyDown = (e: KeyboardEvent, index: number): void => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const target = options[(index + step + options.length) % options.length];
    if (target === undefined) return;
    if (target.value !== value) onChange(target.value);
    const items = e.currentTarget instanceof HTMLElement ? e.currentTarget.parentElement : null;
    const next = items?.children[(index + step + options.length) % options.length];
    if (next instanceof HTMLElement) next.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('inline-flex flex-wrap select-none', size === 'lg' ? 'gap-4' : 'gap-1')}
    >
      {options.map((opt, index) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (opt.value !== value) {
                onChange(opt.value);
              }
            }}
            onKeyDown={(e) => {
              handleKeyDown(e, index);
            }}
            className={cx(
              textClass,
              'pointer-coarse:min-h-touch-min disabled:text-fur-faint relative cursor-pointer rounded-sm whitespace-nowrap transition-colors disabled:cursor-default',
              sizeClass,
              isSelected ? SELECTED_CLASS : 'text-fur-dim hover:text-fur',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
