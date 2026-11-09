import type { ComponentChildren, JSX } from 'preact';
import { Cat } from './cat';

export type EmptyStateProps = {
  readonly title: string;
  readonly text?: string;
  // One action, usually a primary button.
  readonly action?: ComponentChildren;
};

/** A screen with nothing to show yet: the sleeping cat, a title, one line and one action. */
export function EmptyState({ title, text, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="mx-auto flex max-w-[360px] flex-col items-center gap-2 py-16 text-center">
      <Cat size={112} className="mb-4" />
      <h2 className="text-ui-heading text-fur">{title}</h2>
      {text !== undefined && <p className="text-ui-body text-fur-dim mb-4">{text}</p>}
      {action}
    </div>
  );
}
