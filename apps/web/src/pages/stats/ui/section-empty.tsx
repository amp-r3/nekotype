import type { JSX } from 'preact';
import { Button } from '@/shared/ui';
import { NARROW } from './layout';

export type SectionEmptyProps = {
  readonly title: string;
  readonly text: string;
  readonly action: string;
  readonly onAction: () => void;
};

/** A section before its first data (design decision 101): a title, one line and one action. */
export function SectionEmpty({ title, text, action, onAction }: SectionEmptyProps): JSX.Element {
  return (
    <div className={`flex ${NARROW} flex-col items-start gap-4`}>
      <h2 className="text-ui-heading text-fur">{title}</h2>
      <p className="text-ui-body text-fur-dim">{text}</p>
      <Button variant="primary" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
