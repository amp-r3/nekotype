import type { ComponentChildren, JSX, Ref } from 'preact';
import { cx } from '../lib';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ComponentChildren;
  readonly onClick?: (e: MouseEvent) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly autoFocus?: boolean;
  readonly ariaLabel?: string;
  readonly buttonRef?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  autoFocus = false,
  ariaLabel,
  buttonRef,
}: ButtonProps): JSX.Element {
  const base =
    'text-ui-label pointer-coarse:min-h-touch-min inline-flex items-center justify-center gap-1.5 rounded-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:text-fur-faint select-none';

  const sizeClasses =
    size === 'sm' ? 'h-control-sm px-2' : size === 'lg' ? 'h-control px-5' : 'h-control px-3';

  const variantClasses =
    variant === 'primary'
      ? 'bg-fur text-on-fur hover:bg-fur-bright disabled:bg-bg-raised'
      : variant === 'text'
        ? 'bg-transparent text-fur-dim hover:text-fur hover:bg-bg-hover'
        : variant === 'danger'
          ? 'text-miss border border-miss hover:bg-bg-hover disabled:border-fur-faint'
          : 'text-fur border border-line-strong hover:bg-bg-hover disabled:border-line';

  if (buttonRef !== undefined) {
    return (
      <button
        ref={buttonRef}
        type={type}
        disabled={disabled}
        onClick={onClick}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={cx(base, sizeClasses, variantClasses, className)}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      className={cx(base, sizeClasses, variantClasses, className)}
    >
      {children}
    </button>
  );
}
