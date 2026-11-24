import type { ComponentChildren, JSX, Ref } from 'preact';
import { cx } from '../lib';
import { Kbd } from './kbd';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ComponentChildren;
  // The key after the label (`enter`, `ctrl + enter`), drawn bare (design Button `hint`).
  readonly hint?: ComponentChildren;
  // Classes of the hint's key, e.g. `pointer-coarse:hidden` where there is no keyboard.
  readonly hintClassName?: string;
  readonly onClick?: (e: MouseEvent) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly autoFocus?: boolean;
  readonly ariaLabel?: string;
  // For a button that opens something under it.
  readonly ariaExpanded?: boolean;
  readonly buttonRef?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  hint,
  hintClassName,
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  autoFocus = false,
  ariaLabel,
  ariaExpanded,
  buttonRef,
}: ButtonProps): JSX.Element {
  const base =
    'font-ui text-ui-label pointer-coarse:min-h-touch-min inline-flex items-center justify-center gap-2 rounded-sm border transition-colors cursor-pointer disabled:cursor-default disabled:text-fur-faint select-none';

  // The `text` variant has its own padding at every size (design `.nk-btn--text`).
  const sizeClasses = cx(
    size === 'sm' ? 'h-control-sm' : 'h-control',
    variant === 'text' ? 'px-2' : size === 'sm' ? 'px-3' : size === 'lg' ? 'px-6' : 'px-4',
  );

  // The border colour is set per variant only: two border colours in one class list are resolved by
  // Tailwind's order, not by the order of the classes, and a transparent one would hide the other.
  const variantClasses =
    variant === 'primary'
      ? 'border-transparent bg-fur text-on-fur hover:bg-fur-bright disabled:bg-bg-hover'
      : variant === 'text'
        ? 'border-transparent bg-transparent text-fur-dim hover:text-fur hover:bg-bg-hover'
        : variant === 'danger'
          ? 'text-miss border-miss hover:bg-bg-hover disabled:border-line'
          : 'text-fur border-line-strong hover:bg-bg-hover hover:border-fur-dim disabled:border-line';

  return (
    <button
      {...(buttonRef !== undefined ? { ref: buttonRef } : {})}
      type={type}
      disabled={disabled}
      onClick={onClick}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      className={cx(base, sizeClasses, variantClasses, className)}
    >
      {children}
      {hint !== undefined && (
        <Kbd bare className={cx(variant === 'primary' && 'text-on-fur', hintClassName)}>
          {hint}
        </Kbd>
      )}
    </button>
  );
}
