import type { JSX } from 'preact';
import { useId } from 'preact/hooks';

export type TextareaProps = {
  readonly label: string;
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly maxLength?: number;
  readonly disabled?: boolean;
  readonly testId?: string;
};

/**
 * A multi-line field (design Textarea): the fill of `Input`, 96px at least, resizes vertically. It
 * sits in a dialog, so it is filled with `bg` (decision 127). Not in the barrel: only the report
 * dialog's chunk uses it.
 */
export function Textarea({
  label,
  value,
  onInput,
  maxLength,
  disabled = false,
  testId,
}: TextareaProps): JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-ui-caption text-fur-dim">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        data-testid={testId}
        onInput={(event) => {
          onInput(event.currentTarget.value);
        }}
        className="bg-bg text-ui-body text-fur caret-eye disabled:text-fur-faint disabled:border-line min-h-24 w-full resize-y rounded-sm border border-transparent px-3 py-2 disabled:bg-transparent"
      />
    </div>
  );
}
