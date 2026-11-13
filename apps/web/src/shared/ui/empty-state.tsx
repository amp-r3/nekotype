import type { ComponentChildren, JSX } from 'preact';
import { Cat } from './cat';

export type EmptyStateProps = {
  readonly title: string;
  readonly text?: string;
  // `sleep` for an empty screen, `neutral` for the 404 screen.
  readonly mood?: 'sleep' | 'neutral';
  // A screen of its own (404) has no other heading, so the title is its `h1`.
  readonly heading?: 'h1' | 'h2';
  // One action, usually a primary button.
  readonly action?: ComponentChildren;
};

/** A screen with nothing to show yet: the sleeping cat, a title, one line and one action. */
export function EmptyState({
  title,
  text,
  mood,
  heading: Heading = 'h2',
  action,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="mx-auto flex max-w-[360px] flex-col items-center gap-2 py-16 text-center">
      <Cat mood={mood ?? 'sleep'} size={112} className="mb-4" />
      <Heading className="text-ui-heading text-fur">{title}</Heading>
      {text !== undefined && <p className="text-ui-body text-fur-dim mb-4">{text}</p>}
      {action}
    </div>
  );
}
