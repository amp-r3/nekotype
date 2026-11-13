import type { ComponentChildren, JSX } from 'preact';
import { cx } from '../lib';

export type ToggleProps = {
  readonly pressed: boolean;
  readonly onChange: (pressed: boolean) => void;
  readonly children: ComponentChildren;
  readonly disabled?: boolean;
};

/** A binary option in the style of a segment: an `aria-pressed` button (design Toggle). */
export function Toggle({
  pressed,
  onChange,
  children,
  disabled = false,
}: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => {
        onChange(!pressed);
      }}
      className={cx(
        'text-ui-label h-control-sm pointer-coarse:min-h-touch-min disabled:text-fur-faint relative cursor-pointer rounded-sm px-2 whitespace-nowrap transition-colors select-none disabled:cursor-default',
        pressed
          ? 'text-fur after:bg-eye hover:after:bg-eye-bright after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-xs'
          : 'text-fur-dim hover:text-fur',
      )}
    >
      {children}
    </button>
  );
}
