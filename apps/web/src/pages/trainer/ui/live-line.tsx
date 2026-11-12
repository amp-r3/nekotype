import type { JSX } from 'preact';
import type { ReadonlySignal } from '@preact/signals';
import { useComputed } from '@preact/signals';
import { t } from '@/shared/i18n';
import { testConfig } from '@/entities/settings';
import type { Session } from '@/features/training';

export type LiveLineProps = {
  readonly session: Session;
  // Set when the test is a repeat; it changes only when a test starts, never on a keystroke.
  readonly repeating: ReadonlySignal<boolean>;
};

/**
 * The counter (time left or prompts completed), kana per minute and kana accuracy, on one line above
 * the stream. The line is always there, so the text does not move when the test starts. Its numbers
 * are signals passed as text nodes: a keystroke updates them without rendering this component.
 */
export function LiveLine({ session, repeating }: LiveLineProps): JSX.Element {
  const counter = useComputed(() => {
    const config = testConfig.value;
    if (config.kind === 'zen') return String(session.completedPrompts.value);
    if (config.kind === 'count') {
      return `${session.completedPrompts.value} / ${config.prompts}`;
    }
    const startedAt = session.sessionStartedAt.value;
    const now = session.tickerNow.value;
    const elapsed = startedAt > 0 && now > startedAt ? Math.floor((now - startedAt) / 1000) : 0;
    return t('config.seconds.option', { n: Math.max(0, config.seconds - elapsed) });
  });

  return (
    <div className="flex min-h-8 w-full items-baseline gap-4">
      <span
        data-testid="live-counter"
        className="text-eye text-mono-counter font-mono tabular-nums"
      >
        {counter}
      </span>
      <span className="text-fur-dim text-mono-small font-mono tabular-nums">
        <span data-testid="live-kpm">{session.liveKpm}</span> {t('stage.liveKpm')}
        {' · '}
        <span data-testid="live-accuracy">{session.liveAccuracy}</span>%
      </span>
      {repeating.value && (
        <span
          data-testid="repeat-mark"
          className="text-fur-dim text-mono-small border-line rounded-sm border px-1.5 font-mono"
        >
          {t('stage.repeat')}
        </span>
      )}
    </div>
  );
}
