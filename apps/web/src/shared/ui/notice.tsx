import type { ComponentChildren, JSX } from 'preact';
import { cx } from '../lib';

export type NoticeProps = {
  // Only for a state that blocks an action (a failed load); pair it with a retry `action`.
  readonly tone?: 'miss' | undefined;
  // The space is held even when there is nothing to say, so nothing moves when a notice appears.
  readonly reserve?: boolean;
  // Static loading text: no animation.
  readonly loading?: boolean;
  // The revealed romaji: `mono-romaji`, the `lead` in `fur-dim` and the children (the romaji) in `eye`.
  readonly lead?: string | undefined;
  // One link or small button at the end of the line.
  readonly action?: ComponentChildren | undefined;
  readonly children?: ComponentChildren;
};

/** One status line (design Notice): `ui-label`, `fur-dim`, no fill and no icon. */
export function Notice({
  tone,
  reserve,
  loading,
  lead,
  action,
  children,
}: NoticeProps): JSX.Element {
  const reveal = lead !== undefined;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={loading === true ? true : undefined}
      className={cx(
        reveal ? 'text-mono-romaji font-mono' : 'text-ui-label',
        'flex items-baseline gap-3',
        tone === 'miss' ? 'text-miss' : 'text-fur-dim',
        reserve === true && 'min-h-5',
      )}
    >
      {reveal && <span className="text-fur-dim">{lead}</span>}
      {reveal ? <span className="text-eye">{children}</span> : children}
      {action !== undefined && action !== null && <span className="inline-flex">{action}</span>}
    </div>
  );
}
