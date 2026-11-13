import type { ComponentChildren, JSX } from 'preact';
import { cx } from '../lib';

export type KbdProps = {
  readonly children: ComponentChildren;
  // Inside a button the key has no border (`Button hint` does this itself).
  readonly bare?: boolean;
  readonly className?: string | undefined;
};

export function Kbd({ children, bare = false, className }: KbdProps): JSX.Element {
  return (
    <kbd
      className={cx(
        'text-fur-dim text-mono-small inline-flex items-center justify-center font-mono',
        bare ? 'px-0' : 'border-line-strong h-[18px] rounded-xs border px-1',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
