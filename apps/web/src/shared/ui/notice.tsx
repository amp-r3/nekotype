import type { ComponentChildren, JSX } from 'preact';
import { cx } from '../lib';

export type NoticeProps = {
  // Only for a state that blocks an action (a failed load); pair it with a retry `action`.
  readonly tone?: 'miss' | undefined;
  // The space is held even when there is nothing to say, so nothing moves when a notice appears.
  readonly reserve?: boolean;
  // Static loading text: no animation.
  readonly loading?: boolean;
  // One link or small button at the end of the line.
  readonly action?: ComponentChildren | undefined;
  readonly children?: ComponentChildren;
};

/** One status line (design Notice): `ui-label`, `fur-dim`, no fill and no icon. */
export function Notice({ tone, reserve, loading, action, children }: NoticeProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={loading === true ? true : undefined}
      className={cx(
        'text-ui-label flex items-center gap-3',
        tone === 'miss' ? 'text-miss' : 'text-fur-dim',
        reserve === true && 'min-h-control-sm',
      )}
    >
      {children}
      {action !== undefined && action !== null && <span className="inline-flex">{action}</span>}
    </div>
  );
}
