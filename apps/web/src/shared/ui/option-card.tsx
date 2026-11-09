import type { ComponentChildren, JSX } from 'preact';
import { cx } from '../lib';
import { Kbd } from './kbd';

export type OptionState = 'idle' | 'correct' | 'wrong' | 'reveal';

export type OptionCardProps = {
  // 1–4: the key that picks it.
  readonly n: number;
  readonly children: ComponentChildren;
  // The content is kana rather than romaji.
  readonly kana?: boolean;
  readonly state?: OptionState;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly ariaLabel?: string;
};

/** An option of a recognition task. Colour is never the only sign: the right one carries a mark. */
export function OptionCard({
  n,
  children,
  kana = false,
  state = 'idle',
  disabled = false,
  onClick,
  ariaLabel,
}: OptionCardProps): JSX.Element {
  return (
    <button
      type="button"
      className={cx('nk-opt', `is-${state}`)}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <Kbd className="nk-opt__key">{String(n)}</Kbd>
      <span
        className={cx(
          'nk-opt__label',
          kana ? 'font-jp text-jp-test-sm' : 'text-mono-stat font-mono',
        )}
        lang={kana ? 'ja' : undefined}
      >
        {children}
      </span>
    </button>
  );
}
